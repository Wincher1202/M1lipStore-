import asyncio
import json
import logging
import os
import uuid
import re
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
        for key, default in [("colorImages", {}), ("specs", []), ("colorQuantities", {}), ("gallery", [])]:
            db_key = "color_images" if key == "colorImages" else (
                "color_quantities" if key == "colorQuantities" else key)
            try:
                p[key] = json.loads(p[db_key]) if p.get(db_key) else default
            except Exception:
                p[key] = default
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
    waiting_for_color_gallery_photos = State()
    waiting_for_description = State()
    waiting_for_img = State()
    waiting_for_gallery = State()


class AdminEditStates(StatesGroup):
    waiting_for_color_qty_edit = State()
    waiting_for_price_edit = State()
    waiting_for_title_edit = State()
    waiting_for_tag_edit = State()
    waiting_for_category_edit = State()
    waiting_for_qty_edit = State()


@router.message(Command("start"))
async def cmd_start(message: Message):
    shop_reply_keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🛍 Відкрити M1lipStore",
                                  web_app=WebAppInfo(url="https://wincher1202.github.io/M1lipStore-/"))]],
        resize_keyboard=True,
    )
    await message.answer(
        "Привіт! 👋 Вітаємо в **M1lipStore** — магазині крутих девайсів.\n\nНатисни кнопку нижче, щоб відкрити каталог:",
        reply_markup=shop_reply_keyboard,
        parse_mode="Markdown",
    )


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ У вас немає прав доступу до адмін-панелі.")
        return

    products = get_db_products()
    keyboard_buttons = [
        [InlineKeyboardButton(
            text=f"{p.get('brand', '')} {p['title']} | {p['price']} ₴ | 📦 {p['quantity']} шт.",
            callback_data=f"manage_{p['id']}"
        )] for p in products
    ]
    keyboard_buttons.append([InlineKeyboardButton(text="➕ Додати новий товар", callback_data="add_new_product")])

    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons),
        parse_mode="Markdown"
    )


@router.callback_query(F.data == "back_to_admin")
async def process_back_to_admin(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    products = get_db_products()
    keyboard_buttons = [
        [InlineKeyboardButton(
            text=f"{p.get('brand', '')} {p['title']} | {p['price']} ₴ | 📦 {p['quantity']} шт.",
            callback_data=f"manage_{p['id']}"
        )] for p in products
    ]
    keyboard_buttons.append([InlineKeyboardButton(text="➕ Додати новий товар", callback_data="add_new_product")])

    try:
        await callback.message.delete()
    except Exception:
        pass

    await callback.message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons),
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

    cq = product.get('colorQuantities', {})
    colors_info = ", ".join([f"{c}: {q} шт." for c, q in cq.items()]) if cq else product.get('colors', 'не вказано')

    caption = (
        f"🛠 **Керування товаром: {product.get('brand', '')} {product['title']}**\n\n"
        f"• Бренд: {product.get('brand', 'не вказано')}\n"
        f"• Категорія: {product['category']}\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product['tag'] or 'немає'}`\n"
        f"• Загалом на складі: **{product['quantity']} шт.**\n"
        f"• Кольори та наявність: _{colors_info}_"
    )

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏷 Тег", callback_data=f"edit_tag_{product_id}"),
         InlineKeyboardButton(text="💰 Ціна", callback_data=f"edit_price_{product_id}")],
        [InlineKeyboardButton(text="✏️ Назва", callback_data=f"edit_title_{product_id}"),
         InlineKeyboardButton(text="📦 Кількість", callback_data=f"edit_qty_{product_id}")],
        [InlineKeyboardButton(text="🎨 Кольори", callback_data=f"edit_colors_{product_id}"),
         InlineKeyboardButton(text="📁 Категорія", callback_data=f"edit_cat_{product_id}")],
        [InlineKeyboardButton(text="❌ Видалити товар", callback_data=f"delete_prod_{product_id}")],
        [InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")]
    ])

    try:
        await callback.message.delete()
    except Exception:
        pass

    try:
        if product.get('img'):
            await callback.message.answer_photo(photo=product['img'], caption=caption, parse_mode="Markdown",
                                                reply_markup=action_markup)
        else:
            await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    except Exception:
        await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    await callback.answer()


