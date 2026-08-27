import asyncio
import json
import logging
import os
import urllib.parse
from fastapi import FastAPI, Request
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


@app.post("/api/orders")
async def create_order(request: Request):
    data = await request.json()
    import random
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

    # Надсилання сповіщення адмінам в Telegram
    try:
        bot = Bot(token=TOKEN)
        customer = data.get("customer", {})
        items = data.get("items", [])
        totals = data.get("totals", 0)
        delivery = data.get("delivery", {})
        payment = data.get("payment", {})

        items_str = "\n".join(
            [f"• {i['brand']} {i['title']} ({i.get('color', '')}) x {i['qty']} — {i['price'] * i['qty']} ₴" for i in
             items])

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
            await bot.send_message(admin_id, msg_text, parse_mode="Markdown")
        await bot.session.close()
    except Exception as e:
        logging.error(f"Error sending order notification: {e}")

    return {"status": "success", "orderId": order_id_str}


async def get_file_url(bot: Bot, file_id: str) -> str:
    if not file_id:
        return ""
    try:
        file = await bot.get_file(file_id)
        if file and file.file_path:
            return f"https://api.telegram.org/file/bot{TOKEN}/{file.file_path}"
    except Exception as e:
        logging.error(f"Error getting file URL for {file_id}: {e}")
    return file_id


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

    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для керування:",
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
    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    try:
        await callback.message.delete()
    except Exception:
        pass

    await callback.message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для керування:",
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

    brand_text = product.get('brand', '')
    title_text = product.get('title', '')
    category_text = product.get('category', 'Не вказано')
    price_val = product.get('price', 0)
    tag_val = product.get('tag') or 'немає'
    qty_val = product.get('quantity', 0)

    caption = (
        f"🛠 *Керування товаром:* {brand_text} {title_text}\n\n"
        f"• Бренд: {brand_text or 'не вказано'}\n"
        f"• Категорія: {category_text}\n"
        f"• Ціна: {price_val} ₴\n"
        f"• Тег: `{tag_val}`\n"
        f"• Загалом на складі: *{qty_val} шт.*\n"
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
        if callback.message.photo:
            await callback.message.edit_caption(caption=caption, parse_mode="Markdown", reply_markup=action_markup)
        else:
            await callback.message.edit_text(text=caption, parse_mode="Markdown", reply_markup=action_markup)
    except Exception as e:
        logging.error(f"Error updating admin message: {e}")
        await callback.message.answer(caption, parse_mode="Markdown", reply_markup=action_markup)
    await callback.answer()


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

    await callback.answer("Товар успішно видалено!", show_alert=True)
    await process_back_to_admin(callback)


bot = Bot(token=TOKEN)
dp = Dispatcher()
dp.include_router(router)
app.include_router(router)


async def main():
    os.system("cls" if os.name == "nt" else "clear")
    logging.info("Starting Bot and FastAPI server...")

    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server = uvicorn.Server(config)

    await asyncio.gather(
        server.serve(),
        dp.start_polling(bot)
    )


if __name__ == "__main__":
    asyncio.run(main())