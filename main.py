import asyncio
import json
import logging
import os
import urllib.parse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    WebAppInfo,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    CallbackQuery,
)
import uvicorn
import psycopg2
from psycopg2.extras import RealDictCursor

TOKEN = "8993086388:AAETWcnRI-uxvm-lI2r6mQCKIXtuXq0nwpo"
MANAGER_USERNAME = "lnvinciblee"
ADMIN_IDS = [1929165295, 1248134309]

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            brand TEXT,
            title TEXT NOT NULL,
            price INTEGER NOT NULL,
            tag TEXT,
            category TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            colors TEXT,
            description TEXT,
            img TEXT,
            gallery TEXT,
            specs TEXT,
            color_images TEXT
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()


init_db()


def get_db_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    result = []
    for row in rows:
        p = dict(row)
        try:
            p["colorImages"] = json.loads(p["color_images"]) if p["color_images"] else {}
        except Exception:
            p["colorImages"] = {}

        try:
            p["specs"] = json.loads(p["specs"]) if p["specs"] else []
        except Exception:
            p["specs"] = []

        result.append(p)
    return result


app = FastAPI()

# НАЛАШТУВАННЯ CORS (виправляє помилку блокування запитів з GitHub Pages на Render)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Дозволяє запити з будь-яких джерел (включно з твоїм сайтом на GitHub Pages)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = Router()


@app.get("/api/products")
async def get_products():
    return get_db_products()


# --- FSM СТАНИ ДЛЯ СТВОРЕННЯ ТОВАРУ ---
class AddProductStates(StatesGroup):
    waiting_for_brand = State()
    waiting_for_title = State()
    waiting_for_price = State()
    waiting_for_tag = State()
    waiting_for_category = State()
    waiting_for_qty = State()
    # Динамічні характеристики
    waiting_for_specs = State()
    # Кольори та фото
    waiting_for_colors = State()
    waiting_for_color_photo = State()
    # Опис та медіа
    waiting_for_description = State()
    waiting_for_img = State()
    waiting_for_gallery = State()


class AdminStates(StatesGroup):
    waiting_for_tag_text = State()
    waiting_for_price = State()
    waiting_for_title = State()
    waiting_for_quantity = State()
    waiting_for_category = State()
    waiting_for_img = State()
    waiting_for_gallery = State()


@router.message(Command("start"))
async def cmd_start(message: Message):
    shop_reply_keyboard = ReplyKeyboardMarkup(
        keyboard=[[
            KeyboardButton(
                text="🛍 Відкрити M1lipStore",
                web_app=WebAppInfo(
                    url="https://wincher1202.github.io/M1lipStore-/"
                ),
            )
        ]],
        resize_keyboard=True,
    )

    await message.answer(
        "Привіт! 👋 Вітаємо в **M1lipStore** — магазині крутих девайсів.\n\n"
        "Натисни кнопку нижче, щоб відкрити каталог, обрати девайс та оформити замовлення:",
        reply_markup=shop_reply_keyboard,
        parse_mode="Markdown",
    )


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ У вас немає прав доступу до адмін-панелі.")
        return

    products = get_db_products()
    keyboard_buttons = []

    for product in products:
        stock_status = f"📦 {product['quantity']} шт." if product['quantity'] > 0 else "❌ Немає"
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"{product.get('brand', '')} {product['title']} | {product['price']} ₴ | {stock_status}",
                callback_data=f"manage_{product['id']}"
            )
        ])

    keyboard_buttons.append([
        InlineKeyboardButton(text="➕ Додати новий товар", callback_data="add_new_product")
    ])

    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=admin_markup,
        parse_mode="Markdown"
    )


@router.callback_query(F.data == "back_to_admin")
async def process_back_to_admin(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return

    products = get_db_products()
    keyboard_buttons = []
    for product in products:
        stock_status = f"📦 {product['quantity']} шт." if product['quantity'] > 0 else "❌ Немає"
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"{product.get('brand', '')} {product['title']} | {product['price']} ₴ | {stock_status}",
                callback_data=f"manage_{product['id']}"
            )
        ])

    keyboard_buttons.append([
        InlineKeyboardButton(text="➕ Додати новий товар", callback_data="add_new_product")
    ])

    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    try:
        await callback.message.delete()
    except Exception:
        pass

    await callback.message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=admin_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("manage_"))