@router.callback_query(F.data.startswith("edit_price_"))
async def edit_price_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    await state.update_data(editing_product_id=callback.data.replace("edit_price_", ""))
    await state.set_state(AdminEditStates.waiting_for_price_edit)
    await callback.message.answer("💰 Введіть нову ціну товару (тільки число):")
    await callback.answer()


@router.message(AdminEditStates.waiting_for_price_edit)
async def save_edited_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        new_price = int(message.text.strip())
        data = await state.get_data()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET price = %s WHERE id = %s", (new_price, data.get("editing_product_id")))
        conn.commit()
        cursor.close()
        conn.close()
        await message.answer("✅ Ціну оновлено! Напишіть /admin.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть числове значення ціни:")


@router.callback_query(F.data.startswith("edit_title_"))
async def edit_title_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    await state.update_data(editing_product_id=callback.data.replace("edit_title_", ""))
    await state.set_state(AdminEditStates.waiting_for_title_edit)
    await callback.message.answer("✏️ Введіть нову назву товару:")
    await callback.answer()


@router.message(AdminEditStates.waiting_for_title_edit)
async def save_edited_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET title = %s WHERE id = %s",
                   (message.text.strip(), data.get("editing_product_id")))
    conn.commit()
    cursor.close()
    conn.close()
    await message.answer("✅ Назву оновлено! Напишіть /admin.")
    await state.clear()


@router.callback_query(F.data.startswith("edit_colors_"))
async def process_edit_colors(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("edit_colors_", "")
    product = next((p for p in get_db_products() if p["id"] == product_id), None)
    if not product:
        await callback.answer("Товар не знайдено!")
        return

    cq = product.get('colorQuantities', {})
    buttons = [[InlineKeyboardButton(text=f"Змінити залишок: {color} ({cq[color]} шт.)",
                                     callback_data=f"ch_cqty_{product_id}_{color}")] for color in cq.keys()]
    buttons.append([InlineKeyboardButton(text="🔙 Назад до товару", callback_data=f"manage_{product_id}")])

    await callback.message.edit_text(
        f"🎨 Керування кольорами для **{product['title']}**\nОберіть колір:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("ch_cqty_"))
async def start_change_color_qty(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    parts = callback.data.replace("ch_cqty_", "").split("_", 1)
    await state.update_data(editing_product_id=parts[0], editing_color_name=parts[1])
    await state.set_state(AdminEditStates.waiting_for_color_qty_edit)
    await callback.message.answer(f"📦 Введіть нову кількість для кольору **{parts[1]}**:")
    await callback.answer()


@router.message(AdminEditStates.waiting_for_color_qty_edit)
async def save_color_qty_edit(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        new_q = int(message.text.strip())
        if new_q < 0: raise ValueError()
        data = await state.get_data()
        pid, cname = data.get("editing_product_id"), data.get("editing_color_name")

        product = next((p for p in get_db_products() if p["id"] == pid), None)
        if product:
            cq = product.get('colorQuantities', {})
            cq[cname] = new_q
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                           (json.dumps(cq, ensure_ascii=False), sum(cq.values()), pid))
            conn.commit()
            cursor.close()
            conn.close()
            await message.answer(f"✅ Залишок оновлено! Напишіть /admin.")
            await state.clear()
    except ValueError:
        await message.answer("❌ Введіть коректне ціле число (0 або більше):")


@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    await state.set_state(AddProductStates.waiting_for_brand)
    await callback.message.answer("🏷 Введіть **бренд** товару (наприклад: `Logitech`, `Razer`):", parse_mode="Markdown")
    await callback.answer()


@router.message(AddProductStates.waiting_for_brand)
async def add_brand(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(brand=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_title)
    await message.answer("✏️ Введіть **модель / назву** товару:")


@router.message(AddProductStates.waiting_for_title)
async def add_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(title=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_price)
    await message.answer("💰 Введіть **ціну** в гривнях (тільки число):")


@router.message(AddProductStates.waiting_for_price)
async def add_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        await state.update_data(price=int(message.text.strip()))
        await state.set_state(AddProductStates.waiting_for_tag)
        await message.answer("🏷 Введіть **тег** товару або натисніть кнопку:", reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити", callback_data="skip_tag")]]))
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
    await message.answer("📁 Оберіть категорію:", reply_markup=InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖱 Миші", callback_data="cat_Миші"),
         InlineKeyboardButton(text="⌨️ Клавіатури", callback_data="cat_Клавіатури")],
        [InlineKeyboardButton(text="🎧 Гарнітури", callback_data="cat_Гарнітури"),
         InlineKeyboardButton(text="🔌 Аксесуари", callback_data="cat_Аксесуари")]
    ]))


@router.callback_query(F.data.startswith("cat_"), AddProductStates.waiting_for_category)
async def select_category_cb(callback: CallbackQuery, state: FSMContext):
    await state.update_data(category=callback.data.replace("cat_", ""), specs=[], current_spec_index=1)
    await state.set_state(AddProductStates.waiting_for_specs)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        "⚙️ Введіть характеристики (наприклад: `Сенсор (PAW3349)`). Коли закінчите, надішліть `/done`:")
    await callback.answer()


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    if message.text.strip().lower() == '/done':
        await state.set_state(AddProductStates.waiting_for_colors)
        await state.update_data(selected_colors=[])
        await message.answer("🎨 Оберіть кольори:", reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🖤 Чорний", callback_data="col_Чорний"),
             InlineKeyboardButton(text="🤍 Білий", callback_data="col_Білий")],
            [InlineKeyboardButton(text="✅ Готово", callback_data="col_done")]
        ]))
        return

    data = await state.get_data()
    specs = data.get("specs", [])
    text = message.text.strip()
    label, value = (text.split("(", 1)[0].strip().upper(),
                    text.split("(", 1)[1].replace(")", "").strip()) if "(" in text and ")" in text else (
        f"БЛОК {data.get('current_spec_index', 1)}", text)
    specs.append({"label": label, "value": value})
    await state.update_data(specs=specs, current_spec_index=data.get('current_spec_index', 1) + 1)
    await message.answer("⚙️ Наступна характеристика (або `/done`):")


