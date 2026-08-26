import asyncio
import json
import logging
import os
import sqlite3
import urllib.parse
from fastapi import FastAPI, HTTPException
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

# Токени та налаштування
TOKEN = "8993086388:AAETWcnRI-uxvm-lI2r6mQCKIXtuXq0nwpo"
MANAGER_USERNAME = "lnvinciblee"
ADMIN_IDS = [1929165295, 1248134309]

# --- РОБОТА З БАЗОЮ ДАНИХ (SQLite) ---
DB_NAME = "store.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS products
                   (
                       id
                       TEXT
                       PRIMARY
                       KEY,
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
                       img
                       TEXT,
                       gallery
                       TEXT
                   )
                   """)
    conn.commit()

    # Додаємо початкові товари, якщо база порожня
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        initial_products = [
            ("attack-shark-r5-ultra", "R5 ULTRA", 2945, "ХІТ / 8KHZ", "Миші", 12,
             "attack-shark-r5-ultra-colors-price.jpg",
             "attack-shark-r5-ultra-colors-price.jpg,attack-shark-r5-ultra-in-hand-setup.jpg"),
            ("mchose-a7-v2", "A7 V2 PRO", 4599, "БЕСТСЕЛЕР", "Миші", 5,
             "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
             "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80"),
            ("atk-xsoft", "XSOFT GAMING MAT", 1499, "НОВИНКА", "Аксесуари", 25,
             "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80",
             "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80"),
            ("aula-f75", "F75 MECHANICAL", 3899, "ПОПУЛЯРНЕ", "Клавіатури", 0,
             "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
             "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80")
        ]
        cursor.executemany("INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?)", initial_products)
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
    return [dict(row) for row in rows]


# Ініціалізація FastAPI та роутера бота
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


# --- СТАНИ ДЛЯ FSM (Адмін-панель) ---
class AdminStates(StatesGroup):
    waiting_for_tag_text = State()
    waiting_for_price = State()
    waiting_for_title = State()
    waiting_for_quantity = State()
    waiting_for_category = State()
    waiting_for_img = State()


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


# --- АДМІН-ПАНЕЛЬ ---

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
                text=f"{product['title']} | {product['price']} ₴ | {stock_status}",
                callback_data=f"manage_{product['id']}"
            )
        ])

    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore** (База даних SQLite)\n\n"
        "Оберіть товар, який хочете відредагувати:",
        reply_markup=admin_markup,
        parse_mode="Markdown"
    )


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
            InlineKeyboardButton(text="🖼 Фото / Головна", callback_data=f"set_img_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")
        ]
    ])

    await callback.message.edit_text(
        f"🛠 Керування товаром: **{product['title']}**\n\n"
        f"• Категорія: {product['category']}\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product['tag']}`\n"
        f"• На складі: **{product['quantity']} шт.**\n"
        f"• Головне фото: `{product['img']}`\n\n"
        f"Що бажаєте змінити?",
        reply_markup=action_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


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
                text=f"{product['title']} | {product['price']} ₴ | {stock_status}",
                callback_data=f"manage_{product['id']}"
            )
        ])
    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    await callback.message.edit_text(
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар, який хочете відредагувати:",
        reply_markup=admin_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


# Редагування тегу
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

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET tag = ? WHERE id = ?", (new_val, product_id))
    conn.commit()
    conn.close()

    await message.answer("✅ Тег успішно оновлено! Напишіть /admin.")
    await state.clear()


# Редагування ціни
@router.callback_query(F.data.startswith("set_price_"))
async def process_set_price(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_price_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_price)
    await callback.message.answer("💰 Введіть нову ціну (тільки число, наприклад `3200`):")
    await callback.answer()


@router.message(AdminStates.waiting_for_price)
async def save_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    try:
        new_price = int(message.text.strip())
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET price = ? WHERE id = ?", (new_price, product_id))
        conn.commit()
        conn.close()
        await message.answer(f"✅ Ціну змінено на {new_price} ₴! Напишіть /admin.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть числове значення ціни:")


# Редагування назви
@router.callback_query(F.data.startswith("set_title_"))
async def process_set_title(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_title_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_title)
    await callback.message.answer("✏️ Введіть нову назву товару:")
    await callback.answer()


@router.message(AdminStates.waiting_for_title)
async def save_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_title = message.text.strip()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET title = ? WHERE id = ?", (new_title, product_id))
    conn.commit()
    conn.close()

    await message.answer(f"✅ Назву змінено на **{new_title}**! Напишіть /admin.", parse_mode="Markdown")
    await state.clear()


# Редагування наявності (кількості)
@router.callback_query(F.data.startswith("set_qty_"))
async def process_set_qty(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_qty_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_quantity)
    await callback.message.answer("📦 Введіть доступну кількість на складі (ціле число):")
    await callback.answer()


@router.message(AdminStates.waiting_for_quantity)
async def save_quantity(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    try:
        new_qty = int(message.text.strip())
        if new_qty < 0: raise ValueError()
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET quantity = ? WHERE id = ?", (new_qty, product_id))
        conn.commit()
        conn.close()
        await message.answer(f"✅ Кількість на складі змінено на {new_qty} шт.! Напишіть /admin.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть додатне ціле число або 0:")


# Редагування категорії
@router.callback_query(F.data.startswith("set_cat_"))
async def process_set_cat(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_cat_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_category)
    await callback.message.answer(
        "📁 Введіть нову категорію (наприклад: `Миші`, `Клавіатури`, `Гарнітури`, `Аксесуари`):", parse_mode="Markdown")
    await callback.answer()


@router.message(AdminStates.waiting_for_category)
async def save_category(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_cat = message.text.strip()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET category = ? WHERE id = ?", (new_cat, product_id))
    conn.commit()
    conn.close()

    await message.answer(f"✅ Категорію змінено на **{new_cat}**! Напишіть /admin.", parse_mode="Markdown")
    await state.clear()


# Редагування головного фото / посилання
@router.callback_query(F.data.startswith("set_img_"))
async def process_set_img(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("set_img_", "")
    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_img)
    await callback.message.answer("🖼 Введіть пряме посилання на нове головне зображення (URL або назву файлу):")
    await callback.answer()


@router.message(AdminStates.waiting_for_img)
async def save_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_img = message.text.strip()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET img = ?, gallery = ? WHERE id = ?", (new_img, new_img, product_id))
    conn.commit()
    conn.close()

    await message.answer("✅ Головне фото успішно оновлено! Напишіть /admin.")
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
    print("Telegram-бот запущено і готовий до роботи з SQLite!")

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())