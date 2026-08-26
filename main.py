import asyncio
import json
import logging
import os
import sqlite3
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

TOKEN = "8993086388:AAETWcnRI-uxvm-lI2r6mQCKIXtuXq0nwpo"
MANAGER_USERNAME = "lnvinciblee"
ADMIN_IDS = [1929165295, 1248134309]

DB_NAME = "store.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS products
                   (
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
    conn.close()


init_db()


def get_db_products():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products")
    rows = cursor.fetchall()
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
    waiting_for_qty = State()
    waiting_for_specs = State()
    waiting_for_colors = State()
    waiting_for_color_photo = State()
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
            f"{urllib.parse.quote(f'Добрий день, бажаю оформити замовлення:\n{items_list_str}\n\nЗагальна сума: {total_price} UAH')}"
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


async def main():
    logging.basicConfig(level=logging.INFO)
    bot = Bot(token=TOKEN)
    dp = Dispatcher()

    dp.include_router(router)
    await bot.delete_webhook(drop_pending_updates=True)

    asyncio.create_task(dp.start_polling(bot))
    print("Telegram-бот успішно запущено!")

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())