@router.callback_query(F.data.startswith("col_"), AddProductStates.waiting_for_colors)
async def select_color_cb(callback: CallbackQuery, state: FSMContext):
    action = callback.data.replace("col_", "")
    data = await state.get_data()
    colors = data.get("selected_colors", [])
    if action == "done":
        if not colors: colors = ["Чорний"]
        await state.update_data(selected_colors=colors, color_quantities_dict={}, current_color_qty_index=0)
        await state.set_state(AddProductStates.waiting_for_color_qty)
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.message.answer(f"📦 Введіть кількість для кольору **{colors[0]}**:", parse_mode="Markdown")
        await callback.answer()
        return
    if action not in colors: colors.append(action)
    await state.update_data(selected_colors=colors)
    await callback.answer(f"Обрано: {', '.join(colors)}")


@router.message(AddProductStates.waiting_for_color_qty)
async def process_color_qty_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        qty = int(message.text.strip())
        if qty < 0: raise ValueError()
        data = await state.get_data()
        colors, idx, cq = data.get("selected_colors"), data.get("current_color_qty_index"), data.get(
            "color_quantities_dict")
        cq[colors[idx]] = qty
        idx += 1
        if idx < len(colors):
            await state.update_data(current_color_qty_index=idx, color_quantities_dict=cq)
            await message.answer(f"📦 Введіть кількість для кольору **{colors[idx]}**:", parse_mode="Markdown")
        else:
            await state.update_data(color_quantities_dict=cq, current_color_photo_index=0, color_images_dict={})
            await state.set_state(AddProductStates.waiting_for_color_main_photo)
            await message.answer(f"🖼 Надішліть головне фото для кольору **{colors[0]}**:",
                                 reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                                     [InlineKeyboardButton(text="⏭ Пропустити", callback_data="skip_col_main_photo")]]))
    except ValueError:
        await message.answer("❌ Введіть ціле число (0 або більше):")


@router.callback_query(F.data == "skip_col_main_photo", AddProductStates.waiting_for_color_main_photo)
async def skip_col_main_photo_cb(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    c_dict = data.get("color_images_dict")
    c_dict[data.get("selected_colors")[data.get("current_color_photo_index")]] = {"main": "", "gallery": []}
    await state.update_data(color_images_dict=c_dict)
    await state.set_state(AddProductStates.waiting_for_color_gallery_photos)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer("📸 Надішліть додаткові фото для цього кольору (або натисніть кнопку):",
                                  reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                                      [InlineKeyboardButton(text="✅ Готово", callback_data="col_gallery_done")]]))
    await callback.answer()