async def process_manage_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("manage_", "")
    products = get_db_products()
    product = next((p for p in products if p["id"] == product_id), None)

    if not product:
        await callback.answer("Товар не знайдено!", show_alert=True)
        return

    specs_count = len(product.get('specs', []))
    caption = (
        f"🛠 **Керування товаром: {product.get('brand', '')} {product['title']}**\n\n"
        f"• Бренд: {product.get('brand', 'не вказано')}\n"
        f"• Категорія: {product['category']}\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product['tag'] or 'немає'}`\n"
        f"• На складі: **{product['quantity']} шт.**\n"
        f"• Блоків характеристик: {specs_count} шт."
    )

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏷 Тег", callback_data=f"set_tag_{product_id}"),
            InlineKeyboardButton(text="💰 Ціна", callback_data=f"set_price_{product_id}")
        ],
        [
            InlineKeyboardButton(text="✏️ Назва", callback_data=f"set_title_{product_id}"),
            InlineKeyboardButton(text="📦 Наявність", callback_data=f"set_qty_{product_id}")
        ],
        [
            InlineKeyboardButton(text="📁 Категорія", callback_data=f"set_cat_{product_id}"),
            InlineKeyboardButton(text="🖼 Змінити фото", callback_data=f"photo_menu_{product_id}")
        ],
        [
            InlineKeyboardButton(text="❌ Видалити товар", callback_data=f"delete_prod_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")
        ]
    ])

    try:
        await callback.message.delete()
    except Exception:
        pass

    photo_url = product['img']
    if not photo_url or not photo_url.startswith("http"):
        photo_url = "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80"

    try:
        await callback.message.answer_photo(
            photo=photo_url,
            caption=caption,
            parse_mode="Markdown",
            reply_markup=action_markup
        )
    except Exception:
        await callback.message.answer(
            caption,
            parse_mode="Markdown",
            reply_markup=action_markup
        )
    await callback.answer()


@router.callback_query(F.data.startswith("photo_menu_"))
async def process_photo_menu(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    product_id = callback.data.replace("photo_menu_", "")

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖼 Головне фото (каталог + сайт)", callback_data=f"set_img_{product_id}")],
        [InlineKeyboardButton(text="📸 Додати фото до галереї", callback_data=f"set_gallery_{product_id}")],
        [InlineKeyboardButton(text="🔙 Назад до товару", callback_data=f"manage_{product_id}")]
    ])

    try:
        await callback.message.edit_reply_markup(reply_markup=markup)
    except Exception:
        await callback.message.answer("Оберіть дію з фотографіями:", reply_markup=markup)
    await callback.answer()


@router.callback_query(F.data.startswith("delete_prod_"))
async def process_delete_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return

    product_id = callback.data.replace("delete_prod_", "")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.answer("Товар успішно видалено!", show_alert=True)

    back_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Повернутися до списку", callback_data="back_to_admin")]
    ])

    try:
        await callback.message.edit_caption(
            caption="🗑 **Товар було повністю видалено з каталогу та бази даних.**",
            parse_mode="Markdown",
            reply_markup=back_markup
        )
    except Exception:
        await callback.message.answer(
            "🗑 **Товар було повністю видалено з каталогу та бази даних.**",
            parse_mode="Markdown",
            reply_markup=back_markup
        )


# --- ПРОЦЕС СТВОРЕННЯ ТОВАРУ ТА ДИНАМІЧНИХ БЛОКІВ ---

@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    await state.set_state(AddProductStates.waiting_for_brand)
    await callback.message.answer(
        "🏷 Введіть **бренд** товару\n\n"
        "*(Наприклад: `Logitech`, `Razer`, `AULA`, `AJAZZ`, `Hator`, `Attack Shark`)*:",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AddProductStates.waiting_for_brand)
async def add_brand(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(brand=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_title)
    await message.answer("✏️ Введіть **модель / назву** товару (наприклад: `R5 ULTRA`):", parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_title)
async def add_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(title=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_price)
    await message.answer("💰 Введіть **ціну** товару в гривнях (тільки число, наприклад `2945`):")


@router.message(AddProductStates.waiting_for_price)
async def add_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        price = int(message.text.strip())
        await state.update_data(price=price)
        await state.set_state(AddProductStates.waiting_for_tag)

        skip_markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="⏭ Пропустити тег", callback_data="skip_tag")]
        ])
        await message.answer(
            "🏷 Введіть **тег** товару (наприклад: `ХІТ / 8KHZ`, `НОВИНКА`), або натисніть кнопку нижче, щоб пропустити:",
            reply_markup=skip_markup)
    except ValueError:
        await message.answer("❌ Будь ласка, введіть числове значення ціни:")


