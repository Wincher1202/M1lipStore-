import asyncio
import json
import logging
import os
import re
import psycopg2
from psycopg2.extras import RealDictCursor
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

# --- НАЛАШТУВАННЯ ---
TOKEN = "8993086388:AAETWcnRI-uxvm-lI2r6mQCKIXtuXq0nwpo"
MANAGER_USERNAME = "lnvinciblee"
ADMIN_IDS = [1929165295, 1248134309]

DATABASE_URL = os.environ.get("DATABASE_URL")

logging.basicConfig(level=logging.INFO)


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
        for key, field in [("colorImages", "color_images"), ("specs", "specs"),
                           ("colorQuantities", "color_quantities")]:
            try:
                p[key] = json.loads(p[field]) if p.get(field) else ([] if key == "specs" else {})
            except Exception:
                p[key] = [] if key == "specs" else {}
        result.append(p)
    return result


# --- FASTAPI APP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API is running!"}


@app.get("/api/products")
async def get_products():
    return get_db_products()


# --- AIOGRAM ROUTER ТА СТАНИ ---
router = Router()


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
    waiting_for_color_gallery_photos = State()
    waiting_for_description = State()


class AdminStates(StatesGroup):
    waiting_for_color_qty_edit = State()


album_cache = {}


def get_admin_main_keyboard():
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
    return InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)


@router.message(Command("start"))
async def cmd_start(message: Message):
    shop_reply_keyboard = ReplyKeyboardMarkup(
        keyboard=[[
            KeyboardButton(
                text="🛍 Відкрити M1lipStore",
                web_app=WebAppInfo(url="https://wincher1202.github.io/M1lipStore-/"),
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
    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=get_admin_main_keyboard(),
        parse_mode="Markdown"
    )


@router.callback_query(F.data == "back_to_admin")
async def process_back_to_admin(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=get_admin_main_keyboard(),
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("manage_"))
async def process_manage_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("manage_", "")
    product = next((p for p in get_db_products() if p["id"] == product_id), None)

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
            InlineKeyboardButton(text="📦 Кількість", callback_data=f"set_qty_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🎨 Кольори", callback_data=f"edit_colors_{product_id}"),
            InlineKeyboardButton(text="📁 Категорія", callback_data=f"set_cat_{product_id}")
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

    photo_url = product.get('img')
    try:
        if photo_url:
            await callback.message.answer_photo(photo=photo_url, caption=caption, parse_mode="Markdown",
                                                reply_markup=action_markup)
        else:
            await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    except Exception:
        await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
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

    await callback.answer("✅ Товар успішно видалено!", show_alert=True)
    await process_back_to_admin(callback)


# --- ЛАНЦЮЖОК СТВОРЕННЯ НОВОГО ТОВАРУ ---
@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    await state.set_state(AddProductStates.waiting_for_brand)
    await callback.message.answer(
        "🏷 Введіть **бренд** товару\n\n*(Наприклад: `Logitech`, `Razer`, `AULA`, `AJAZZ`, `Hator`)*:",
        parse_mode="Markdown")
    await callback.answer()


@router.message(AddProductStates.waiting_for_brand)
async def add_brand(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    await state.update_data(brand=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_title)
    await message.answer("✏️ Введіть **модель / назву** товару:", parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_title)
async def add_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    await state.update_data(title=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_price)
    await message.answer("💰 Введіть **ціну** товару в гривнях (тільки число):")


@router.message(AddProductStates.waiting_for_price)
async def add_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    try:
        price = int(message.text.strip())
        await state.update_data(price=price)
        await state.set_state(AddProductStates.waiting_for_tag)
        skip_markup = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити тег", callback_data="skip_tag")]])
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
    if message.from_user.id not in ADMIN_IDS:
        return
    await state.update_data(tag=message.text.strip())
    await ask_category_step(message, state)


async def ask_category_step(message: Message, state: FSMContext):
    await state.set_state(AddProductStates.waiting_for_category)
    category_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖱 Миші", callback_data="cat_Миші"),
         InlineKeyboardButton(text="⌨️ Клавіатури", callback_data="cat_Клавіатури")],
        [InlineKeyboardButton(text="🎧 Гарнітури", callback_data="cat_Гарнітури"),
         InlineKeyboardButton(text="🔌 Аксесуари", callback_data="cat_Аксесуари")]
    ])
    await message.answer("📁 Оберіть **категорію** товару за допомогою кнопок:", reply_markup=category_markup,
                         parse_mode="Markdown")


@router.callback_query(F.data.startswith("cat_"), AddProductStates.waiting_for_category)
async def select_category_cb(callback: CallbackQuery, state: FSMContext):
    category = callback.data.replace("cat_", "")
    await state.update_data(category=category, specs=[], current_spec_index=1)
    await state.set_state(AddProductStates.waiting_for_specs)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        f"✅ Обрано категорію: **{category}**\n\n⚙️ Блок характеристик №1 (наприклад: `Сенсор (PAW3349)`).\n\n*(Коли закінчите, надішліть /done)*",
        parse_mode="Markdown")
    await callback.answer()


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    text = message.text.strip()

    if text.lower() == '/done':
        await state.set_state(AddProductStates.waiting_for_colors)
        colors_markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🖤 Чорний", callback_data="col_Чорний"),
             InlineKeyboardButton(text="🤍 Білий", callback_data="col_Білий")],
            [InlineKeyboardButton(text="🌸 Рожевий", callback_data="col_Рожевий"),
             InlineKeyboardButton(text="✅ Готово / Завершити вибір", callback_data="col_done")]
        ])
        await state.update_data(selected_colors=[])
        await message.answer("🎨 Оберіть кольори та натисніть «Готово»:", reply_markup=colors_markup)
        return

    data = await state.get_data()
    specs = data.get("specs", [])
    spec_index = data.get("current_spec_index", 1)

    cleaned_text = re.sub(r'^\d+[\.\)]\s*', '', text)
    if "(" in cleaned_text and ")" in cleaned_text:
        parts = cleaned_text.split("(", 1)
        label = parts[0].strip().upper()
        value = parts[1].replace(")", "").strip()
    else:
        label = f"БЛОК {spec_index}"
        value = cleaned_text

    specs.append({"label": label, "value": value})
    await state.update_data(specs=specs, current_spec_index=spec_index + 1)
    await message.answer(f"⚙️ Блок характеристик №{spec_index + 1} (або надішліть /done):")


