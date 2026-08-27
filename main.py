import asyncio
import json
import logging
import os
import random
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
ADMIN_IDS = [1929165295, 1248134309]
DATABASE_URL = os.environ.get("DATABASE_URL")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()
router = Router()


def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Таблиця товарів
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
    # Таблиця замовлень із повною структурою CRM
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            created_at TEXT,
            customer TEXT,
            items TEXT,
            delivery TEXT,
            payment TEXT,
            totals INTEGER,
            status TEXT,
            payment_status TEXT,
            tracking_number TEXT,
            manager_comment TEXT,
            history TEXT
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
        for key, field in [("colorImages", "color_images"), ("specs", "specs"), ("colorQuantities", "color_quantities")]:
            try:
                p[key] = json.loads(p[field]) if p.get(field) else ([] if key == "specs" else {})
            except Exception:
                p[key] = [] if key == "specs" else {}
        result.append(p)
    return result


# --- FSM СТАНИ ДЛЯ ДОДАВАННЯ ТОВАРУ ТА ТТН ---
class AddProductStates(StatesGroup):
    waiting_for_id = State()
    waiting_for_brand = State()
    waiting_for_title = State()
    waiting_for_price = State()
    waiting_for_category = State()
    waiting_for_quantity = State()
    waiting_for_img = State()
    waiting_for_description = State()

class OrderEditStates(StatesGroup):
    waiting_for_ttn = State()
    waiting_for_comment = State()


# --- FASTAPI APP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrderSchema(BaseModel):
    customer: dict
    items: list
    delivery: dict
    payment: dict
    totals: int
    comment: str = ""


@app.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API & CRM is running!"}


@app.get("/api/products")
async def get_products():
    return get_db_products()