@router.callback_query(F.data == "skip_tag", AddProductStates.waiting_for_tag)
async def skip_tag_cb(callback: CallbackQuery, state: FSMContext):
    await state.update_data(tag="")
    await state.set_state(AddProductStates.waiting_for_category)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        "📁 Введіть **категорію** товару\n\n"
        "*(Доступні варіанти: `Миші`, `Клавіатури`, `Гарнітури`, `Аксесуари`)*:",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AddProductStates.waiting_for_tag)
async def add_tag(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(tag=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_category)
    await message.answer(
        "📁 Введіть **категорію** товару\n\n"
        "*(Доступні варіанти: `Миші`, `Клавіатури`, `Гарнітури`, `Аксесуари`)*:",
        parse_mode="Markdown"
    )


@router.message(AddProductStates.waiting_for_category)
async def add_category(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(category=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_qty)
    await message.answer("📦 Введіть загальну **кількість** на складі (ціле число, наприклад `12`):")


@router.message(AddProductStates.waiting_for_qty)
async def add_qty(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        qty = int(message.text.strip())
        await state.update_data(quantity=qty, specs=[], current_spec_index=1)
        await ask_next_spec(message, state, 1)
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число:")


async def ask_next_spec(message: Message, state: FSMContext, spec_index: int):
    await state.update_data(current_spec_index=spec_index)

    example_text = (
        f"⚙️ **Головні характеристики товару** (Блок №{spec_index})\n\n"
        f"Вкажіть характеристику за прикладом:\n"
        f"`{spec_index}. Сенсор (PAW334)`\n\n"
        f"*(Можете створювати скільки завгодно таких блоків. Коли закінчите, просто надішліть команду /done)*"
    )

    await message.answer(example_text, parse_mode="Markdown")
    await state.set_state(AddProductStates.waiting_for_specs)


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    text = message.text.strip()

    if text.lower() == '/done':
        await state.set_state(AddProductStates.waiting_for_colors)

        colors_markup = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🖤 Чорний", callback_data="col_Black"),
                InlineKeyboardButton(text="🤍 Білий", callback_data="col_White")
            ],
            [
                InlineKeyboardButton(text="🌸 Рожевий", callback_data="col_Pink"),
                InlineKeyboardButton(text="✅ Готово / Завершити вибір", callback_data="col_done")
            ]
        ])
        await state.update_data(selected_colors=[], color_images_dict={})
        await message.answer(
            "✅ Характеристики збережено!\n\n🎨 Оберіть **наявність кольорів** для цього товару (натискайте на кнопки, а потім «Готово»):",
            reply_markup=colors_markup
        )
        return

    data = await state.get_data()
    specs = data.get("specs", [])
    spec_index = data.get("current_spec_index", 1)

    import re
    cleaned_text = re.sub(r'^\d+[\.\)]\s*', '', text)

    if "(" in cleaned_text and ")" in cleaned_text:
        parts = cleaned_text.split("(", 1)
        label = parts[0].strip().upper()
        value = parts[1].replace(")", "").strip()
    else:
        label = f"БЛОК {spec_index}"
        value = cleaned_text

    specs.append({"label": label, "value": value})
    await state.update_data(specs=specs)

    next_index = spec_index + 1
    await ask_next_spec(message, state, next_index)


@router.callback_query(F.data.startswith("col_"), AddProductStates.waiting_for_colors)
async def select_color_cb(callback: CallbackQuery, state: FSMContext):
    action = callback.data.replace("col_", "")
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])

    if action == "done":
        if not colors_list:
            colors_list = ["Чорний", "Білий"]
        colors_str = ", ".join(colors_list)
        await state.update_data(colors=colors_str, current_color_index=0)

        await state.set_state(AddProductStates.waiting_for_color_photo)
        first_color = colors_list[0]
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.message.answer(f"📸 Надішліть **фото товару для кольору: {first_color}**:")
        await callback.answer()
        return

    color_names = {"Black": "Чорний", "White": "Білий", "Pink": "Рожевий"}
    c_ukr = color_names.get(action, action)
    if c_ukr not in colors_list:
        colors_list.append(c_ukr)

    await state.update_data(selected_colors=colors_list)
    await callback.answer(f"Додано колір: {c_ukr}! Вибрано: {', '.join(colors_list)}")


@router.message(AddProductStates.waiting_for_color_photo, F.photo)
async def save_color_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    colors_list = data.get("selected_colors", ["Чорний"])
    idx = data.get("current_color_index", 0)
    color_images = data.get("color_images_dict", {})

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    photo_url = f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"

    current_color = colors_list[idx]
    color_images[current_color] = photo_url
    idx += 1

    if idx < len(colors_list):
        await state.update_data(current_color_index=idx, color_images_dict=color_images)
        next_color = colors_list[idx]
        await message.answer(
            f"✅ Фото для «{current_color}» збережено!\n\n📸 Тепер надішліть **фото товару для кольору: {next_color}**:")
    else:
        await state.update_data(color_images_dict=color_images)
        await state.set_state(AddProductStates.waiting_for_description)
        await message.answer("📝 Введіть **опис товару** (наприклад: `Флагманська надлегка бездротова ігрова миша...`):")


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть **головне фото товару** (основне для каталогу):")