@router.callback_query(F.data.startswith("col_"), AddProductStates.waiting_for_colors)
async def select_color_cb(callback: CallbackQuery, state: FSMContext):
    action = callback.data.replace("col_", "")
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])

    if action == "done":
        if not colors_list:
            colors_list = ["Чорний"]
        await state.update_data(selected_colors=colors_list, color_quantities_dict={}, current_color_qty_index=0)
        await state.set_state(AddProductStates.waiting_for_color_qty)
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.message.answer(f"📦 Введіть кількість на складі для кольору **{colors_list[0]}** (ціле число):",
                                      parse_mode="Markdown")
        await callback.answer()
        return

    if action not in colors_list:
        colors_list.append(action)

    await state.update_data(selected_colors=colors_list)
    await callback.answer(f"Додано: {action}! Обрано: {', '.join(colors_list)}")


@router.message(AddProductStates.waiting_for_color_qty)
async def process_color_qty_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    try:
        qty = int(message.text.strip())
        if qty < 0: raise ValueError()

        data = await state.get_data()
        colors_list = data.get("selected_colors", [])
        idx = data.get("current_color_qty_index", 0)
        cq_dict = data.get("color_quantities_dict", {})

        cq_dict[colors_list[idx]] = qty
        idx += 1

        if idx < len(colors_list):
            await state.update_data(current_color_qty_index=idx, color_quantities_dict=cq_dict)
            await message.answer(f"📦 Введіть кількість для кольору **{colors_list[idx]}**:", parse_mode="Markdown")
        else:
            await state.update_data(color_quantities_dict=cq_dict, current_color_photo_index=0, color_images_dict={})
            await state.set_state(AddProductStates.waiting_for_color_main_photo)
            skip_markup = InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити фото", callback_data="skip_col_main_photo")]])
            await message.answer(f"🖼 Надішліть головне фото для кольору **{colors_list[0]}**:",
                                 reply_markup=skip_markup, parse_mode="Markdown")
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


