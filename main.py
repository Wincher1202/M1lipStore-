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
                   CREATE TABLE IF NOT EXISTS products
                   (
                       id
                       TEXT
                       PRIMARY
                       KEY,
                       brand
                       TEXT,
                       title
                       TEXT
                       NOT
                       NULL,
                       price
                       INTEGER
                       NOT
                       NULL,
                       tag
                       TEXT,
                       category
                       TEXT
                       NOT
                       NULL,
                       quantity
                       INTEGER
                       NOT
                       NULL,
                       colors
                       TEXT,
                       description
                       TEXT,
                       img
                       TEXT,
                       gallery
                       TEXT,
                       specs
                       TEXT,
                       color_images
                       TEXT,
                       color_quantities
                       TEXT
                   )
                   """)
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


class AddProductStates(StatesGroup):
    waiting_for_brand = State()
    waiting_for_title = State()
    waiting_for_price = State()
    waiting_for_tag = State()
    waiting_for_category = State()
    waiting_for_specs = State()
    waiting_for_colors = State()
    waiting_for_color_qty = State()
    waiting_for_color_main_photo = State()
    waiting_for_description = State()
    waiting_for_img = State()
    waiting_for_gallery = State()


class AdminStates(StatesGroup):
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
    if callback.from_user.id not in ADMIN_IDS: return
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
    try:
        await callback.message.answer_photo(photo=photo_url, caption=caption, parse_mode="Markdown",
                                            reply_markup=action_markup)
    except Exception:
        await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    await callback.answer()


@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
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
    await ask_category_step(callback.message, state)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.answer()


@router.message(AddProductStates.waiting_for_tag)
async def add_tag(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(tag=message.text.strip())
    await ask_category_step(message, state)


async def ask_category_step(message: Message, state: FSMContext):
    await state.set_state(AddProductStates.waiting_for_category)
    category_markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🖱 Миші", callback_data="cat_Миші"),
            InlineKeyboardButton(text="⌨️ Клавіатури", callback_data="cat_Клавіатури")
        ],
        [
            InlineKeyboardButton(text="🎧 Гарнітури", callback_data="cat_Гарнітури"),
            InlineKeyboardButton(text="🔌 Аксесуари", callback_data="cat_Аксесуари")
        ]
    ])
    await message.answer("📁 Оберіть **категорію** товару за допомогою кнопок:", reply_markup=category_markup,
                         parse_mode="Markdown")


@router.callback_query(F.data.startswith("cat_"), AddProductStates.waiting_for_category)
async def select_category_cb(callback: CallbackQuery, state: FSMContext):
    category = callback.data.replace("cat_", "")
    await state.update_data(category=category)
    await state.set_state(AddProductStates.waiting_for_specs)
    await state.update_data(specs=[], current_spec_index=1)

    try:
        await callback.message.delete()
    except Exception:
        pass

    await callback.message.answer(
        f"✅ Обрано категорію: **{category}**\n\n⚙️ Блок характеристик №1.\n\n*(Коли закінчите, надішліть /done)*",
        parse_mode="Markdown"
    )
    await callback.answer()


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

    specs.append({"label": f"БЛОК {spec_index}", "value": text})
    await state.update_data(specs=specs, current_spec_index=spec_index + 1)
    await message.answer(f"✅ Характеристику додано! Введіть наступну або надішліть /done:")


@router.callback_query(F.data.startswith("col_"), AddProductStates.waiting_for_colors)
async def select_colors_cb(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected_colors = data.get("selected_colors", [])

    if callback.data == "col_done":
        if not selected_colors:
            await callback.answer("Оберіть хоча б один колір!", show_alert=True)
            return
        await state.update_data(current_color_idx=0, color_quantities={}, color_images={})
        await state.set_state(AddProductStates.waiting_for_color_qty)
        first_color = selected_colors[0]
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.message.answer(f"📦 Введіть кількість на складі для кольору **{first_color}**:",
                                      parse_mode="Markdown")
        await callback.answer()
        return

    color_name = callback.data.replace("col_", "")
    if color_name not in selected_colors:
        selected_colors.append(color_name)
        await state.update_data(selected_colors=selected_colors)
        await callback.answer(f"Колір {color_name} додано!")
    else:
        await callback.answer(f"Колір {color_name} вже вибрано.")


@router.message(AddProductStates.waiting_for_color_qty)
async def process_color_qty(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        qty = int(message.text.strip())
        if qty < 0: raise ValueError()

        data = await state.get_data()
        selected_colors = data.get("selected_colors", [])
        idx = data.get("current_color_idx", 0)
        color_quantities = data.get("color_quantities", {})

        current_color = selected_colors[idx]
        color_quantities[current_color] = qty
        await state.update_data(color_quantities=color_quantities)

        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        await message.answer(f"🖼 Надішліть головне фото (посилання) для кольору **{current_color}**:",
                             parse_mode="Markdown")
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


@router.message(AddProductStates.waiting_for_color_main_photo)
async def process_color_main_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    photo_url = message.text.strip()

    data = await state.get_data()
    selected_colors = data.get("selected_colors", [])
    idx = data.get("current_color_idx", 0)
    color_images = data.get("color_images", {})
    current_color = selected_colors[idx]

    color_images[current_color] = photo_url
    await state.update_data(color_images=color_images)

    idx += 1
    if idx < len(selected_colors):
        await state.update_data(current_color_idx=idx)
        await state.set_state(AddProductStates.waiting_for_color_qty)
        next_color = selected_colors[idx]
        await message.answer(f"📦 Введіть кількість на складі для наступного кольору **{next_color}**:",
                             parse_mode="Markdown")
    else:
        await state.set_state(AddProductStates.waiting_for_description)
        await message.answer("📝 Введіть детальний опис товару:")


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть головне фото каталогу (посилання):")


@router.message(AddProductStates.waiting_for_img)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(img=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_gallery)
    await message.answer("📸 Надішліть галерею фото через кому (або пропустіть, написавши `-`):")


@router.message(AddProductStates.waiting_for_gallery)
async def add_gallery_and_save(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    gallery_text = message.text.strip()
    gallery = gallery_text if gallery_text != '-' else ""

    data = await state.get_data()
    product_id = "prod-" + str(int(asyncio.get_event_loop().time() * 1000))

    cq = data.get("color_quantities", {})
    total_qty = sum(cq.values()) if cq else 5
    colors_list = ", ".join(data.get("selected_colors", []))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
                   INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img,
                                         gallery, specs, color_images, color_quantities)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   """, (
                       product_id,
                       data.get("brand"),
                       data.get("title"),
                       data.get("price"),
                       data.get("tag"),
                       data.get("category"),
                       total_qty,
                       colors_list,
                       data.get("description"),
                       data.get("img"),
                       gallery,
                       json.dumps(data.get("specs"), ensure_ascii=False),
                       json.dumps(data.get("color_images"), ensure_ascii=False),
                       json.dumps(cq, ensure_ascii=False)
                   ))
    conn.commit()
    cursor.close()
    conn.close()

    await message.answer("✅ Товар успішно створено та збережено в базу даних! Напишіть /admin.", parse_mode="Markdown")
    await state.clear()


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

    await callback.message.answer("🗑 Товар успішно видалено з бази даних. Напишіть /admin.")
    app.include_router(router)
    await callback.answer()