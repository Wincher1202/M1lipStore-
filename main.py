import asyncio
import json
import logging
import os
import random
import uuid
import re
from fastapi import FastAPI, Request, APIRouter
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
                   CREATE TABLE IF NOT EXISTS orders
                   (
                       id
                       SERIAL
                       PRIMARY
                       KEY,
                       order_id
                       TEXT,
                       data
                       JSONB,
                       created_at
                       TIMESTAMP
                       DEFAULT
                       CURRENT_TIMESTAMP
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


# Допоміжна функція для конвертації Telegram file_id у пряме URL-посилання
async def get_file_url(bot: Bot, file_id: str) -> str:
    if not file_id:
        return ""
    # Якщо це вже посилання (наприклад, пропущено або введено вручну)
    if file_id.startswith("http"):
        return file_id
    try:
        file_info = await bot.get_file(file_id)
        return f"https://api.telegram.org/file/bot{TOKEN}/{file_info.file_path}"
    except Exception as e:
        logging.error(f"Error getting file URL for {file_id}: {e}")
        return file_id


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()


@api_router.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API is running!"}


@api_router.get("/api/products")
async def get_products():
    return get_db_products()


@api_router.post("/api/orders")
async def create_order(request: Request):
    data = await request.json()
    order_id_str = f"MLP-2026-{random.randint(100000, 999999)}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO orders (order_id, data) VALUES (%s, %s)",
        (order_id_str, json.dumps(data))
    )
    conn.commit()
    cursor.close()
    conn.close()

    try:
        bot_notify = Bot(token=TOKEN)
        customer = data.get("customer", {})
        items = data.get("items", [])
        totals = data.get("totals", 0)
        delivery = data.get("delivery", {})
        payment = data.get("payment", {})

        items_str = "\n".join(
            [
                f"• {i.get('brand', '')} {i.get('title', '')} ({i.get('color', '')}) x {i['qty']} — {i['price'] * i['qty']} ₴"
                for i in items]
        )

        msg_text = (
            f"🚨 *Нове замовлення #{order_id_str}*!\n\n"
            f"👤 *Клієнт:* {customer.get('firstName')} {customer.get('lastName')} ({customer.get('phone')})\n"
            f"💬 *Telegram:* {customer.get('telegram', 'не вказано')}\n\n"
            f"📦 *Товари:*\n{items_str}\n\n"
            f"🚚 *Доставка:* Нова пошта, м. {delivery.get('city')}, відділення: {delivery.get('department')}\n"
            f"💳 *Оплата:* {payment.get('method')}\n"
            f"💰 *Сума до сплати:* *{totals} ₴*\n"
            f"📝 *Коментар:* {data.get('comment', 'відсутній')}"
        )

        for admin_id in ADMIN_IDS:
            await bot_notify.send_message(admin_id, msg_text, parse_mode="Markdown")
        await bot_notify.session.close()
    except Exception as e:
        logging.error(f"Error sending order notification: {e}")

    return {"status": "success", "orderId": order_id_str}


app.include_router(api_router)

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
        f"• Тег: `{product.get('tag') or 'немає'}`\n"
        f"• Загалом на складі: **{product['quantity']} шт.**\n"
        f"• Кольори та наявність: _{colors_info}_\n"
        f"• Блоків характеристик: {specs_count} шт."
    )

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🎨 Кольори та залишки", callback_data=f"edit_colors_{product_id}")
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
        if photo_url and photo_url.startswith("http"):
            await callback.message.answer_photo(photo=photo_url, caption=caption, parse_mode="Markdown",
                                                reply_markup=action_markup)
        else:
            await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    except Exception:
        await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    await callback.answer()


