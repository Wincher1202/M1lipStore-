import asyncio
import json
import logging
import os
import uuid
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
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
BACKEND_URL = os.environ.get("BACKEND_URL", "https://your-backend-service.onrender.com")

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
    conn.commit()
    cursor.close()
    conn.close()


init_db()


def wrap_image_url(file_id: str) -> str:
    if not file_id:
        return ""
    if file_id.startswith("http"):
        return file_id
    return f"{BACKEND_URL}/api/image/{file_id}"


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
        # Wrap main image
        if p.get("img"):
            p["img"] = wrap_image_url(p["img"])

        # Wrap gallery
        try:
            gal = json.loads(p["gallery"]) if p.get("gallery") else []
            p["gallery"] = [wrap_image_url(f) for f in gal]
        except Exception:
            p["gallery"] = []

        # Wrap specs
        try:
            p["specs"] = json.loads(p["specs"]) if p.get("specs") else []
        except Exception:
            p["specs"] = []

        # Wrap color quantities
        try:
            p["colorQuantities"] = json.loads(p["color_quantities"]) if p.get("color_quantities") else {}
        except Exception:
            p["colorQuantities"] = {}

        # Wrap color images
        try:
            ci = json.loads(p["color_images"]) if p.get("color_images") else {}
            wrapped_ci = {}
            for col, data in ci.items():
                if isinstance(data, dict):
                    wrapped_ci[col] = {
                        "main": wrap_image_url(data.get("main", "")),
                        "gallery": [wrap_image_url(f) for f in data.get("gallery", [])]
                    }
                elif isinstance(data, str):
                    wrapped_ci[col] = {"main": wrap_image_url(data), "gallery": []}
            p["colorImages"] = wrapped_ci
        except Exception:
            p["colorImages"] = {}

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


@app.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API is running!"}


@app.get("/api/products")
async def get_products():
    return get_db_products()


@app.get("/api/image/{file_id}")
async def proxy_image(file_id: str):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.telegram.org/bot{TOKEN}/getFile?file_id={file_id}")
        if r.status_code == 200:
            data = r.json()
            if data.get("ok"):
                file_path = data["result"]["file_path"]
                return RedirectResponse(url=f"https://api.telegram.org/file/bot{TOKEN}/{file_path}")
    return {"error": "Image not found"}


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
    waiting_for_color_photos = State()
    waiting_for_description = State()
    waiting_for_img = State()


@router.message(Command("start"))
async def cmd_start(message: Message):
    shop_reply_keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🛍 Відкрити M1lipStore",
                                  web_app=WebAppInfo(url="https://wincher1202.github.io/M1lipStore-/"))]],
        resize_keyboard=True,
    )
    await message.answer(
        "Привіт! 👋 Вітаємо в **M1lipStore**.\n\nНатисни кнопку нижче, щоб відкрити каталог:",
        reply_markup=shop_reply_keyboard,
        parse_mode="Markdown",
    )


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ У вас немає прав доступу.")
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
        "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар або створіть новий:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons),
        parse_mode="Markdown"
    )


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
    await state.update_data(category=callback.data.replace("cat_", ""), specs=[])
    await state.set_state(AddProductStates.waiting_for_specs)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer("⚙️ Введіть характеристики (або надішліть `/done` щоб пропустити):")
    await callback.answer()


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    if message.text.strip().lower() == '/done':
        await state.set_state(AddProductStates.waiting_for_colors)
        await message.answer(
            "🎨 Напишіть колір та кількість у форматі `Колір: Кількість` (наприклад: `Білий: 5`). Або просто надішліть назву кольору та кількість:",
            parse_mode="Markdown")
        return
    data = await state.get_data()
    specs = data.get("specs", [])
    text = message.text.strip()
    specs.append({"label": "Характеристика", "value": text})
    await state.update_data(specs=specs)
    await message.answer("⚙️ Наступна характеристика (або `/done`):")