@router.message(AddProductStates.waiting_for_color_main_photo, F.photo)
async def process_color_main_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    colors, idx, c_dict = data.get("selected_colors"), data.get("current_color_photo_index"), data.get(
        "color_images_dict")
    c_dict[colors[idx]] = {"main": message.photo[-1].file_id, "gallery": []}
    await state.update_data(color_images_dict=c_dict)
    await state.set_state(AddProductStates.waiting_for_color_gallery_photos)
    await message.answer("📸 Надішліть додаткові фото (або натисніть кнопку):", reply_markup=InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="✅ Готово", callback_data="col_gallery_done")]]))


@router.message(AddProductStates.waiting_for_color_gallery_photos, F.photo)
async def process_color_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    colors, idx, c_dict = data.get("selected_colors"), data.get("current_color_photo_index"), data.get(
        "color_images_dict")
    c_dict[colors[idx]]["gallery"].append(message.photo[-1].file_id)
    await state.update_data(color_images_dict=c_dict)
    await message.answer(
        f"✅ Додано в галерею ({len(c_dict[colors[idx]]['gallery'])}). Надішліть ще або натисніть «Готово».")


@router.callback_query(F.data == "col_gallery_done", AddProductStates.waiting_for_color_gallery_photos)
async def col_gallery_done_cb(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    colors, idx = data.get("selected_colors"), data.get("current_color_photo_index") + 1
    try:
        await callback.message.delete()
    except Exception:
        pass

    if idx < len(colors):
        await state.update_data(current_color_photo_index=idx)
        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        await callback.message.answer(f"🖼 Надішліть головне фото для кольору **{colors[idx]}**:",
                                      reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                                          [InlineKeyboardButton(text="⏭ Пропустити",
                                                                callback_data="skip_col_main_photo")]]))
    else:
        await state.set_state(AddProductStates.waiting_for_description)
        await callback.message.answer("📝 Введіть короткий опис товару:")
    await callback.answer()


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть головне фото каталогу:")


@router.message(AddProductStates.waiting_for_img, F.photo)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(img=message.photo[-1].file_id, gallery_list=[])
    await state.set_state(AddProductStates.waiting_for_gallery)
    await message.answer("📸 Надішліть додаткові загальні фото або завершіть:", reply_markup=InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⏭ Завершити створення", callback_data="skip_general_gallery")]]))


@router.callback_query(F.data == "skip_general_gallery", AddProductStates.waiting_for_gallery)
async def save_prod_cb(callback: CallbackQuery, state: FSMContext):
    try:
        await callback.message.delete()
    except Exception:
        pass
    await save_product_to_db(callback.message, state)
    await callback.answer()


@router.message(AddProductStates.waiting_for_gallery, F.photo)
async def add_gen_gal(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    g = data.get("gallery_list", [])
    g.append(message.photo[-1].file_id)
    await state.update_data(gallery_list=g)
    await message.answer(f"✅ Додано ({len(g)}). Надішліть ще або `/done` для збереження.")


@router.message(AddProductStates.waiting_for_gallery, F.text)
async def finish_prod_text(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await save_product_to_db(message, state)


async def save_product_to_db(message: Message, state: FSMContext):
    data = await state.get_data()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
                   INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img,
                                         gallery, specs, color_images, color_quantities)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   """, (
                       "prod-" + str(uuid.uuid4())[:8], data.get("brand"), data.get("title"), data.get("price"),
                       data.get("tag", ""), data.get("category"), sum(data.get("color_quantities_dict", {}).values()),
                       ", ".join(data.get("selected_colors", [])), data.get("description"), data.get("img"),
                       json.dumps(data.get("gallery_list", []), ensure_ascii=False),
                       json.dumps(data.get("specs", []), ensure_ascii=False),
                       json.dumps(data.get("color_images_dict", {}), ensure_ascii=False),
                       json.dumps(data.get("color_quantities_dict", {}), ensure_ascii=False)
                   ))
    conn.commit()
    cursor.close()
    conn.close()
    await state.clear()
    await message.answer("🎉 Товар успішно створено та додано в базу! Напишіть /admin.")


@router.callback_query(F.data.startswith("delete_prod_"))
async def process_delete_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (callback.data.replace("delete_prod_", ""),))
    conn.commit()
    cursor.close()
    conn.close()
    await callback.message.answer("🗑 Товар успішно видалено!")
    await callback.answer()


async def main():
    bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=10000, log_level="info"))
    await asyncio.gather(bot.get_updates(offset=-1), dp.start_polling(bot), server.serve())


if __name__ == "__main__":
    asyncio.run(main())