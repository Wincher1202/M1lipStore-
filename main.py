import asyncio
import json
import logging
import os
import urllib.parse
from fastapi import FastAPI, Response
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

# Токени
TOKEN = "8993086388:AAETWcnRI-uxvm-lI2r6mQCKIXtuXq0nwpo"
PAYMENT_TOKEN = "1877036958:TEST:3ee3e1f439bade2f14881b4f9a87c61392fa6ec6"

MANAGER_USERNAME = "lnvinciblee"

# Твій Telegram ID адміністратора
ADMIN_IDS = [1929165295,1248134309]

# Ініціалізація FastAPI та роутера бота
app = FastAPI()

# Налаштування CORS, щоб сайт з GitHub міг робити запити до цього сервера
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = Router()

# База даних товарів у пам'яті бота (єдина для сайту і бота)
PRODUCTS_DB = [
    {
        "id": "attack-shark-r5-ultra",
        "title": "R5 ULTRA",
        "price": 2945,
        "tag": "ХІТ / 8KHZ"
    },
    {
        "id": "mchose-a7-v2",
        "title": "A7 V2 PRO",
        "price": 4599,
        "tag": "БЕСТСЕЛЕР"
    },
    {
        "id": "atk-xsoft",
        "title": "XSOFT GAMING MAT",
        "price": 1499,
        "tag": "НОВИНКА"
    },
    {
        "id": "aula-f75",
        "title": "F75 MECHANICAL",
        "price": 3899,
        "tag": "ПОПУЛЯРНЕ"
    }
]


# Ендпоінт для сайту: віддає поточний список товарів у форматі JSON
@app.get("/api/products")
async def get_products():
    return PRODUCTS_DB


# Стани для FSM
class AdminStates(StatesGroup):
    waiting_for_tag_text = State()
    waiting_for_price = State()
    waiting_for_title = State()


# 1. Команда /start
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

    keyboard_buttons = []
    for product in PRODUCTS_DB:
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"📦 {product['title']} | {product['price']} ₴",
                callback_data=f"manage_{product['id']}"
            )
        ])

    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    await message.answer(
        "⚙️ **Панель адміністратора M1lipStore**\n\n"
        "Оберіть товар, який хочете відредагувати:",
        reply_markup=admin_markup,
        parse_mode="Markdown"
    )


# Вибір конкретного товару для керування
@router.callback_query(F.data.startswith("manage_"))
async def process_manage_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("manage_", "")
    product = next((p for p in PRODUCTS_DB if p["id"] == product_id), None)

    if not product:
        await callback.answer("Товар не знайдено!", show_alert=True)
        return

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏷 Змінити тег", callback_data=f"set_tag_{product_id}"),
            InlineKeyboardButton(text="💰 Змінити ціну", callback_data=f"set_price_{product_id}")
        ],
        [
            InlineKeyboardButton(text="✏️ Змінити назву", callback_data=f"set_title_{product_id}"),
            InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")
        ]
    ])

    await callback.message.edit_text(
        f"🛠 Керування товаром: **{product['title']}**\n\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product['tag']}`\n\n"
        f"Що бажаєте змінити?",
        reply_markup=action_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


# Повернення до списку
@router.callback_query(F.data == "back_to_admin")
async def process_back_to_admin(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return

    keyboard_buttons = []
    for product in PRODUCTS_DB:
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"📦 {product['title']} | {product['price']} ₴",
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


# --- ЗМІНА ТЕГУ ---
@router.callback_query(F.data.startswith("set_tag_"))
async def process_set_tag(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("set_tag_", "")
    product = next((p for p in PRODUCTS_DB if p["id"] == product_id), None)

    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_tag_text)

    await callback.message.answer(
        f"📝 Введіть новий тег для **{product['title']}**\n"
        f"(Наприклад: `🔥 ХІТ`, `СУПЕРЦІНА` або `-` щоб видалити):",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AdminStates.waiting_for_tag_text)
async def save_tag(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_val = message.text.strip()

    for p in PRODUCTS_DB:
        if p["id"] == product_id:
            p["tag"] = "" if new_val == "-" else new_val
            await message.answer(f"✅ Тег успішно оновлено! Напишіть /admin для продовження.")
            break
    await state.clear()


# --- ЗМІНА ЦІНИ ---
@router.callback_query(F.data.startswith("set_price_"))
async def process_set_price(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("set_price_", "")
    product = next((p for p in PRODUCTS_DB if p["id"] == product_id), None)

    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_price)

    await callback.message.answer(
        f"💰 Введіть нову ціну у гривнях для **{product['title']}** (тільки число, наприклад `3200`):",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AdminStates.waiting_for_price)
async def save_price(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    product_id = data.get("editing_product_id")

    try:
        new_price = int(message.text.strip())
        for p in PRODUCTS_DB:
            if p["id"] == product_id:
                p["price"] = new_price
                await message.answer(f"✅ Ціну для **{p['title']}** змінено на {new_price} ₴! Напишіть /admin.")
                break
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть числове значення ціни (наприклад: 2945). Спробуйте ще раз:")


# --- ЗМІНА НАЗВИ ---
@router.callback_query(F.data.startswith("set_title_"))
async def process_set_title(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("set_title_", "")
    product = next((p for p in PRODUCTS_DB if p["id"] == product_id), None)

    await state.update_data(editing_product_id=product_id)
    await state.set_state(AdminStates.waiting_for_title)

    await callback.message.answer(
        f"✏️ Введіть нову назву для **{product['title']}**:",
        parse_mode="Markdown"
    )
    await callback.answer()


@router.message(AdminStates.waiting_for_title)
async def save_title(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    data = await state.get_data()
    product_id = data.get("editing_product_id")
    new_title = message.text.strip()

    for p in PRODUCTS_DB:
        if p["id"] == product_id:
            p["title"] = new_title
            await message.answer(f"✅ Назву успішно змінено на **{new_title}**! Напишіть /admin.")
            break
    await state.clear()


# --- ОБРОБКА ЗАМОВЛЕНЬ ІЗ САЙТУ ---

@router.message(F.web_app_data)
async def process_web_app_order(message: Message):
    try:
        cart_items = json.loads(message.web_app_data.data)

        if not cart_items:
            await message.answer("Ваш кошик порожній.")
            return

        total_price = sum(item["price"] for item in cart_items)

        items_list_str = "\n".join([
            f"• {item['title']} (колір: {item.get('color', 'не вказано')}) — {item['price']} UAH"
            for item in cart_items
        ])

        manager_url = (
            f"https://t.me/{MANAGER_USERNAME}?text="
            f"{encode_text(f'Добрий день, бажаю оформити замовлення:\n{items_list_str}\nСума: {total_price} UAH')}"
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

    # Запускаємо бота в фоновому режимі asyncio
    asyncio.create_task(dp.start_polling(bot))
    print("Telegram-бот запущен и готов к работе!")

    # Запускаємо FastAPI сервер (Render вимагає порт з змінної середовища або 8000 за замовчуванням)
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())