@router.message(AddProductStates.waiting_for_colors)
async def process_colors_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    text = message.text.strip()
    # Parse format "Колір: Кількість" or fallback to default quantity 10
    color_name = text
    qty = 10
    if ":" in text:
        parts = text.split(":", 1)
        color_name = parts[0].strip()
        try:
            qty = int(parts[1].strip())
        except ValueError:
            pass

    await state.update_data(selected_color=color_name, color_quantities_dict={color_name: qty}, color_images_dict={})
    await state.set_state(AddProductStates.waiting_for_color_photos)
    await message.answer(
        f"📸 Тепер просто кидайте фото для кольору **{color_name}** (можете кинути одразу групою/альбомом). Як закінчите з цим кольором, натисніть кнопку нижче:",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="✅ Готово (Далі)", callback_data="color_photos_done")]]),
        parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_color_photos, F.photo)
async def collect_color_photos(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    c_dict = data.get("color_images_dict", {})
    color_name = data.get("selected_color", "Основний")

    if color_name not in c_dict:
        c_dict[color_name] = {"main": "", "gallery": []}

    file_id = message.photo[-1].file_id
    if not c_dict[color_name]["main"]:
        c_dict[color_name]["main"] = file_id
    else:
        c_dict[color_name]["gallery"].append(file_id)

    await state.update_data(color_images_dict=c_dict)
    await message.answer(
        f"✅ Фото прийнято! (Головних: {1 if c_dict[color_name]['main'] else 0}, Галерея: {len(c_dict[color_name]['gallery'])})")


@router.callback_query(F.data == "color_photos_done", AddProductStates.waiting_for_color_photos)
async def color_photos_done_cb(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AddProductStates.waiting_for_description)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer("📝 Введіть короткий опис товару:")
    await callback.answer()


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть головне фото каталогу (або останнє з завантажених):")


@router.message(AddProductStates.waiting_for_img, F.photo)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(img=message.photo[-1].file_id, gallery_list=[])
    await save_product_to_db(message, state)


async def save_product_to_db(message: Message, state: FSMContext):
    data = await state.get_data()
    conn = get_db_connection()
    cursor = conn.cursor()

    color_images = data.get("color_images_dict", {})
    color_quantities = data.get("color_quantities_dict", {})
    total_qty = sum(color_quantities.values()) if color_quantities else 10
    colors_str = ", ".join(color_quantities.keys()) if color_quantities else "Стандартний"

    cursor.execute("""
                   INSERT INTO products (id, brand, title, price, tag, category, quantity, colors, description, img,
                                         gallery, specs, color_images, color_quantities)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   """, (
                       "prod-" + str(uuid.uuid4())[:8],
                       data.get("brand", ""),
                       data.get("title", ""),
                       data.get("price", 0),
                       data.get("tag", ""),
                       data.get("category", "Миші"),
                       total_qty,
                       colors_str,
                       data.get("description", ""),
                       data.get("img", ""),
                       json.dumps([], ensure_ascii=False),
                       json.dumps(data.get("specs", []), ensure_ascii=False),
                       json.dumps(color_images, ensure_ascii=False),
                       json.dumps(color_quantities, ensure_ascii=False)
                   ))
    conn.commit()
    cursor.close()
    conn.close()
    await state.clear()
    await message.answer("🎉 Товар успішно створено та додано в базу з усіма фото! Напишіть /admin.")


@router.callback_query(F.data.startswith("manage_"))
async def process_manage_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("manage_", "")
    product = next((p for p in get_db_products() if p["id"] == product_id), None)
    if not product:
        await callback.answer("Товар не знайдено!")
        return

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Видалити товар", callback_data=f"delete_prod_{product_id}")],
        [InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")]
    ])
    await callback.message.answer(f"🛠 Керування: {product.get('brand')} {product['title']}", reply_markup=action_markup)
    await callback.answer()


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
    await callback.message.answer("⚙️ Панель адміністратора:",
                                  reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons))
    await callback.answer()


@router.callback_query(F.data.startswith("delete_prod_"))
async def process_delete_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (callback.data.replace("delete_prod_", ""),))
    conn.commit()
    cursor.close()
    conn.close()
    await callback.message.answer("🗑 Товар видалено!")
    await callback.answer()


async def main():
    bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=10000, log_level="info"))
    await asyncio.gather(bot.get_updates(offset=-1), dp.start_polling(bot), server.serve())


if __name__ == "__main__":
    asyncio.run(main())