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
            color_images TEXT,
            color_quantities TEXT
        )
    """)
    # Перевірка наявності необхідних колонок для сумісності з попередніми версіями
    cursor.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' and column_name='color_quantities') THEN
                ALTER TABLE products ADD COLUMN color_quantities TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' and column_name='color_images') THEN
                ALTER TABLE products ADD COLUMN color_images TEXT;
            END IF;
        END $$;
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

        try:
            p["colorQuantities"] = json.loads(p["color_quantities"]) if p.get("color_quantities") else {}
        except Exception:
            p["colorQuantities"] = {}

        result.append(p)
    return result


app = FastAPI()


@app.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API is running!"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = Router()


@app.get("/api/products")
async def get_products():
    return get_db_products()


# --- FSM СТАНИ ДЛЯ СТВОРЕННЯ ТОВАРУ ТА ФОТО ПО КОЛЬОРАХ ---
class AddProductStates(StatesGroup):
    waiting_for_brand = State()
    waiting_for_title = State()
    waiting_for_price = State()
    waiting_for_tag = State()
    waiting_for_category = State()
    waiting_for_qty = State()
    waiting_for_specs = State()
    waiting_for_colors = State()
    waiting_for_color_qty = State()
    waiting_for_color_photo = State() # Очікування фото для кожного окремого кольору
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
    waiting_for_color_qty_edit = State()


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
    cq = product.get('colorQuantities', {})
    colors_info = ", ".join([f"{c}: {q} шт." for c, q in cq.items()]) if cq else product.get('colors', 'не вказано')

    caption = (
        f"🛠 **Керування товаром: {product.get('brand', '')} {product['title']}**\n\n"
        f"• Бренд: {product.get('brand', 'не вказано')}\n"
        f"• Категорія: {product['category']}\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product['tag'] or 'немає'}`\n"
        f"• Загалом на складі: **{product['quantity']} шт.**\n"
        f"• Кольори та наявність: _{colors_info}_\n"
        f"• Блоків характеристик: {specs_count} шт."
    )

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏷 Тег", callback_data=f"set_tag_{product_id}"),
            InlineKeyboardButton(text="💰 Ціна", callback_data=f"set_price_{product_id}")
        ],
        [
            InlineKeyboardButton(text="✏️ Назва", callback_data=f"set_title_{product_id}"),
            InlineKeyboardButton(text="📦 Кількість (загальна)", callback_data=f"set_qty_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🎨 Наявність кольорів", callback_data=f"edit_colors_{product_id}"),
            InlineKeyboardButton(text="📁 Категорія", callback_data=f"set_cat_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🖼 Змінити фото", callback_data=f"photo_menu_{product_id}"),
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


@router.callback_query(F.data.startswith("edit_colors_"))
async def process_edit_colors(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("edit_colors_", "")

    products = get_db_products()
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        await callback.answer("Товар не знайдено!")
        return

    cq = product.get('colorQuantities', {})
    buttons = []
    for color in cq.keys():
        buttons.append([InlineKeyboardButton(text=f"Змінити залишок: {color} (зараз: {cq[color]} шт.)",
                                             callback_data=f"ch_cqty_{product_id}_{color}")])

    buttons.append([InlineKeyboardButton(text="🔙 Назад до товару", callback_data=f"manage_{product_id}")])

    markup = InlineKeyboardMarkup(inline_keyboard=buttons)
    try:
        await callback.message.edit_reply_markup(reply_markup=markup)
    except Exception:
        await callback.message.answer("Оберіть колір для редагування залишку:", reply_markup=markup)
    await callback.answer()


@router.callback_query(F.data.startswith("ch_cqty_"))
async def process_change_color_qty(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    parts = callback.data.replace("ch_cqty_", "").split("_", 1)
    product_id = parts[0]
    color_name = parts[1]

    await state.update_data(editing_product_id=product_id, editing_color_name=color_name)
    await state.set_state(AdminStates.waiting_for_color_qty_edit)
    await callback.message.answer(f"📦 Введіть нову кількість для кольору **{color_name}**:", parse_mode="Markdown")
    await callback.answer()


@router.message(AdminStates.waiting_for_color_qty_edit)
async def save_edited_color_qty(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    color_name = data.get("editing_color_name")

    try:
        new_q = int(message.text.strip())
        if new_q < 0: raise ValueError()

        products = get_db_products()
        product = next((p for p in products if p["id"] == product_id), None)
        if product:
            cq = product.get("colorQuantities", {})
            cq[color_name] = new_q
            total_qty = sum(cq.values())

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                           (json.dumps(cq, ensure_ascii=False), total_qty, product_id))
            conn.commit()
            cursor.close()
            conn.close()

        await message.answer(f"✅ Кількість для кольору **{color_name}** оновлено! Напишіть /admin.", parse_mode="Markdown")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть число (0 або більше):")


# --- СТВОРЕННЯ НОВОГО ТОВАРУ З ПОКРОКОВИМ ВВЕДЕННЯМ ФОТО ДЛЯ КОЖНОГО КОЛЬОРУ ---

@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    await state.set_state(AddProductStates.waiting_for_brand)
    await callback.message.answer(
        "🏷 Введіть **бренд** товару\n\n*(Наприклад: `Logitech`, `Razer`, `AULA`, `AJAZZ`, `Hator`)*:",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AddProductStates.waiting_for_brand)
async def add_brand(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(brand=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_title)
    await message.answer("✏️ Введіть **модель / назву** товару:", parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_title)
async def add_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(title=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_price)
    await message.answer("💰 Введіть **ціну** товару в гривнях (тільки число):")


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
        await message.answer("🏷 Введіть **тег** товару (або пропустіть):", reply_markup=skip_markup)
    except ValueError:
        await message.answer("❌ Введіть числове значення ціни:")


@router.callback_query(F.data == "skip_tag", AddProductStates.waiting_for_tag)
async def skip_tag_cb(callback: CallbackQuery, state: FSMContext):
    await state.update_data(tag="")
    await state.set_state(AddProductStates.waiting_for_category)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer("📁 Введіть **категорію** (`Миші`, `Клавіатури`, `Гарнітури`, `Аксесуари`):")


@router.message(AddProductStates.waiting_for_tag)
async def add_tag(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(tag=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_category)
    await message.answer("📁 Введіть **категорію** (`Миші`, `Клавіатури`, `Гарнітури`, `Аксесуари`):")


@router.message(AddProductStates.waiting_for_category)
async def add_category(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(category=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_specs)
    await state.update_data(specs=[], current_spec_index=1)
    await ask_next_spec(message, state, 1)


async def ask_next_spec(message: Message, state: FSMContext, spec_index: int):
    await state.update_data(current_spec_index=spec_index)
    await message.answer(
        f"⚙️ Блок характеристик №{spec_index} (наприклад: `Сенсор (PAW3349)`).\n\n*(Коли закінчите, надішліть /done)*",
        parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    text = message.text.strip()

    if text.lower() == '/done':
        await state.set_state(AddProductStates.waiting_for_colors)
        colors_markup = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🖤 Чорний", callback_data="col_Чорний"),
                InlineKeyboardButton(text="🤍 Білий", callback_data="col_Білий")
            ],
            [
                InlineKeyboardButton(text="🌸 Рожевий", callback_data="col_Рожевий"),
                InlineKeyboardButton(text="✅ Готово / Завершити вибір", callback_data="col_done")
            ]
        ])
        await state.update_data(selected_colors=[])
        await message.answer("🎨 Оберіть кольори та натисніть «Готово»:", reply_markup=colors_markup)
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
    await ask_next_spec(message, state, spec_index + 1)


@router.callback_query(F.data.startswith("col_"), AddProductStates.waiting_for_colors)
async def select_color_cb(callback: CallbackQuery, state: FSMContext):
    action = callback.data.replace("col_", "")
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])

    if action == "done":
        if not colors_list:
            colors_list = ["Чорний", "Білий"]
        await state.update_data(selected_colors=colors_list, color_quantities_dict={}, current_color_qty_index=0)
        await state.set_state(AddProductStates.waiting_for_color_qty)
        try:
            await callback.message.delete()
        except Exception:
            pass
        first_color = colors_list[0]
        await callback.message.answer(
            f"📦 Введіть кількість на складі для кольору **{first_color}** (ціле число):", parse_mode="Markdown")
        await callback.answer()
        return

    if action not in colors_list:
        colors_list.append(action)

    await state.update_data(selected_colors=colors_list)
    await callback.answer(f"Додано: {action}! Обрано: {', '.join(colors_list)}")


@router.message(AddProductStates.waiting_for_color_qty)
async def process_color_qty_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        qty = int(message.text.strip())
        if qty < 0: raise ValueError()

        data = await state.get_data()
        colors_list = data.get("selected_colors", [])
        idx = data.get("current_color_qty_index", 0)
        cq_dict = data.get("color_quantities_dict", {})

        current_color = colors_list[idx]
        cq_dict[current_color] = qty
        idx += 1

        if idx < len(colors_list):
            await state.update_data(current_color_qty_index=idx, color_quantities_dict=cq_dict)
            next_color = colors_list[idx]
            await message.answer(f"📦 Введіть кількість для кольору **{next_color}**:", parse_mode="Markdown")
        else:
            await state.update_data(color_quantities_dict=cq_dict, current_color_photo_index=0, color_images_dict={})
            await state.set_state(AddProductStates.waiting_for_color_photo)
            first_c = colors_list[0]
            await message.answer(
                f"🖼 Надішліть **посилання на фото** для кольору **{first_c}** (наприклад, пряме посилання на зображення):",
                parse_mode="Markdown")
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


@router.message(AddProductStates.waiting_for_color_photo)
async def process_color_photo_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    photo_url = message.text.strip()

    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    ci_dict = data.get("color_images_dict", {})

    current_color = colors_list[idx]
    ci_dict[current_color] = photo_url
    idx += 1

    if idx < len(colors_list):
        await state.update_data(current_color_photo_index=idx, color_images_dict=ci_dict)
        next_color = colors_list[idx]
        await message.answer(f"🖼 Надішліть **посилання на фото** для кольору **{next_color}**:", parse_mode="Markdown")
    else:
        await state.update_data(color_images_dict=ci_dict)
        await state.set_state(AddProductStates.waiting_for_description)
        await message.answer("📝 Введіть короткий опис товару:")


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть **головне посилання на фото** товару (для мініатюри в каталозі):")


@router.message(AddProductStates.waiting_for_img)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(img=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_gallery)
    await message.answer("📸 Надішліть **посилання на загальну галерею** (розділені комами), або надішліть одне посилання:")


@router.message(AddProductStates.waiting_for_gallery)
async def add_gallery_and_save(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    gallery_input = message.text.strip()
    data = await state.get_data()

    import uuid
    product_id = "prod-" + str(uuid.uuid4())[:8]
    brand = data.get("brand", "M1LIP")
    title = data.get("title", "Товар")
    price = data.get("price", 0)
    tag = data.get("tag", "")
    category = data.get("category", "Аксесуари")
    description = data.get("description", "")
    img = data.get("img", "")
    colors_list = data.get("selected_colors", ["Чорний", "Білий"])
    colors_str = ", ".join(colors_list)
    cq_dict = data.get("color_quantities_dict", {"Чорний": 5, "Білий": 5})
    ci_dict = data.get("color_images_dict", {})
    total_qty = sum(cq_dict.values())
    specs = data.get("specs", [])

    gallery_list = [g.strip() for g in gallery_input.split(",") if g.strip()]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img, gallery, specs, color_images, color_quantities)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        product_id, brand, title, price, tag, category, total_qty, colors_str,
        description, img, json.dumps(gallery_list, ensure_ascii=False),
        json.dumps(specs, ensure_ascii=False),
        json.dumps(ci_dict, ensure_ascii=False),
        json.dumps(cq_dict, ensure_ascii=False)
    ))
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer(f"🎉 Товар **{brand} {title}** успішно створено та додано в базу!\n\nНапишіть /admin для керування.", parse_mode="Markdown")


# --- ВИДАЛЕННЯ ТА ІНШІ ДІЇ АДМІНІСТРАТОРА ---
@router.callback_query(F.data.startswith("delete_prod_"))
async def process_delete_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("delete_prod_", "")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.message.answer("🗑 Товар успішно видалено з бази!")
    await callback.answer()


async def main():
    bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    config = uvicorn.Config(app, host="0.0.0.0", port=10000, log_level="info")
    server = uvicorn.Server(config)

    await asyncio.gather(
        bot.get_updates(offset=-1),
        dp.start_polling(bot),
        server.serve(),
    )


if __name__ == "__main__":
    asyncio.run(main())