@router.callback_query(F.data == "skip_col_main_photo", AddProductStates.waiting_for_color_main_photo)
@router.callback_query(F.data == "col_gallery_done")
async def handle_photo_steps_skip_or_done(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    ci_dict = data.get("color_images_dict", {})
    current_color = colors_list[idx]

    if current_color not in ci_dict:
        ci_dict[current_color] = {"main": "", "gallery": []}

    idx += 1
    if idx < len(colors_list):
        await state.update_data(current_color_photo_index=idx, color_images_dict=ci_dict)
        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        try:
            await callback.message.delete()
        except Exception:
            pass
        skip_markup = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити фото", callback_data="skip_col_main_photo")]])
        await callback.message.answer(f"🖼 Надішліть головне фото для наступного кольору **{colors_list[idx]}**:",
                                      reply_markup=skip_markup, parse_mode="Markdown")
    else:
        # Усі кроки пройдено — зберігаємо товар у БД
        await finalize_and_save_product(callback.message, state, ci_dict)
    await callback.answer()


@router.message(AddProductStates.waiting_for_color_main_photo, F.photo)
async def process_color_main_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    photo_file_id = message.photo[-1].file_id
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    current_color = colors_list[idx]

    ci_dict = data.get("color_images_dict", {})
    ci_dict[current_color] = {"main": photo_file_id, "gallery": []}

    idx += 1
    if idx < len(colors_list):
        await state.update_data(current_color_photo_index=idx, color_images_dict=ci_dict)
        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        skip_markup = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити фото", callback_data="skip_col_main_photo")]])
        await message.answer(f"🖼 Надішліть головне фото для наступного кольору **{colors_list[idx]}**:",
                             reply_markup=skip_markup, parse_mode="Markdown")
    else:
        await finalize_and_save_product(message, state, ci_dict)


async def finalize_and_save_product(message: Message, state: FSMContext, color_images_dict: dict):
    data = await state.get_data()

    product_id = "prod-" + uuid.uuid4().hex[:8]
    brand = data.get("brand", "M1LIP")
    title = data.get("title", "Товар")
    price = data.get("price", 0)
    tag = data.get("tag", "НОВИНКА")
    category = data.get("category", "Аксесуари")
    specs = data.get("specs", [])
    color_quantities = data.get("color_quantities_dict", {})
    total_quantity = sum(color_quantities.values()) if color_quantities else 5

    # Знаходимо перше доступне головне фото як дефолтне
    main_img = ""
    color_images_flat = {}
    for col_name, img_data in color_images_dict.items():
        m_img = img_data.get("main", "")
        color_images_flat[col_name] = m_img
        if not main_img and m_img:
            main_img = m_img

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
                   INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img,
                                         gallery, specs, color_images, color_quantities)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   """, (
                       product_id,
                       brand,
                       title,
                       price,
                       tag,
                       category,
                       total_quantity,
                       ", ".join(color_quantities.keys()),
                       f"Преміальний ігровий девайс {title} від {brand}.",
                       main_img,
                       json.dumps([main_img] if main_img else []),
                       json.dumps(specs, ensure_ascii=False),
                       json.dumps(color_images_flat, ensure_ascii=False),
                       json.dumps(color_quantities, ensure_ascii=False)
                   ))
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer(
        "🎉 **Товар успішно створено та збережено в базу даних!**\n\nМожете перевірити його через /admin або в каталозі магазину.",
        parse_mode="Markdown")


# --- ЗАПУСК ДОДАТКУ ---
async def main():
    bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    config = uvicorn.Config(app, host="0.0.5.0", port=8000, log_level="info")
    server = uvicorn.Server(config)

    await asyncio.gather(
        dp.start_polling(bot),
        server.serve()
    )


if __name__ == "__main__":
    asyncio.run(main())