@router.callback_query(F.data.startswith("edit_colors_"))
async def process_edit_colors(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
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
    if callback.from_user.id not in ADMIN_IDS:
        return
    parts = callback.data.replace("ch_cqty_", "").split("_", 1)
    await state.update_data(editing_product_id=parts[0], editing_color_name=parts[1])
    await state.set_state(AdminStates.waiting_for_color_qty_edit)
    await callback.message.answer(f"📦 Введіть нову кількість для кольору **{parts[1]}**:", parse_mode="Markdown")
    await callback.answer()


@router.message(AdminStates.waiting_for_color_qty_edit)
async def save_edited_color_qty(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    try:
        new_q = int(message.text.strip())
        if new_q < 0:
            raise ValueError()

        products = get_db_products()
        product = next((p for p in products if p["id"] == data.get("editing_product_id")), None)
        if product:
            cq = product.get("colorQuantities", {})
            cq[data.get("editing_color_name")] = new_q
            total_qty = sum(cq.values())

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                           (json.dumps(cq, ensure_ascii=False), total_qty, data.get("editing_product_id")))
            conn.commit()
            cursor.close()
            conn.close()

        await message.answer("✅ Кількість оновлено! Напишіть /admin.", parse_mode="Markdown")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


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
    if message.from_user.id not in ADMIN_IDS:
        return
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
        f"✅ Обрано категорію: **{category}**\n\n⚙️ Блок характеристик №1 (наприклад: `Сенсор (PAW3349)`).\n\n*(Коли закінчите, надішліть /done)*",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
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
            colors_list = ["Чорний", "Білий"]
        await state.update_data(selected_colors=colors_list, color_quantities_dict={}, current_color_qty_index=0)
        await state.set_state(AddProductStates.waiting_for_color_qty)
        try:
            await callback.message.delete()
        except Exception:
            pass

        first_color = colors_list[0]
        await callback.message.answer(f"📦 Введіть кількість на складі для кольору **{first_color}** (ціле число):",
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
        if qty < 0:
            raise ValueError()

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
            await state.update_data(
                color_quantities_dict=cq_dict,
                current_color_photo_index=0,
                color_images_dict={}
            )
            await state.set_state(AddProductStates.waiting_for_color_main_photo)

            first_c = colors_list[0]
            skip_markup = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="⏭ Пропустити головне фото", callback_data="skip_col_main_photo")]
            ])
            await message.answer(
                f"🖼 Надішліть **головне фото** для кольору **{first_c}** (або пропустіть):",
                reply_markup=skip_markup,
                parse_mode="Markdown"
            )
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


@router.callback_query(F.data == "skip_col_main_photo", AddProductStates.waiting_for_color_main_photo)
async def skip_col_main_photo_cb(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    ci_dict = data.get("color_images_dict", {})

    current_color = colors_list[idx]
    if current_color not in ci_dict:
        ci_dict[current_color] = {"main": "", "gallery": []}
    else:
        ci_dict[current_color]["main"] = ""

    await state.update_data(color_images_dict=ci_dict)
    await state.set_state(AddProductStates.waiting_for_color_gallery_photos)

    try:
        await callback.message.delete()
    except Exception:
        pass

    done_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Готово (перейти далі)", callback_data="col_gallery_done")]
    ])
    await callback.message.answer(
        f"📸 Надішліть **додаткові фото** для кольору **{current_color}** (можна альбомом або кілька окремо).\n\nКоли закінчите, натисніть кнопку нижче або надішліть `/done`:",
        reply_markup=done_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AddProductStates.waiting_for_color_main_photo, F.photo)
async def process_color_main_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    photo_file_id = message.photo[-1].file_id
    photo_url = await get_file_url(message.bot, photo_file_id)

    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    ci_dict = data.get("color_images_dict", {})

    current_color = colors_list[idx]
    if current_color not in ci_dict:
        ci_dict[current_color] = {"main": photo_url, "gallery": []}
    else:
        ci_dict[current_color]["main"] = photo_url

    await state.update_data(color_images_dict=ci_dict)
    await state.set_state(AddProductStates.waiting_for_color_gallery_photos)

    done_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Готово (перейти далі)", callback_data="col_gallery_done")]
    ])
    await message.answer(
        f"📸 Надішліть **додаткові фото** для кольору **{current_color}** (можна альбомом або кілька окремо).\n\nКоли закінчите, натисніть кнопку нижче або надішліть `/done`:",
        reply_markup=done_markup,
        parse_mode="Markdown"
    )


album_cache = {}


@router.message(AddProductStates.waiting_for_color_gallery_photos, F.photo)
async def process_color_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    photo_file_id = message.photo[-1].file_id
    photo_url = await get_file_url(message.bot, photo_file_id)

    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    current_color = colors_list[idx]

    ci_dict = data.get("color_images_dict", {})
    if current_color not in ci_dict:
        ci_dict[current_color] = {"main": "", "gallery": []}

    if message.media_group_id:
        if message.media_group_id not in album_cache:
            album_cache[message.media_group_id] = []
        album_cache[message.media_group_id].append(photo_url)

        await asyncio.sleep(0.7)
        photos = album_cache.pop(message.media_group_id, None)
        if not photos:
            return

        ci_dict[current_color]["gallery"].extend(photos)
        await state.update_data(color_images_dict=ci_dict)

        await message.answer(
            f"✅ Додано фото в галерею кольору **{current_color}** (всього: {len(ci_dict[current_color]['gallery'])}).\nНадішліть ще або натисніть «Готово».",
            parse_mode="Markdown"
        )
    else:
        ci_dict[current_color]["gallery"].append(photo_url)
        await state.update_data(color_images_dict=ci_dict)

        await message.answer(
            f"✅ Додано фото в галерею кольору **{current_color}** (всього: {len(ci_dict[current_color]['gallery'])}).\nНадішліть ще або натисніть «Готово».",
            parse_mode="Markdown"
        )