@router.message(AddProductStates.waiting_for_img, F.photo)
async def add_img_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    photo_url = f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"

    await state.update_data(img=photo_url, gallery_list=[photo_url])
    await state.set_state(AddProductStates.waiting_for_gallery)

    finish_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Завершити створення", callback_data="finish_product")]
    ])
    await message.answer(
        "📸 Головне фото збережено!\n\nТепер ви можете надіслати **додаткові фотографії до галереї** або натиснути кнопку нижче для завершення:",
        reply_markup=finish_markup)


@router.message(AddProductStates.waiting_for_gallery, F.photo)
async def add_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    photo_url = f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"

    data = await state.get_data()
    gallery_list = data.get("gallery_list", [])
    gallery_list.append(photo_url)
    await state.update_data(gallery_list=gallery_list)

    finish_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✅ Завершити (додано фото: {len(gallery_list)})", callback_data="finish_product")]
    ])
    await message.answer(f"➕ Фото успішно додано до галереї! Можете надіслати ще або натиснути завершення:",
                         reply_markup=finish_markup)


@router.callback_query(F.data == "finish_product", AddProductStates.waiting_for_gallery)
async def finish_product_creation(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()

    brand = data.get("brand", "Attack Shark")
    title = data.get("title", "R5")

    generated_id = f"{brand}-{title}".lower().replace(" ", "-").replace("(", "").replace(")", "")

    img = data.get("img", "")
    gallery_list = data.get("gallery_list", [img])
    gallery_str = ",".join(gallery_list)
    color_images_json = json.dumps(data.get("color_images_dict", {}), ensure_ascii=False)
    specs_json = json.dumps(data.get("specs", []), ensure_ascii=False)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO products 
        (id, brand, title, price, tag, category, quantity, colors, description, img, gallery, specs, color_images)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET 
            brand = EXCLUDED.brand,
            title = EXCLUDED.title,
            price = EXCLUDED.price,
            tag = EXCLUDED.tag,
            category = EXCLUDED.category,
            quantity = EXCLUDED.quantity,
            colors = EXCLUDED.colors,
            description = EXCLUDED.description,
            img = EXCLUDED.img,
            gallery = EXCLUDED.gallery,
            specs = EXCLUDED.specs,
            color_images = EXCLUDED.color_images
        """,
        (
            generated_id,
            brand,
            title,
            data.get("price", 0),
            data.get("tag", ""),
            data.get("category", "Миші"),
            data.get("quantity", 0),
            data.get("colors", "Чорний, Білий"),
            data.get("description", ""),
            img,
            gallery_str,
            specs_json,
            color_images_json
        )
    )
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        "🎉 **Товар успішно створено та додано до каталогу та сайту з усіма динамічними блоками та кольорами!**\n\nНапишіть /admin для перегляду.",
        parse_mode="Markdown")
    await callback.answer()


# --- РЕДАГУВАННЯ ПОЛІВ ІЗ ПАНЕЛІ КЕРУВАННЯ ---

@router.callback_query(F.data.startswith("set_tag_"))
async def process_set_tag(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_tag_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_tag_text)
    await callback.message.answer("📝 Введіть новий тег (або `-` щоб очистити):")
    await callback.answer()


@router.message(AdminStates.waiting_for_tag_text)
async def save_tag(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_val = "" if message.text.strip() == "-" else message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET tag = %s WHERE id = %s", (new_val, product_id))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer("✅ Тег успішно оновлено! Напишіть /admin.")
    await state.clear()


@router.callback_query(F.data.startswith("set_price_"))
async def process_set_price(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_price_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_price)
    await callback.message.answer("💰 Введіть нову ціну (тільки число):")
    await callback.answer()


@router.message(AdminStates.waiting_for_price)
async def save_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    try:
        new_price = int(message.text.strip())
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET price = %s WHERE id = %s", (new_price, product_id))
        conn.commit()
        cursor.close()
        conn.close()
        await message.answer(f"✅ Ціну змінено на {new_price} ₴! Напишіть /admin.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть числове значення ціни:")


@router.callback_query(F.data.startswith("set_title_"))
async def process_set_title(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_title_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_title)
    await callback.message.answer("✏️ Введіть нову модель/назву товару:")
    await callback.answer()


@router.message(AdminStates.waiting_for_title)
async def save_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_title = message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET title = %s WHERE id = %s", (new_title, product_id))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer(f"✅ Назву змінено на **{new_title}**! Напишіть /admin.", parse_mode="Markdown")
    await state.clear()


@router.callback_query(F.data.startswith("set_qty_"))
async def process_set_qty(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_qty_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_quantity)
    await callback.message.answer("📦 Введіть доступну кількість на складі:")
    await callback.answer()


@router.message(AdminStates.waiting_for_quantity)
async def save_quantity(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    try:
        new_qty = int(message.text.strip())
        if new_qty < 0: raise ValueError()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET quantity = %s WHERE id = %s", (new_qty, product_id))
        conn.commit()
        cursor.close()
        conn.close()
        await message.answer(f"✅ Кількість на складі змінено на {new_qty} шт.! Напишіть /admin.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть додатне ціле число або 0:")


@router.callback_query(F.data.startswith("set_cat_"))
async def process_set_cat(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_cat_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_category)
    await callback.message.answer("📁 Введіть нову категорію:")
    await callback.answer()


@router.message(AdminStates.waiting_for_category)
async def save_category(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_cat = message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET category = %s WHERE id = %s", (new_cat, product_id))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer(f"✅ Категорію змінено на **{new_cat}**! Напишіть /admin.", parse_mode="Markdown")
    await state.clear()


@router.callback_query(F.data.startswith("set_img_"))
async def process_set_img(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_img_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_img)
    await callback.message.answer("🖼 Надішліть **нове головне фото** у чат:")
    await callback.answer()


@router.message(AdminStates.waiting_for_img, F.photo)
async def save_img_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    file_url = f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET img = %s WHERE id = %s", (file_url, product_id))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer("✅ Головне фото успішно оновлено! Напишіть /admin.")
    await state.clear()


@router.callback_query(F.data.startswith("set_gallery_"))
async def process_set_gallery(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_gallery_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_gallery)
    await callback.message.answer("📸 Надішліть додаткове фото для **галереї товару**:")
    await callback.answer()


@router.message(AdminStates.waiting_for_gallery, F.photo)
async def save_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    file_url = f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT gallery FROM products WHERE id = %s", (product_id,))
    row = cursor.fetchone()

    current_gallery = row['gallery'] if row and row['gallery'] else ""
    new_gallery = f"{current_gallery},{file_url}" if current_gallery else file_url

    cursor.execute("UPDATE products SET gallery = %s WHERE id = %s", (new_gallery, product_id))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer("✅ Фото додано до галереї! Напишіть /admin.")
    await state.clear()


# --- ОБРОБКА ЗАМОВЛЕНЬ ІЗ САЙТУ ---

@router.message(F.web_app_data)
async def process_web_app_order(message: Message):
    try:
        cart_items = json.loads(message.web_app_data.data)
        if not cart_items:
            await message.answer("Ваш кошик порожній.")
            return

        total_price = sum(item["price"] * item.get("qty", 1) for item in cart_items)
        items_list_str = "\n".join([
            f"• {item['title']} (колір: {item.get('color', 'не вказано')}) — {item['qty']} шт. х {item['price']} UAH = {item['price'] * item.get('qty', 1)} UAH"
            for item in cart_items
        ])

        manager_url = (
            f"https://t.me/{MANAGER_USERNAME}?text="
            f"{encode_text(f'Добрий день, бажаю оформити замовлення:\n{items_list_str}\n\nЗагальна сума: {total_price} UAH')}"
        )

        contact_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[
                InlineKeyboardButton(
                    text="💬 Підтвердити замовлення у менеджера",
                    url=manager_url,
                )
            ]]
        )

        await message.answer(
            f"📦 **Твоє замовлення сформовано!**\n\n{items_list_str}\n\n"
            f"💰 **Загальна сума:** {total_price} UAH\n\n"
            f"Натисни кнопку нижче, щоб надіслати його менеджеру в особисті повідомлення:",
            reply_markup=contact_keyboard,
            parse_mode="Markdown",
        )
    except Exception as e:
        await message.answer(f"Сталася помилка при обробці замовлення: {e}")


def encode_text(text):
    return urllib.parse.quote(text)


async def main():
    logging.basicConfig(level=logging.INFO)
    bot = Bot(token=TOKEN)
    dp = Dispatcher()

    dp.include_router(router)
    await bot.delete_webhook(drop_pending_updates=True)

    asyncio.create_task(dp.start_polling(bot))
    print("Telegram-бот запущено і готовий до роботи з PostgreSQL та динамічними блоками!")

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())