@app.post("/api/orders")
async def create_order(order: OrderSchema):
    conn = get_db_connection()
    cursor = conn.cursor()

    order_id = f"MLP-2026-{random.randint(100000, 999999)}"
    created_at = datetime.now().strftime("%d.%m.%Y %H:%M")

    initial_history = json.dumps([{
        "time": datetime.now().strftime("%H:%M"),
        "text": "Замовлення створено через WebApp"
    }])

    cursor.execute("""
        INSERT INTO orders (order_id, created_at, customer, items, delivery, payment, totals, status, payment_status, tracking_number, manager_comment, history)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        order_id,
        created_at,
        json.dumps(order.customer),
        json.dumps(order.items),
        json.dumps(order.delivery),
        json.dumps(order.payment),
        order.totals,
        "НОВЕ",
        order.payment.get("status", "pending"),
        "",
        order.comment,
        initial_history
    ))
    conn.commit()
    cursor.close()
    conn.close()

    item_details = "\n".join([f"• {i.get('brand')} {i.get('title')} (Колір: {i.get('color')}) × {i.get('qty')}" for i in order.items])
    admin_text = (
        f"🔔 *НОВЕ ЗАМОВЛЕННЯ #{order_id}*\n\n"
        f"👤 {order.customer.get('firstName')} {order.customer.get('lastName')} ({order.customer.get('phone')})\n\n"
        f"📦 *Товари*:\n{item_details}\n\n"
        f"💰 *Сума*: {order.totals} ₴\n"
        f"🚚 *Доставка*: Нова пошта, м. {order.delivery.get('city')}, відд. {order.delivery.get('department')}\n"
        f"💳 *Оплата*: {order.payment.get('method')}\n"
        f"Статус: *НОВЕ*"
    )

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚙️ Відкрити замовлення", callback_data=f"view_order_{order_id}")],
        [InlineKeyboardButton(text="🚀 В обробку", callback_data=f"set_status_{order_id}_В_ОБРОБЦІ")]
    ])

    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(admin_id, admin_text, parse_mode="Markdown", reply_markup=markup)
        except Exception as e:
            logging.error(f"Не вдалося надіслати сповіщення адміну {admin_id}: {e}")

    return {"status": "success", "orderId": order_id}


# --- AIOGRAM TELEGRAM BOT ТА АДМІН-ПАНЕЛЬ ---

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

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT order_id, totals, status FROM orders ORDER BY created_at DESC LIMIT 5")
    recent_orders = cursor.fetchall()
    cursor.close()
    conn.close()

    orders_list_text = "\n".join([f"• <b>{o['order_id']}</b> | {o['totals']} ₴ | Статус: <i>{o['status']}</i>" for o in recent_orders]) if recent_orders else "Немає замовлень"

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📦 Усі замовлення", callback_data="admin_orders"),
            InlineKeyboardButton(text="🛍 Товари", callback_data="admin_products")
        ],
        [
            InlineKeyboardButton(text="➕ Додати товар", callback_data="add_new_product")
        ]
    ])

    await message.answer(
        f"⚙️ <b>Панель адміністратора M1lipStore</b>\n\n"
        f"<b>Останні замовлення:</b>\n{orders_list_text}",
        reply_markup=keyboard,
        parse_mode="HTML"
    )


@router.callback_query(F.data == "admin_orders")
async def show_admin_orders(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT order_id, totals, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10")
    orders = cursor.fetchall()
    cursor.close()
    conn.close()

    buttons = []
    for o in orders:
        buttons.append([InlineKeyboardButton(text=f"{o['order_id']} | {o['totals']} ₴ | {o['status']}", callback_data=f"view_order_{o['order_id']}")])
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_admin")])

    await callback.message.edit_text("📋 <b>Список замовлень:</b>", reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons), parse_mode="HTML")


@router.callback_query(F.data.startswith("view_order_"))
async def view_single_order(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    order_id = callback.data.replace("view_order_", "")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_id = %s", (order_id,))
    order = cursor.fetchone()
    cursor.close()
    conn.close()

    if not order:
        await callback.answer("Замовлення не знайдено.")
        return

    cust = json.loads(order['customer'])
    items = json.loads(order['items'])
    delivery = json.loads(order['delivery'])
    payment = json.loads(order['payment'])

    items_text = "\n".join([f"• {i.get('brand')} {i.get('title')} (Колір: {i.get('color')}) × {i.get('qty')} — {i.get('price') * i.get('qty')} ₴" for i in items])

    text = (
        f"📋 <b>ЗАМОВЛЕННЯ #{order['order_id']}</b>\n"
        f"Створено: {order['created_at']}\n"
        f"Статус: <b>{order['status']}</b>\n\n"
        f"👤 <b>Покупець</b>:\n{cust.get('firstName')} {cust.get('lastName')} | {cust.get('phone')} | @{cust.get('telegram', 'немає')}\n\n"
        f"📦 <b>Товари</b>:\n{items_text}\n\n"
        f"🚚 <b>Доставка</b>: Нова пошта, м. {delivery.get('city')}, відд. {delivery.get('department')}\n"
        f"💳 <b>Оплата</b>: {payment.get('method')} ({order['payment_status']})\n"
        f"💰 <b>Разом</b>: {order['totals']} ₴\n"
        f"📦 <b>ТТН</b>: {order['tracking_number'] or 'Не вказано'}\n"
        f"💬 <b>Коментар</b>: {order['manager_comment'] or 'Немає'}"
    )

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🚀 В обробку", callback_data=f"set_status_{order_id}_В_ОБРОБЦІ"),
            InlineKeyboardButton(text="📦 Відправлено", callback_data=f"set_status_{order_id}_ВІДПРАВЛЕНО")
        ],
        [
            InlineKeyboardButton(text="✅ Завершено", callback_data=f"set_status_{order_id}_ЗАВЕРШЕНО"),
            InlineKeyboardButton(text="❌ Скасовано", callback_data=f"set_status_{order_id}_СКАСОВАНО")
        ],
        [
            InlineKeyboardButton(text="✏️ Додати ТТН", callback_data=f"edit_ttn_{order_id}"),
            InlineKeyboardButton(text="💬 Коментар", callback_data=f"edit_comm_{order_id}")
        ],
        [InlineKeyboardButton(text="🗑 Видалити замовлення", callback_data=f"delete_order_{order_id}")],
        [InlineKeyboardButton(text="🔙 До списку замовлень", callback_data="admin_orders")]
    ])

    await callback.message.edit_text(text, reply_markup=markup, parse_mode="HTML")


@router.callback_query(F.data.startswith("set_status_"))
async def update_order_status_cb(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    parts = callback.data.split("_")
    order_id = parts[3]
    new_status = parts[4]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET status = %s WHERE order_id = %s", (new_status, order_id))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.answer(f"Статус змінено на {new_status}!")
    await view_single_order(callback)


@router.callback_query(F.data.startswith("delete_order_"))
async def delete_order_cb(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    order_id = callback.data.replace("delete_order_", "")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM orders WHERE order_id = %s", (order_id,))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.answer("Замовлення видалено!")
    await show_admin_orders(callback)


@router.callback_query(F.data.startswith("edit_ttn_"))
async def edit_ttn_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    order_id = callback.data.replace("edit_ttn_", "")
    await state.update_data(order_id=order_id)
    await callback.message.answer("Введіть номер ТТН (номер експрес-накладної Нової пошти):")
    await state.set_state(OrderEditStates.waiting_for_ttn)
    await callback.answer()


@router.message(OrderEditStates.waiting_for_ttn)
async def process_ttn_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    order_id = data.get("order_id")
    ttn = message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET tracking_number = %s WHERE order_id = %s", (ttn, order_id))
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer(f"✅ ТТН для замовлення #{order_id} успішно оновлено на: {ttn}")


@router.callback_query(F.data.startswith("edit_comm_"))
async def edit_comment_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    order_id = callback.data.replace("edit_comm_", "")
    await state.update_data(order_id=order_id)
    await callback.message.answer("Введіть коментар менеджера:")
    await state.set_state(OrderEditStates.waiting_for_comment)
    await callback.answer()


@router.message(OrderEditStates.waiting_for_comment)
async def process_comment_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    order_id = data.get("order_id")
    comment = message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET manager_comment = %s WHERE order_id = %s", (comment, order_id))
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer(f"✅ Коментар для замовлення #{order_id} оновлено!")


# --- УПРАВЛІННЯ ТОВАРАМИ В АДМІНЦІ ---

@router.callback_query(F.data == "admin_products")
async def show_admin_products(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    products = get_db_products()
    buttons = []
    for p in products:
        buttons.append([InlineKeyboardButton(text=f"{p.get('brand')} {p.get('title')} — {p.get('price')} ₴", callback_data=f"prod_info_{p.get('id')}")])
    buttons.append([InlineKeyboardButton(text="➕ Додати товар", callback_data="add_new_product")])
    buttons.append([InlineKeyboardButton(text="🔙 Назад в адмінку", callback_data="back_to_admin")])

    await callback.message.edit_text("🛍 <b>Список товарів у базі:</b>", reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons), parse_mode="HTML")


@router.callback_query(F.data.startswith("prod_info_"))
async def show_single_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    prod_id = callback.data.replace("prod_info_", "")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = %s", (prod_id,))
    p = cursor.fetchone()
    cursor.close()
    conn.close()

    if not p:
        await callback.answer("Товар не знайдено.")
        return

    text = (
        f"📦 <b>Товар: {p['brand']} {p['title']}</b>\n"
        f"ID: <code>{p['id']}</code>\n"
        f"Ціна: {p['price']} ₴\n"
        f"Категорія: {p['category']}\n"
        f"Кількість: {p['quantity']}\n"
        f"Опис: {p['description'] or 'Немає'}"
    )

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🗑 Видалити товар", callback_data=f"del_prod_{p['id']}")],
        [InlineKeyboardButton(text="🔙 До списку товарів", callback_data="admin_products")]
    ])
    await callback.message.edit_text(text, reply_markup=markup, parse_mode="HTML")


@router.callback_query(F.data.startswith("del_prod_"))
async def delete_product_cb(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    prod_id = callback.data.replace("del_prod_", "")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (prod_id,))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.answer("Товар успішно видалено!")
    await show_admin_products(callback)


# --- ПОКРОКОВЕ ДОДАВАННЯ ТОВАРУ (FSM) ---

@router.callback_query(F.data == "add_new_product")
async def add_product_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        return
    await callback.message.answer("Введіть унікальний ID товару (наприклад, <code>ip15-pro-max</code>):", parse_mode="HTML")
    await state.set_state(AddProductStates.waiting_for_id)
    await callback.answer()


@router.message(AddProductStates.waiting_for_id)
async def add_product_id(message: Message, state: FSMContext):
    await state.update_data(id=message.text.strip())
    await message.answer("Введіть бренд товару (наприклад, Apple, Dyson):")
    await state.set_state(AddProductStates.waiting_for_brand)


@router.message(AddProductStates.waiting_for_brand)
async def add_product_brand(message: Message, state: FSMContext):
    await state.update_data(brand=message.text.strip())
    await message.answer("Введіть назву товару (наприклад, iPhone 15 Pro Max):")
    await state.set_state(AddProductStates.waiting_for_title)


@router.message(AddProductStates.waiting_for_title)
async def add_product_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text.strip())
    await message.answer("Введіть ціну товару у гривнях (тільки число, наприклад 45000):")
    await state.set_state(AddProductStates.waiting_for_price)


@router.message(AddProductStates.waiting_for_price)
async def add_product_price(message: Message, state: FSMContext):
    try:
        price = int(message.text.strip())
        await state.update_data(price=price)
        await message.answer("Введіть категорію товару (наприклад, smartphones, dyson, accessories):")
        await state.set_state(AddProductStates.waiting_for_category)
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціну у вигляді числа.")


@router.message(AddProductStates.waiting_for_category)
async def add_product_category(message: Message, state: FSMContext):
    await state.update_data(category=message.text.strip())
    await message.answer("Введіть загальну кількість товару на складі (число):")
    await state.set_state(AddProductStates.waiting_for_quantity)


@router.message(AddProductStates.waiting_for_quantity)
async def add_product_quantity(message: Message, state: FSMContext):
    try:
        qty = int(message.text.strip())
        await state.update_data(quantity=qty)
        await message.answer("Надішліть посилання на зображення товару (URL):")
        await state.set_state(AddProductStates.waiting_for_img)
    except ValueError:
        await message.answer("❌ Введіть кількість у вигляді числа.")


@router.message(AddProductStates.waiting_for_img)
async def add_product_img(message: Message, state: FSMContext):
    await state.update_data(img=message.text.strip())
    await message.answer("Введіть короткий опис товару:")
    await state.set_state(AddProductStates.waiting_for_description)


@router.message(AddProductStates.waiting_for_description)
async def add_product_finish(message: Message, state: FSMContext):
    data = await state.get_data()
    description = message.text.strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img, gallery, specs, color_images, color_quantities)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data['id'],
        data['brand'],
        data['title'],
        data['price'],
        "Новинка",
        data['category'],
        data['quantity'],
        json.dumps([]),
        description,
        data['img'],
        json.dumps([]),
        json.dumps([]),
        json.dumps({}),
        json.dumps({})
    ))
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer(f"✅ Товар <b>{data['brand']} {data['title']}</b> успішно додано до каталогу!", parse_mode="HTML")


@router.callback_query(F.data == "back_to_admin")
async def back_to_admin_cb(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return
    await cmd_admin(callback.message)


dp.include_router(router)


async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())