@router.callback_query(F.data == "col_gallery_done", AddProductStates.waiting_for_color_gallery_photos)
async def col_gallery_done_cb(callback: CallbackQuery, state: FSMContext):
    await advance_to_next_color_or_desc(callback.message, state, from_callback=True, callback_query=callback)


@router.message(AddProductStates.waiting_for_color_gallery_photos, F.text)
async def col_gallery_text_done(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    text = message.text.strip().lower()
    if text in ['/done', 'готово', 'пропустити', 'далі']:
        await advance_to_next_color_or_desc(message, state, from_callback=False)
    else:
        await message.answer("❌ Будь ласка, надішліть фото або натисніть кнопку «Готово» / надішліть `/done`.")


async def advance_to_next_color_or_desc(message_or_callback_msg, state: FSMContext, from_callback=False,
                                        callback_query=None):
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)

    if from_callback and callback_query:
        try:
            await callback_query.message.delete()
        except Exception:
            pass
        target_msg = callback_query.message
    else:
        target_msg = message_or_callback_msg

    idx += 1
    if idx < len(colors_list):
        await state.update_data(current_color_photo_index=idx)
        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        next_color = colors_list[idx]

        skip_markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="⏭ Пропустити головне фото", callback_data="skip_col_main_photo")]
        ])
        await target_msg.answer(
            f"🖼 Надішліть **головне фото** для наступного кольору — **{next_color}** (або пропустіть):",
            reply_markup=skip_markup,
            parse_mode="Markdown"
        )
        if callback_query:
            await callback_query.answer()
    else:
        await state.set_state(AddProductStates.waiting_for_description)
        await target_msg.answer("📝 Введіть короткий опис товару:", parse_mode="Markdown")
        if callback_query:
            await callback_query.answer()


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть **головне фото** товару (це буде головне фото каталогу №1):",
                         parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_img, F.photo)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    main_photo_id = message.photo[-1].file_id
    main_photo_url = await get_file_url(message.bot, main_photo_id)

    await state.update_data(img=main_photo_url)
    await state.set_state(AddProductStates.waiting_for_gallery)

    skip_gal_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⏭ Пропустити / Завершити", callback_data="skip_general_gallery")]
    ])
    await message.answer(
        "📸 Надішліть загальні додаткові фото для галереї (можете надіслати альбомом або кілька окремо), або натисніть «Пропустити»:",
        reply_markup=skip_gal_markup,
        parse_mode="Markdown"
    )


@router.callback_query(F.data == "skip_general_gallery", AddProductStates.waiting_for_gallery)
async def skip_general_gallery_cb(callback: CallbackQuery, state: FSMContext):
    try:
        await callback.message.delete()
    except Exception:
        pass
    await save_product_to_db(callback.message, state, gallery_list=[])
    await callback.answer()


@router.message(AddProductStates.waiting_for_gallery, F.photo)
async def add_general_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    photo_file_id = message.photo[-1].file_id
    photo_url = await get_file_url(message.bot, photo_file_id)

    data = await state.get_data()
    gallery_list = data.get("gallery_list", [])

    if message.media_group_id:
        if message.media_group_id not in album_cache:
            album_cache[message.media_group_id] = []
        album_cache[message.media_group_id].append(photo_url)

        await asyncio.sleep(0.7)
        photos = album_cache.pop(message.media_group_id, None)
        if not photos:
            return

        gallery_list.extend(photos)
        await state.update_data(gallery_list=gallery_list)
        await message.answer(
            f"✅ Додано фото в загальну галерею ({len(gallery_list)}). Надішліть ще або напишіть /done щоб зберегти товар."
        )
    else:
        gallery_list.append(photo_url)
        await state.update_data(gallery_list=gallery_list)
        await message.answer(
            f"✅ Додано фото в загальну галерею ({len(gallery_list)}). Надішліть ще або напишіть /done щоб зберегти товар."
        )


@router.message(AddProductStates.waiting_for_gallery, F.text)
async def add_general_gallery_text(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    gallery_list = data.get("gallery_list", [])

    text_content = message.text.strip().lower()
    if text_content in ['/done', 'пропустити', 'готово', 'далі']:
        pass
    else:
        specs_gal = [g.strip() for g in message.text.split(",") if g.strip()]
        gallery_list.extend(specs_gal)

    await save_product_to_db(message, state, gallery_list=gallery_list)


async def save_product_to_db(message: Message, state: FSMContext, gallery_list=None):
    if gallery_list is None:
        data = await state.get_data()
        gallery_list = data.get("gallery_list", [])

    data = await state.get_data()

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

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
                   INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img,
                                         gallery, specs, color_images, color_quantities)
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
    await message.answer(
        f"🎉 Товар **{brand} {title}** успішно створено та додано в базу з усіма посиланнями на фото!\n\nНапишіть /admin для керування.",
        parse_mode="Markdown"
    )


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