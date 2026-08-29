import asyncio
import json
import logging
import os
import random
import uuid
import re
import hashlib
import time
import hmac
from urllib.parse import parse_qsl
from fastapi import FastAPI, Request, APIRouter, UploadFile, File, HTTPException
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
    BufferedInputFile,
)
import uvicorn
import psycopg2
from psycopg2.extras import RealDictCursor

from delivery import delivery_service, DeliveryProviderNotConfigured, DeliveryProviderError

# ============================================================================
# SECRETS
# ============================================================================
TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "1929165295,1248134309").split(",") if x.strip()]
ADMIN_PANEL_URL = os.environ.get("ADMIN_PANEL_URL", "https://wincher1202.github.io/M1lipStore-/admin.html")
SHOP_URL = os.environ.get("SHOP_URL", "https://wincher1202.github.io/M1lipStore-/")

DATABASE_URL = os.environ.get("DATABASE_URL")

if not TOKEN:
    logging.warning("BOT_TOKEN is not set. Telegram bot features will not work until it is configured.")

logging.basicConfig(level=logging.INFO)

NAME_RE = re.compile(r"^[A-Za-zА-Яа-яІіЇїЄєҐґ'’\-]{2,40}$", re.UNICODE)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

ORDER_STATUSES = [
    "NEW",
    "WAITING_PAYMENT",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
]
STOCK_HELD_STATUSES = {"NEW", "WAITING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"}


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
                       old_price
                       INTEGER,
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
                       TEXT,
                       sku
                       TEXT,
                       featured
                       BOOLEAN
                       DEFAULT
                       FALSE,
                       popular
                       BOOLEAN
                       DEFAULT
                       FALSE,
                       hidden
                       BOOLEAN
                       DEFAULT
                       FALSE,
                       created_at
                       TIMESTAMP
                       DEFAULT
                       CURRENT_TIMESTAMP
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
                       TEXT
                       UNIQUE,
                       data
                       JSONB,
                       status
                       TEXT
                       NOT
                       NULL
                       DEFAULT
                       'NEW',
                       tracking_number
                       TEXT,
                       admin_comment
                       TEXT,
                       telegram_id
                       BIGINT,
                       total
                       INTEGER
                       NOT
                       NULL
                       DEFAULT
                       0,
                       created_at
                       TIMESTAMP
                       DEFAULT
                       CURRENT_TIMESTAMP,
                       updated_at
                       TIMESTAMP
                       DEFAULT
                       CURRENT_TIMESTAMP
                   )
                   """)
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS user_profiles
                   (
                       telegram_id
                       BIGINT
                       PRIMARY
                       KEY,
                       first_name
                       TEXT,
                       last_name
                       TEXT,
                       phone
                       TEXT,
                       saved_deliveries
                       JSONB
                       NOT
                       NULL
                       DEFAULT
                       '[]',
                       updated_at
                       TIMESTAMP
                       DEFAULT
                       CURRENT_TIMESTAMP
                   )
                   """)
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS categories
                   (
                       id
                       TEXT
                       PRIMARY
                       KEY,
                       name
                       TEXT
                       NOT
                       NULL,
                       image
                       TEXT,
                       position
                       INTEGER
                       NOT
                       NULL
                       DEFAULT
                       0,
                       hidden
                       BOOLEAN
                       DEFAULT
                       FALSE
                   )
                   """)
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS brands
                   (
                       id
                       TEXT
                       PRIMARY
                       KEY,
                       name
                       TEXT
                       NOT
                       NULL,
                       logo
                       TEXT,
                       position
                       INTEGER
                       NOT
                       NULL
                       DEFAULT
                       0,
                       hidden
                       BOOLEAN
                       DEFAULT
                       FALSE
                   )
                   """)

    migrations = [
        ("products", "color_quantities", "TEXT"),
        ("products", "color_images", "TEXT"),
        ("products", "old_price", "INTEGER"),
        ("products", "sku", "TEXT"),
        ("products", "featured", "BOOLEAN DEFAULT FALSE"),
        ("products", "popular", "BOOLEAN DEFAULT FALSE"),
        ("products", "hidden", "BOOLEAN DEFAULT FALSE"),
        ("products", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ("orders", "status", "TEXT NOT NULL DEFAULT 'NEW'"),
        ("orders", "tracking_number", "TEXT"),
        ("orders", "admin_comment", "TEXT"),
        ("orders", "telegram_id", "BIGINT"),
        ("orders", "total", "INTEGER NOT NULL DEFAULT 0"),
        ("orders", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]
    for table, column, coltype in migrations:
        cursor.execute("""
                       SELECT 1
                       FROM information_schema.columns
                       WHERE table_name = %s
                         AND column_name = %s
                       """, (table, column))
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")

    conn.commit()

    cursor.execute("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''")
    existing_categories = [r["category"] for r in cursor.fetchall()]
    cursor.execute("SELECT id FROM categories")
    known_cat_ids = {r["id"] for r in cursor.fetchall()}
    for i, cat_name in enumerate(existing_categories):
        cat_id = _slugify(cat_name)
        if cat_id not in known_cat_ids:
            cursor.execute(
                "INSERT INTO categories (id, name, position) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (cat_id, cat_name, i),
            )

    cursor.execute("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != ''")
    existing_brands = [r["brand"] for r in cursor.fetchall()]
    cursor.execute("SELECT id FROM brands")
    known_brand_ids = {r["id"] for r in cursor.fetchall()}
    for i, brand_name in enumerate(existing_brands):
        brand_id = _slugify(brand_name)
        if brand_id not in known_brand_ids:
            cursor.execute(
                "INSERT INTO brands (id, name, position) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (brand_id, brand_name, i),
            )

    conn.commit()
    cursor.close()
    conn.close()


def _slugify(text: str) -> str:
    text = (text or "").strip().lower()
    slug = re.sub(r"[^a-z0-9а-яіїєґ]+", "-", text).strip("-")
    return slug or ("x-" + str(uuid.uuid4())[:6])


init_db()


async def get_file_url(bot: Bot, file_id: str) -> str:
    if not file_id: return ""
    if file_id.startswith("http"): return file_id
    try:
        file_info = await bot.get_file(file_id)
        return f"https://api.telegram.org/file/bot{TOKEN}/{file_info.file_path}"
    except Exception as e:
        logging.error(f"Error getting file URL for {file_id}: {e}")
        return file_id


def validate_init_data(init_data: str, bot_token: str):
    try:
        if not init_data:
            return None
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated_hash, received_hash):
            return None
        user_json = parsed.get("user")
        return json.loads(user_json) if user_json else {}
    except Exception as e:
        logging.error(f"initData validation error: {e}")
        return None


def get_admin_user(request: Request):
    init_data = request.headers.get("X-Init-Data", "")
    user = validate_init_data(init_data, TOKEN)
    if not user or user.get("id") not in ADMIN_IDS:
        return None
    return user


def get_verified_user(request: Request):
    init_data = request.headers.get("X-Init-Data", "")
    return validate_init_data(init_data, TOKEN)


def require_admin(request: Request):
    user = get_admin_user(request)
    if not user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    return user


def get_db_products(include_hidden: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    if include_hidden:
        cursor.execute("SELECT * FROM products ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM products WHERE hidden IS NOT TRUE ORDER BY created_at DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    result = []
    for row in rows:
        p = dict(row)
        for key, default in [("color_images", {}), ("specs", []), ("color_quantities", {}), ("gallery", [])]:
            mapKey = "colorImages" if key == "color_images" else (
                "colorQuantities" if key == "color_quantities" else key)
            try:
                val = p.get(key)
                if isinstance(val, str):
                    parsed = json.loads(val) if val.strip() else default
                elif isinstance(val, (dict, list)):
                    parsed = val
                else:
                    parsed = default

                if key == "color_images" and isinstance(parsed, dict):
                    formatted_ci = {}
                    for col_name, col_data in parsed.items():
                        if isinstance(col_data, dict):
                            formatted_ci[col_name] = {
                                "main": str(col_data.get("main", "")),
                                "gallery": [str(g) for g in col_data.get("gallery", []) if isinstance(g, str)]
                            }
                        else:
                            formatted_ci[col_name] = {"main": str(col_data), "gallery": []}
                    p[mapKey] = formatted_ci
                else:
                    p[mapKey] = parsed
            except Exception:
                p[mapKey] = default
        result.append(p)
    return result


app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])

api_router = APIRouter()


@api_router.get("/")
async def root():
    return {"status": "ok", "message": "M1lipStore API is running!"}


# ============================================================================
# PUBLIC CATALOG
# ============================================================================

@api_router.get("/api/products")
async def get_products(
        category: str = None,
        brand: str = None,
        search: str = None,
        min_price: int = None,
        max_price: int = None,
        in_stock: bool = None,
        sort: str = None,
):
    products = get_db_products()

    if category:
        products = [p for p in products if (p.get("category") or "").lower() == category.lower()]
    if brand:
        products = [p for p in products if (p.get("brand") or "").lower() == brand.lower()]
    if search:
        q = search.lower().strip()
        products = [
            p for p in products
            if q in (p.get("title") or "").lower()
               or q in (p.get("brand") or "").lower()
               or q in (p.get("category") or "").lower()
               or q in (p.get("sku") or "").lower()
        ]
    if min_price is not None:
        products = [p for p in products if p.get("price", 0) >= min_price]
    if max_price is not None:
        products = [p for p in products if p.get("price", 0) <= max_price]
    if in_stock:
        products = [p for p in products if p.get("quantity", 0) > 0]

    if sort == "price_asc":
        products.sort(key=lambda p: p.get("price", 0))
    elif sort == "price_desc":
        products.sort(key=lambda p: p.get("price", 0), reverse=True)
    elif sort == "new":
        pass
    elif sort == "popular":
        products.sort(key=lambda p: bool(p.get("popular")), reverse=True)

    return products


@api_router.get("/api/products/{product_id}")
async def get_product(product_id: str):
    products = get_db_products()
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Товар не знайдено")
    return product


@api_router.get("/api/categories")
async def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories WHERE hidden IS NOT TRUE ORDER BY position ASC, name ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


@api_router.get("/api/brands")
async def get_brands():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM brands WHERE hidden IS NOT TRUE ORDER BY position ASC, name ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


# ============================================================================
# ORDER CREATION
# ============================================================================

class OrderValidationError(Exception):
    def __init__(self, message: str, item_id: str = None):
        self.message = message
        self.item_id = item_id
        super().__init__(message)


def _validate_and_price_items(cursor, items: list):
    if not items:
        raise OrderValidationError("Кошик порожній")

    priced_items = []
    total = 0

    for raw_item in items:
        product_id = raw_item.get("id")
        color = (raw_item.get("color") or "").strip()
        qty = raw_item.get("qty")

        if not product_id or not isinstance(qty, int) or qty <= 0:
            raise OrderValidationError("Некоректний товар у кошику", product_id)

        cursor.execute("SELECT * FROM products WHERE id = %s FOR UPDATE", (product_id,))
        row = cursor.fetchone()
        if not row or row.get("hidden"):
            raise OrderValidationError(f"Товар більше недоступний", product_id)

        try:
            cq = json.loads(row["color_quantities"]) if row.get("color_quantities") else {}
        except Exception:
            cq = {}

        if cq:
            if color not in cq:
                raise OrderValidationError(f"Колір «{color}» недоступний для цього товару", product_id)
            available = cq.get(color, 0)
            if available < qty:
                raise OrderValidationError(
                    f"Недостатньо товару «{row['title']}» ({color}) на складі: доступно {available}", product_id
                )
        else:
            if (row.get("quantity") or 0) < qty:
                raise OrderValidationError(f"Недостатньо товару «{row['title']}» на складі", product_id)

        price = row["price"]
        line_total = price * qty
        total += line_total
        priced_items.append({
            "id": product_id,
            "title": row["title"],
            "brand": row.get("brand", ""),
            "color": color,
            "qty": qty,
            "price": price,
            "lineTotal": line_total,
            "_cq": cq,
        })

    return priced_items, total


def _reserve_stock(cursor, priced_items: list):
    for item in priced_items:
        cq = item["_cq"]
        if cq:
            cq[item["color"]] = cq.get(item["color"], 0) - item["qty"]
            new_total = sum(cq.values())
            cursor.execute(
                "UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                (json.dumps(cq, ensure_ascii=False), new_total, item["id"]),
            )
        else:
            cursor.execute(
                "UPDATE products SET quantity = quantity - %s WHERE id = %s",
                (item["qty"], item["id"]),
            )


def _restock(cursor, order_data: dict):
    for item in order_data.get("items", []):
        product_id = item.get("id")
        color = item.get("color")
        qty = item.get("qty", 0)
        cursor.execute("SELECT color_quantities, quantity FROM products WHERE id = %s FOR UPDATE", (product_id,))
        row = cursor.fetchone()
        if not row:
            continue
        try:
            cq = json.loads(row["color_quantities"]) if row.get("color_quantities") else {}
        except Exception:
            cq = {}
        if cq and color in cq:
            cq[color] = cq.get(color, 0) + qty
            new_total = sum(cq.values())
            cursor.execute(
                "UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                (json.dumps(cq, ensure_ascii=False), new_total, product_id),
            )
        else:
            cursor.execute("UPDATE products SET quantity = quantity + %s WHERE id = %s", (qty, product_id))


UA_PHONE_RE = re.compile(r"^\+380\d{9}$")


def normalize_ua_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("380") and len(digits) == 12:
        normalized = "+" + digits
    elif digits.startswith("0") and len(digits) == 10:
        normalized = "+38" + digits
    elif len(digits) == 9:
        normalized = "+380" + digits
    else:
        normalized = "+" + digits if not raw.strip().startswith("+") else raw.strip()
    if not UA_PHONE_RE.match(normalized):
        raise OrderValidationError("Введіть коректний номер телефону у форматі +380XXXXXXXXX")
    return normalized


def normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if not EMAIL_RE.fullmatch(email) or len(email) > 120:
        raise HTTPException(status_code=400, detail="Введіть коректний e-mail")
    return email


@api_router.post("/api/orders")
async def create_order(request: Request):
    body = await request.json()
    customer = body.get("customer", {}) or {}
    delivery = body.get("delivery", {}) or {}
    payment = body.get("payment", {}) or {}
    comment = (body.get("comment") or "").strip()
    raw_items = body.get("items", []) or []

    verified_user = get_verified_user(request)
    telegram_id = verified_user.get("id") if verified_user else None

    first_name = (customer.get("firstName") or "").strip()
    last_name = (customer.get("lastName") or "").strip()
    email = normalize_email(customer.get("email"))
    if not NAME_RE.fullmatch(first_name):
        raise HTTPException(status_code=400, detail="Введіть коректне ім'я: тільки літери")
    if not NAME_RE.fullmatch(last_name):
        raise HTTPException(status_code=400, detail="Введіть коректне прізвище: тільки літери")
    if not customer.get("phone"):
        raise HTTPException(status_code=400, detail="Вкажіть номер телефону")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            phone = normalize_ua_phone(customer.get("phone"))
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail=e.message)

        provider_id = delivery.get("provider")
        if provider_id not in ("nova_poshta", "ukrposhta", "mist"):
            raise HTTPException(status_code=400, detail="Оберіть службу доставки")
        try:
            provider = delivery_service.get(provider_id)
        except KeyError:
            raise HTTPException(status_code=400, detail="Невідома служба доставки")
        if not provider.configured:
            raise HTTPException(status_code=503, detail=f"{provider.label}: автоматичний пошук ще не налаштований")
        if not delivery.get("cityRef") or not delivery.get("warehouseRef") or not delivery.get(
                "city") or not delivery.get("department"):
            raise HTTPException(status_code=400, detail="Оберіть місто та відділення зі списку")

        try:
            priced_items, total = _validate_and_price_items(cursor, raw_items)
        except OrderValidationError as e:
            conn.rollback()
            raise HTTPException(status_code=400, detail=e.message)

        _reserve_stock(cursor, priced_items)

        customer["firstName"] = first_name
        customer["lastName"] = last_name
        customer["email"] = email
        customer["phone"] = phone
        clean_items = [{k: v for k, v in it.items() if k != "_cq"} for it in priced_items]
        order_id_str = f"MLP-{random.randint(100000, 999999)}"
        order_data = {
            "customer": customer,
            "items": clean_items,
            "delivery": delivery,
            "payment": payment,
            "comment": comment,
            "totals": total,
        }

        cursor.execute(
            """INSERT INTO orders (order_id, data, status, telegram_id, total)
               VALUES (%s, %s, 'NEW', %s, %s)""",
            (order_id_str, json.dumps(order_data, ensure_ascii=False), telegram_id, total),
        )

        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logging.error(f"Order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Не вдалося створити замовлення. Спробуйте ще раз.")
    finally:
        cursor.close()
        conn.close()

    try:
        bot_notify = Bot(token=TOKEN)
        items_str = "\n".join([
            f"• {i.get('brand', '')} {i.get('title', '')} ({i.get('color', '')}) x {i['qty']} — {i['lineTotal']} ₴"
            for i in clean_items])
        msg_text = (
            f"🚨 *Нове замовлення #{order_id_str}*!\n\n"
            f"👤 *Клієнт:* {customer.get('firstName')} {customer.get('lastName', '')} ({customer.get('phone')})\n"
            f"💬 *Telegram:* {customer.get('telegram', 'не вказано')}\n\n"
            f"📦 *Товари:*\n{items_str}\n\n"
            f"🚚 *Доставка:* {delivery.get('provider', '')}, м. {delivery.get('city', '')}, відділення: {delivery.get('department', '')}\n"
            f"💳 *Оплата:* {payment.get('method', 'не вказано')}\n"
            f"💰 *Сума до сплати:* *{total} ₴*\n"
            f"📝 *Коментар:* {comment or 'відсутній'}"
        )
        for admin_id in ADMIN_IDS:
            await bot_notify.send_message(admin_id, msg_text, parse_mode="Markdown")
        await bot_notify.session.close()
    except Exception as e:
        logging.error(f"Error sending order notification: {e}")

    return {"status": "success", "orderId": order_id_str, "total": total, "orderStatus": "NEW"}


@api_router.get("/api/orders/{order_id}")
async def get_order_status(order_id: str, request: Request):
    verified_user = get_verified_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT order_id, data, status, tracking_number, total, created_at FROM orders WHERE order_id = %s",
                   (order_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    if not verified_user or (row.get("telegram_id") and row["telegram_id"] != verified_user.get("id")):
        if not verified_user:
            raise HTTPException(status_code=403, detail="Доступ заборонено")
    return {
        "order_id": row["order_id"],
        "status": row["status"],
        "tracking_number": row["tracking_number"],
        "total": row["total"],
        "created_at": str(row["created_at"]),
        "items": row["data"].get("items", []) if isinstance(row["data"], dict) else [],
    }


@api_router.get("/api/users/me/orders")
async def get_my_orders(request: Request):
    verified_user = get_verified_user(request)
    if not verified_user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT order_id, status, total, created_at FROM orders WHERE telegram_id = %s ORDER BY id DESC",
        (verified_user.get("id"),),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return rows


# ============================================================================
# DELIVERY
# ============================================================================

@api_router.get("/api/delivery/providers")
async def list_delivery_providers():
    return delivery_service.list_providers()


@api_router.get("/api/delivery/{provider_id}/cities")
async def delivery_search_cities(provider_id: str, query: str = ""):
    try:
        provider = delivery_service.get(provider_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Невідома служба доставки")
    if not query or len(query.strip()) < 2:
        return []
    try:
        return await provider.search_cities(query.strip())
    except DeliveryProviderNotConfigured:
        raise HTTPException(
            status_code=503,
            detail=f"Пошук міст для «{provider.label}» ще не підключено. Спробуйте іншу службу доставки.",
        )
    except DeliveryProviderError:
        raise HTTPException(status_code=502, detail="Не вдалося отримати список міст. Спробуйте ще раз.")


@api_router.get("/api/delivery/{provider_id}/warehouses")
async def delivery_search_warehouses(provider_id: str, city_ref: str = "", query: str = ""):
    try:
        provider = delivery_service.get(provider_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Невідома служба доставки")
    if not city_ref and provider_id != "pickup":
        raise HTTPException(status_code=400, detail="Спочатку оберіть місто")
    try:
        return await provider.search_warehouses(city_ref, query.strip())
    except DeliveryProviderNotConfigured:
        raise HTTPException(
            status_code=503,
            detail=f"Пошук відділень для «{provider.label}» ще не підключено. Спробуйте іншу службу доставки.",
        )
    except DeliveryProviderError:
        raise HTTPException(status_code=502, detail="Не вдалося отримати список відділень. Спробуйте ще раз.")


# ============================================================================
# USER PROFILE
# ============================================================================

def _get_or_create_profile(cursor, telegram_id: int) -> dict:
    cursor.execute("SELECT * FROM user_profiles WHERE telegram_id = %s", (telegram_id,))
    row = cursor.fetchone()
    if row:
        profile = dict(row)
        if isinstance(profile.get("saved_deliveries"), str):
            try:
                profile["saved_deliveries"] = json.loads(profile["saved_deliveries"])
            except Exception:
                profile["saved_deliveries"] = []
        return profile
    cursor.execute(
        "INSERT INTO user_profiles (telegram_id) VALUES (%s) ON CONFLICT DO NOTHING",
        (telegram_id,),
    )
    return {"telegram_id": telegram_id, "first_name": None, "last_name": None, "phone": None, "saved_deliveries": []}


@api_router.get("/api/users/me/profile")
async def get_my_profile(request: Request):
    verified_user = get_verified_user(request)
    if not verified_user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        profile = _get_or_create_profile(cursor, verified_user["id"])
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    profile.pop("updated_at", None)
    return profile


@api_router.put("/api/users/me/profile")
async def update_my_profile(request: Request):
    verified_user = get_verified_user(request)
    if not verified_user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    body = await request.json()
    first_name = (body.get("first_name") or "").strip() or None
    last_name = (body.get("last_name") or "").strip() or None
    phone_raw = (body.get("phone") or "").strip()
    phone = None
    if phone_raw:
        try:
            phone = normalize_ua_phone(phone_raw)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail=e.message)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _get_or_create_profile(cursor, verified_user["id"])
        cursor.execute(
            """UPDATE user_profiles
               SET first_name = %s,
                   last_name  = %s,
                   phone      = COALESCE(%s, phone),
                   updated_at = CURRENT_TIMESTAMP
               WHERE telegram_id = %s""",
            (first_name, last_name, phone, verified_user["id"]),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return {"status": "ok"}


@api_router.post("/api/users/me/deliveries")
async def add_saved_delivery(request: Request):
    verified_user = get_verified_user(request)
    if not verified_user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    body = await request.json()
    provider = body.get("provider")
    city = (body.get("city") or "").strip()
    city_ref = (body.get("cityRef") or "").strip()
    warehouse = (body.get("warehouse") or "").strip()
    warehouse_ref = (body.get("warehouseRef") or "").strip()
    if not provider or not city or not warehouse:
        raise HTTPException(status_code=400, detail="Вкажіть службу доставки, місто та відділення")

    entry = {
        "id": body.get("id") or str(uuid.uuid4())[:8],
        "provider": provider,
        "city": city,
        "cityRef": city_ref,
        "warehouse": warehouse,
        "warehouseRef": warehouse_ref,
        "label": (body.get("label") or "").strip(),
    }

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        profile = _get_or_create_profile(cursor, verified_user["id"])
        deliveries = [d for d in profile["saved_deliveries"] if d.get("id") != entry["id"]]
        deliveries.insert(0, entry)
        deliveries = deliveries[:5]
        cursor.execute(
            "UPDATE user_profiles SET saved_deliveries = %s, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = %s",
            (json.dumps(deliveries, ensure_ascii=False), verified_user["id"]),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return {"status": "ok", "saved_deliveries": deliveries}


@api_router.delete("/api/users/me/deliveries/{delivery_id}")
async def delete_saved_delivery(delivery_id: str, request: Request):
    verified_user = get_verified_user(request)
    if not verified_user:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        profile = _get_or_create_profile(cursor, verified_user["id"])
        deliveries = [d for d in profile["saved_deliveries"] if d.get("id") != delivery_id]
        cursor.execute(
            "UPDATE user_profiles SET saved_deliveries = %s, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = %s",
            (json.dumps(deliveries, ensure_ascii=False), verified_user["id"]),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return {"status": "ok", "saved_deliveries": deliveries}


# ============================================================================
# ADMIN — PRODUCTS
# ============================================================================

def _product_row_to_admin_json(product: dict) -> dict:
    cq = product.get("colorQuantities", {}) or {}
    ci = product.get("colorImages", {}) or {}
    color_names = list(cq.keys()) or [c.strip() for c in (product.get("colors") or "").split(",") if c.strip()]
    colors = []
    for name in color_names:
        img = ci.get(name, {})
        colors.append({
            "name": name,
            "quantity": cq.get(name, 0),
            "main": img.get("main", ""),
            "gallery": img.get("gallery", []),
        })
    return {
        "id": product.get("id"),
        "brand": product.get("brand", ""),
        "title": product.get("title", ""),
        "price": product.get("price", 0),
        "oldPrice": product.get("old_price"),
        "tag": product.get("tag", ""),
        "sku": product.get("sku", ""),
        "category": product.get("category", ""),
        "description": product.get("description", ""),
        "img": product.get("img", ""),
        "gallery": product.get("gallery", []) or [],
        "specs": product.get("specs", []) or [],
        "colors": colors,
        "featured": bool(product.get("featured")),
        "popular": bool(product.get("popular")),
        "hidden": bool(product.get("hidden")),
    }


def _save_admin_product(body: dict, product_id: str = None) -> str:
    product_id = product_id or ("prod-" + str(uuid.uuid4())[:8])
    brand = (body.get("brand") or "M1LIP").strip()
    title = (body.get("title") or "Товар").strip()
    price = int(body.get("price") or 0)
    old_price = body.get("oldPrice")
    old_price = int(old_price) if old_price not in (None, "") else None
    tag = (body.get("tag") or "").strip()
    sku = (body.get("sku") or "").strip()
    category = (body.get("category") or "Аксесуари").strip()
    description = (body.get("description") or "").strip()
    img = body.get("img") or ""
    gallery = body.get("gallery") or []
    specs = body.get("specs") or []
    colors = body.get("colors") or []
    featured = bool(body.get("featured"))
    popular = bool(body.get("popular"))
    hidden = bool(body.get("hidden"))

    colors_str = ", ".join([c.get("name", "") for c in colors if c.get("name")])
    cq_dict = {c["name"]: int(c.get("quantity") or 0) for c in colors if c.get("name")}
    ci_dict = {c["name"]: {"main": c.get("main", ""), "gallery": c.get("gallery") or []} for c in colors if
               c.get("name")}
    total_qty = sum(cq_dict.values())

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM products WHERE id = %s", (product_id,))
    exists = cursor.fetchone()

    if exists:
        cursor.execute("""
                       UPDATE products
                       SET brand=%s,
                           title=%s,
                           price=%s,
                           old_price=%s,
                           tag=%s,
                           sku=%s,
                           category=%s,
                           quantity=%s,
                           colors=%s,
                           description=%s,
                           img=%s,
                           gallery=%s,
                           specs=%s,
                           color_images=%s,
                           color_quantities=%s,
                           featured=%s,
                           popular=%s,
                           hidden=%s
                       WHERE id = %s
                       """, (brand, title, price, old_price, tag, sku, category, total_qty, colors_str, description,
                             img, json.dumps(gallery, ensure_ascii=False), json.dumps(specs, ensure_ascii=False),
                             json.dumps(ci_dict, ensure_ascii=False), json.dumps(cq_dict, ensure_ascii=False),
                             featured, popular, hidden, product_id))
    else:
        cursor.execute("""
                       INSERT INTO products (id, brand, title, price, old_price, tag, sku, category, quantity,
                                             colors, description, img, gallery, specs, color_images,
                                             color_quantities, featured, popular, hidden)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       """, (product_id, brand, title, price, old_price, tag, sku, category, total_qty, colors_str,
                             description, img, json.dumps(gallery, ensure_ascii=False),
                             json.dumps(specs, ensure_ascii=False), json.dumps(ci_dict, ensure_ascii=False),
                             json.dumps(cq_dict, ensure_ascii=False), featured, popular, hidden))

    cat_id = _slugify(category)
    cursor.execute(
        "INSERT INTO categories (id, name, position) VALUES (%s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM categories)) ON CONFLICT (id) DO NOTHING",
        (cat_id, category),
    )
    brand_id = _slugify(brand)
    cursor.execute(
        "INSERT INTO brands (id, name, position) VALUES (%s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM brands)) ON CONFLICT (id) DO NOTHING",
        (brand_id, brand),
    )

    conn.commit()
    cursor.close()
    conn.close()
    return product_id


@api_router.get("/api/admin/check")
async def admin_check(request: Request):
    user = require_admin(request)
    return {"ok": True, "user": {"id": user.get("id"), "first_name": user.get("first_name", "")}}


@api_router.get("/api/admin/products")
async def admin_list_products(request: Request):
    require_admin(request)
    return [_product_row_to_admin_json(p) for p in get_db_products(include_hidden=True)]


@api_router.post("/api/admin/products")
async def admin_create_product(request: Request):
    require_admin(request)
    body = await request.json()
    new_id = _save_admin_product(body)
    return {"status": "created", "id": new_id}


@api_router.put("/api/admin/products/{product_id}")
async def admin_update_product(product_id: str, request: Request):
    require_admin(request)
    body = await request.json()
    _save_admin_product(body, product_id=product_id)
    return {"status": "updated", "id": product_id}


@api_router.delete("/api/admin/products/{product_id}")
async def admin_delete_product(product_id: str, request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted", "id": product_id}


@api_router.patch("/api/admin/products/{product_id}/stock")
async def admin_quick_update_stock(product_id: str, request: Request):
    require_admin(request)
    body = await request.json()
    color = body.get("color")
    quantity = body.get("quantity")
    if quantity is None or int(quantity) < 0:
        raise HTTPException(status_code=400, detail="Некоректна кількість")
    quantity = int(quantity)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT color_quantities FROM products WHERE id = %s FOR UPDATE", (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Товар не знайдено")

    try:
        cq = json.loads(row["color_quantities"]) if row.get("color_quantities") else {}
    except Exception:
        cq = {}

    if color and cq:
        cq[color] = quantity
        new_total = sum(cq.values())
        cursor.execute("UPDATE products SET color_quantities = %s, quantity = %s WHERE id = %s",
                       (json.dumps(cq, ensure_ascii=False), new_total, product_id))
    else:
        cursor.execute("UPDATE products SET quantity = %s WHERE id = %s", (quantity, product_id))

    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "updated"}


@api_router.post("/api/admin/upload")
async def admin_upload_image(request: Request, file: UploadFile = File(...)):
    user = require_admin(request)
    contents = await file.read()
    if len(contents) > 19 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл занадто великий (макс. 19 МБ)")

    bot_upload = Bot(token=TOKEN)
    try:
        sent = await bot_upload.send_photo(
            chat_id=user["id"],
            photo=BufferedInputFile(contents, filename=file.filename or "photo.jpg"),
        )
        photo_file_id = sent.photo[-1].file_id
        url = await get_file_url(bot_upload, photo_file_id)
        return {"url": url}
    except Exception as e:
        logging.error(f"Upload error: {e}")
        raise HTTPException(status_code=500,
                            detail="Не вдалося завантажити фото. Переконайтесь, що ви писали боту /start.")
    finally:
        await bot_upload.session.close()


# ============================================================================
# ADMIN — CATEGORIES
# ============================================================================

@api_router.get("/api/admin/categories")
async def admin_list_categories(request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories ORDER BY position ASC, name ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


@api_router.post("/api/admin/categories")
async def admin_create_category(request: Request):
    require_admin(request)
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Вкажіть назву категорії")
    cat_id = _slugify(name)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO categories (id, name, image, position)
           VALUES (%s, %s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM categories)) ON CONFLICT (id) DO
        UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image""",
        (cat_id, name, body.get("image", "")),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "created", "id": cat_id}


@api_router.put("/api/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, request: Request):
    require_admin(request)
    body = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE categories SET name=%s, image=%s, position=COALESCE(%s, position), hidden=%s WHERE id=%s",
        (body.get("name"), body.get("image", ""), body.get("position"), bool(body.get("hidden")), cat_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "updated"}


@api_router.delete("/api/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM categories WHERE id = %s", (cat_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}


# ============================================================================
# ADMIN — BRANDS
# ============================================================================

@api_router.get("/api/admin/brands")
async def admin_list_brands(request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM brands ORDER BY position ASC, name ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


@api_router.post("/api/admin/brands")
async def admin_create_brand(request: Request):
    require_admin(request)
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Вкажіть назву бренду")
    brand_id = _slugify(name)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO brands (id, name, logo, position)
           VALUES (%s, %s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM brands)) ON CONFLICT (id) DO
        UPDATE SET name = EXCLUDED.name, logo = EXCLUDED.logo""",
        (brand_id, name, body.get("logo", "")),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "created", "id": brand_id}


@api_router.put("/api/admin/brands/{brand_id}")
async def admin_update_brand(brand_id: str, request: Request):
    require_admin(request)
    body = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE brands SET name=%s, logo=%s, position=COALESCE(%s, position), hidden=%s WHERE id=%s",
        (body.get("name"), body.get("logo", ""), body.get("position"), bool(body.get("hidden")), brand_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "updated"}


@api_router.delete("/api/admin/brands/{brand_id}")
async def admin_delete_brand(brand_id: str, request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM brands WHERE id = %s", (brand_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}


# ============================================================================
# ADMIN — ORDERS
# ============================================================================

def _order_row_to_json(row: dict) -> dict:
    data = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
    return {
        "order_id": row["order_id"],
        "status": row["status"],
        "tracking_number": row.get("tracking_number"),
        "admin_comment": row.get("admin_comment"),
        "total": row.get("total"),
        "telegram_id": row.get("telegram_id"),
        "created_at": str(row["created_at"]),
        "updated_at": str(row.get("updated_at") or row["created_at"]),
        "customer": data.get("customer", {}),
        "items": data.get("items", []),
        "delivery": data.get("delivery", {}),
        "payment": data.get("payment", {}),
        "comment": data.get("comment", ""),
    }


@api_router.get("/api/admin/orders")
async def admin_list_orders(request: Request, status: str = None, search: str = None, limit: int = 100,
                            offset: int = 0):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM orders WHERE 1=1"
    params = []
    if status and status != "ALL":
        query += " AND status = %s"
        params.append(status)
    if search:
        s = f"%{search.lower()}%"
        query += """ AND (
            LOWER(order_id) LIKE %s
            OR LOWER(tracking_number) LIKE %s
            OR LOWER(data->'customer'->>'firstName') LIKE %s
            OR LOWER(data->'customer'->>'lastName') LIKE %s
            OR data->'customer'->>'phone' LIKE %s
            OR telegram_id::TEXT LIKE %s
        )"""
        params += [s, s, s, s, s, s]
    query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params += [limit, offset]

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [_order_row_to_json(r) for r in rows]


@api_router.get("/api/admin/orders/{order_id}")
async def admin_get_order(order_id: str, request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_id = %s", (order_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    return _order_row_to_json(row)


@api_router.patch("/api/admin/orders/{order_id}")
async def admin_update_order(order_id: str, request: Request):
    require_admin(request)
    body = await request.json()
    new_status = body.get("status")
    tracking_number = body.get("tracking_number")
    admin_comment = body.get("admin_comment")

    if new_status is not None and new_status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Невідомий статус. Дозволені: {', '.join(ORDER_STATUSES)}")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_id = %s FOR UPDATE", (order_id,))
    row = cursor.fetchone()
    if not row:
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")

    old_status = row["status"]
    order_data = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])

    if new_status is not None and new_status != old_status:
        if old_status in STOCK_HELD_STATUSES and new_status == "CANCELLED":
            _restock(cursor, order_data)
        elif old_status == "CANCELLED" and new_status in STOCK_HELD_STATUSES:
            try:
                priced_items, _ = _validate_and_price_items(cursor, order_data.get("items", []))
                _reserve_stock(cursor, priced_items)
            except OrderValidationError as e:
                conn.rollback()
                cursor.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f"Неможливо відновити замовлення: {e.message}")

    updates = []
    params = []
    if new_status is not None:
        updates.append("status = %s")
        params.append(new_status)
    if tracking_number is not None:
        updates.append("tracking_number = %s")
        params.append(tracking_number)
    if admin_comment is not None:
        updates.append("admin_comment = %s")
        params.append(admin_comment)
    updates.append("updated_at = CURRENT_TIMESTAMP")

    if updates:
        params.append(order_id)
        cursor.execute(f"UPDATE orders SET {', '.join(updates)} WHERE order_id = %s", params)

    conn.commit()

    cursor.execute("SELECT * FROM orders WHERE order_id = %s", (order_id,))
    updated_row = cursor.fetchone()
    cursor.close()
    conn.close()

    if new_status is not None and new_status != old_status and row.get("telegram_id"):
        status_messages = {
            "PAID": f"✅ Оплата замовлення #{order_id} підтверджена.",
            "PROCESSING": f"⚙️ Замовлення #{order_id} готується до відправки.",
            "SHIPPED": f"🚚 Замовлення #{order_id} відправлено." + (
                f" ТТН: {tracking_number}" if tracking_number else ""),
            "DELIVERED": f"📦 Замовлення #{order_id} доставлено. Дякуємо за покупку!",
            "CANCELLED": f"❌ Замовлення #{order_id} скасовано.",
        }
        text = status_messages.get(new_status)
        if text:
            try:
                bot_notify = Bot(token=TOKEN)
                await bot_notify.send_message(row["telegram_id"], text)
                await bot_notify.session.close()
            except Exception as e:
                logging.error(f"Error sending status notification: {e}")

    return _order_row_to_json(updated_row)


@api_router.get("/api/admin/dashboard")
async def admin_dashboard(request: Request):
    require_admin(request)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT status, COUNT(*) AS c, COALESCE(SUM(total), 0) AS s FROM orders GROUP BY status")
    status_counts = {r["status"]: {"count": r["c"], "total": r["s"]} for r in cursor.fetchall()}

    cursor.execute(
        "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')")
    revenue = cursor.fetchone()["revenue"]

    cursor.execute("SELECT COUNT(*) AS c FROM products WHERE hidden IS NOT TRUE")
    product_count = cursor.fetchone()["c"]

    cursor.execute(
        "SELECT id, title, brand, quantity FROM products WHERE quantity <= 3 AND hidden IS NOT TRUE ORDER BY quantity ASC LIMIT 10")
    low_stock = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT order_id, status, total, created_at FROM orders ORDER BY id DESC LIMIT 10")
    recent_orders = [dict(r) for r in cursor.fetchall()]
    for o in recent_orders:
        o["created_at"] = str(o["created_at"])

    cursor.close()
    conn.close()

    return {
        "statusCounts": status_counts,
        "revenue": revenue,
        "productCount": product_count,
        "lowStock": low_stock,
        "recentOrders": recent_orders,
    }


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


class AdminEditStates(StatesGroup):
    waiting_for_new_value = State()


def get_active_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM categories WHERE hidden IS NOT TRUE ORDER BY position ASC, name ASC")
    names = [r["name"] for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return names or ["Миші", "Клавіатури", "Гарнітури", "Аксесуари"]


@router.message(Command("start"))
async def cmd_start(message: Message):
    shop_reply_keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🛍 Відкрити M1lipStore", web_app=WebAppInfo(url=SHOP_URL))]],
        resize_keyboard=True,
    )
    await message.answer("Привіт! Вітаємо в **M1lipStore**.", reply_markup=shop_reply_keyboard, parse_mode="Markdown")


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ У вас немає прав доступу.")
        return
    open_panel_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖥 Відкрити адмін-панель", web_app=WebAppInfo(url=ADMIN_PANEL_URL))],
        [InlineKeyboardButton(text="📋 Класична текстова панель", callback_data="show_classic_admin")],
    ])
    await message.answer(
        "⚙️ **Адмін-панель M1lipStore**\n\nНатисніть кнопку нижче, щоб відкрити зручну панель керування:",
        reply_markup=open_panel_markup, parse_mode="Markdown"
    )


@router.callback_query(F.data == "show_classic_admin")
async def show_classic_admin_cb(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    await show_admin_panel(callback.message)
    await callback.answer()


async def show_admin_panel(message_or_callback_msg, edit_mode=False):
    products = get_db_products(include_hidden=True)
    keyboard_buttons = []
    for product in products:
        stock_status = f"📦 {product['quantity']} шт." if product['quantity'] > 0 else "❌ Немає"
        keyboard_buttons.append([InlineKeyboardButton(
            text=f"{product.get('brand', '')} {product['title']} | {product['price']} ₴ | {stock_status}",
            callback_data=f"manage_{product['id']}"
        )])
    keyboard_buttons.append([InlineKeyboardButton(text="➕ Додати новий товар", callback_data="add_new_product")])
    keyboard_buttons.append([InlineKeyboardButton(text="📦 Переглянути замовлення", callback_data="view_orders")])
    admin_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)

    text = "⚙️ **Панель адміністратора M1lipStore**\n\nОберіть товар для редагування або створіть новий:"
    if edit_mode:
        try:
            await message_or_callback_msg.message.edit_text(text, reply_markup=admin_markup, parse_mode="Markdown")
            return
        except Exception:
            pass
    await message_or_callback_msg.answer(text, reply_markup=admin_markup, parse_mode="Markdown")


ORDER_STATUS_LABELS_UA = {
    "NEW": "🆕 Нове",
    "WAITING_PAYMENT": "⏳ Очікує оплати",
    "PAID": "✅ Оплачено",
    "PROCESSING": "⚙️ В обробці",
    "SHIPPED": "🚚 Відправлено",
    "DELIVERED": "📦 Доставлено",
    "CANCELLED": "❌ Скасовано",
}


@router.callback_query(F.data == "view_orders")
async def process_view_orders(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT order_id, data, status, total FROM orders ORDER BY id DESC LIMIT 10")
    orders = cursor.fetchall()
    cursor.close()
    conn.close()

    if not orders:
        await callback.answer("Замовлень поки немає.", show_alert=True)
        return

    buttons = []
    for ord_row in orders:
        o_id = ord_row['order_id']
        data = ord_row['data'] if isinstance(ord_row['data'], dict) else json.loads(ord_row['data'])
        customer = data.get("customer", {})
        name = f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip() or "Клієнт"
        status_label = ORDER_STATUS_LABELS_UA.get(ord_row['status'], ord_row['status'])
        buttons.append(
            [InlineKeyboardButton(text=f"#{o_id} | {name} | {ord_row['total']} ₴ | {status_label}",
                                  callback_data=f"show_order_{o_id}")])

    buttons.append([InlineKeyboardButton(text="🔙 Назад до адмін-панелі", callback_data="back_to_admin")])
    markup = InlineKeyboardMarkup(inline_keyboard=buttons)

    try:
        await callback.message.edit_text("📦 **Останні замовлення:**", reply_markup=markup, parse_mode="Markdown")
    except Exception:
        await callback.message.answer("📦 **Останні замовлення:**", reply_markup=markup, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data.startswith("show_order_"))
async def process_show_order_details(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    o_id = callback.data.replace("show_order_", "")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data, status, total, tracking_number, created_at FROM orders WHERE order_id = %s", (o_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        await callback.answer("Замовлення не знайдено!", show_alert=True)
        return

    data = row['data'] if isinstance(row['data'], dict) else json.loads(row['data'])
    customer = data.get("customer", {})
    items = data.get("items", [])
    delivery = data.get("delivery", {})
    payment = data.get("payment", {})
    status_label = ORDER_STATUS_LABELS_UA.get(row['status'], row['status'])

    items_str = "\n".join([
        f"• {i.get('brand', '')} {i.get('title', '')} ({i.get('color', '')}) x {i['qty']} — {i.get('lineTotal', i.get('price', 0) * i['qty'])} ₴"
        for i in items])
    msg_text = (
        f"📋 *Деталі замовлення #{o_id}*\n"
        f"📅 *Дата:* {row['created_at']}\n"
        f"📊 *Статус:* {status_label}\n\n"
        f"👤 *Клієнт:* {customer.get('firstName')} {customer.get('lastName', '')} ({customer.get('phone')})\n"
        f"💬 *Telegram:* {customer.get('telegram', 'не вказано')}\n\n"
        f"📦 *Товари:*\n{items_str}\n\n"
        f"🚚 *Доставка:* {delivery.get('provider', '')}, м. {delivery.get('city', '')}, відділ. {delivery.get('department', '')}\n"
        f"💳 *Оплата:* {payment.get('method', 'не вказано')}\n"
        f"💰 *Сума:* *{row['total']} ₴*\n"
        f"🔖 *ТТН:* {row.get('tracking_number') or 'відсутній'}\n"
        f"📝 *Коментар:* {data.get('comment', 'відсутній')}"
    )

    status_buttons = []
    row_buttons = []
    for st in ORDER_STATUSES:
        if st == row['status']:
            continue
        row_buttons.append(InlineKeyboardButton(text=ORDER_STATUS_LABELS_UA.get(st, st),
                                                callback_data=f"setstatus_{o_id}_{st}"))
        if len(row_buttons) == 2:
            status_buttons.append(row_buttons)
            row_buttons = []
    if row_buttons:
        status_buttons.append(row_buttons)
    status_buttons.append([InlineKeyboardButton(text="🔙 До списку замовлень", callback_data="view_orders")])

    markup = InlineKeyboardMarkup(inline_keyboard=status_buttons)
    try:
        await callback.message.edit_text(msg_text, reply_markup=markup, parse_mode="Markdown")
    except Exception:
        await callback.message.answer(msg_text, reply_markup=markup, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data.startswith("setstatus_"))
async def process_set_order_status(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    parts = callback.data.replace("setstatus_", "").rsplit("_", 1)
    o_id, new_status = parts[0], parts[1]

    if new_status not in ORDER_STATUSES:
        await callback.answer("Невідомий статус", show_alert=True)
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status, data FROM orders WHERE order_id = %s FOR UPDATE", (o_id,))
    row = cursor.fetchone()
    if not row:
        conn.rollback()
        cursor.close()
        conn.close()
        await callback.answer("Замовлення не знайдено!", show_alert=True)
        return

    old_status = row["status"]
    order_data = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
    if old_status in STOCK_HELD_STATUSES and new_status == "CANCELLED":
        _restock(cursor, order_data)

    cursor.execute("UPDATE orders SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE order_id = %s",
                   (new_status, o_id))
    conn.commit()
    cursor.close()
    conn.close()

    await callback.answer(f"Статус оновлено: {ORDER_STATUS_LABELS_UA.get(new_status, new_status)}", show_alert=True)
    await process_show_order_details(callback)


@router.callback_query(F.data == "back_to_admin")
async def process_back_to_admin(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    try:
        await callback.message.delete()
    except Exception:
        pass
    await show_admin_panel(callback.message)
    await callback.answer()


@router.callback_query(F.data.startswith("manage_"))
async def process_manage_product(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Доступ заборонено!", show_alert=True)
        return

    product_id = callback.data.replace("manage_", "")
    products = get_db_products(include_hidden=True)
    product = next((p for p in products if p["id"] == product_id), None)

    if not product:
        await callback.answer("Товар не знайдено!", show_alert=True)
        return

    cq = product.get('colorQuantities', {})
    colors_info = ", ".join([f"{c}: {q} шт." for c, q in cq.items()]) if cq else product.get('colors', 'не вказано')

    brand_esc = product.get('brand', 'не вказано').replace('*', '\\*').replace('_', '\\_')
    title_esc = product['title'].replace('*', '\\*').replace('_', '\\_')
    cat_esc = product['category'].replace('*', '\\*').replace('_', '\\_')
    desc_snippet = (product.get('description') or 'немає')[:50].replace('*', '\\*').replace('_', '\\_')
    colors_esc = colors_info.replace('*', '\\*').replace('_', '\\_')

    caption = (
        f"🛠 *Редагування товару: {brand_esc} {title_esc}*\n\n"
        f"• Бренд: {brand_esc}\n"
        f"• Назва: {title_esc}\n"
        f"• Категорія: {cat_esc}\n"
        f"• Ціна: {product['price']} ₴\n"
        f"• Тег: `{product.get('tag') or 'немає'}`\n"
        f"• Опис: {desc_snippet}...\n"
        f"• Загалом на складі: *{product['quantity']} шт.*\n"
        f"• Кольори та залишки: {colors_esc}"
    )

    action_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Змінити назву", callback_data=f"edit_field_{product_id}_title"),
         InlineKeyboardButton(text="💰 Змінити ціну", callback_data=f"edit_field_{product_id}_price")],
        [InlineKeyboardButton(text="🏷 Змінити бренд", callback_data=f"edit_field_{product_id}_brand"),
         InlineKeyboardButton(text="📁 Змінити категорію", callback_data=f"edit_field_{product_id}_category")],
        [InlineKeyboardButton(text="📝 Змінити опис", callback_data=f"edit_field_{product_id}_description")],
        [InlineKeyboardButton(text="🖼 Змінити головне фото", callback_data=f"edit_field_{product_id}_img")],
        [InlineKeyboardButton(text="🎨 Редагувати залишки кольорів", callback_data=f"edit_colors_{product_id}")],
        [InlineKeyboardButton(text="❌ Видалити товар", callback_data=f"delete_prod_{product_id}")],
        [InlineKeyboardButton(text="🔙 Назад до списку", callback_data="back_to_admin")]
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


@router.callback_query(F.data.startswith("edit_field_"))
async def process_edit_field_start(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    parts = callback.data.replace("edit_field_", "").split("_", 1)
    prod_id = parts[0]
    field_name = parts[1]

    await state.update_data(edit_product_id=prod_id, edit_field_name=field_name)
    await state.set_state(AdminEditStates.waiting_for_new_value)

    field_names_ua = {
        "title": "назву товару",
        "price": "ціну (тільки число в грн)",
        "brand": "бренд",
        "category": "категорію",
        "description": "опис товару",
        "img": "посилання на нове головне фото або надішліть картинку"
    }
    await callback.message.answer(f"✏️ Введіть нову **{field_names_ua.get(field_name, field_name)}**:",
                                  parse_mode="Markdown")
    await callback.answer()


@router.message(AdminEditStates.waiting_for_new_value)
async def process_edit_field_save(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    if data.get("edit_field_name") == "color_qty": return

    prod_id = data.get("edit_product_id")
    field = data.get("edit_field_name")

    new_value = message.text.strip() if message.text else ""
    if field == "price":
        try:
            new_value = int(new_value)
            if new_value < 0: raise ValueError()
        except ValueError:
            await message.answer("❌ Будь ласка, введіть коректне число для ціни:")
            return
    elif field == "img" and message.photo:
        new_value = await get_file_url(message.bot, message.photo[-1].file_id)

    allowed_fields = {"title", "price", "brand", "category", "description", "img"}
    if field not in allowed_fields:
        await message.answer("❌ Непідтримуване поле.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE products SET {field} = %s WHERE id = %s", (new_value, prod_id))
    if field == "category":
        cat_id = _slugify(new_value)
        cursor.execute(
            "INSERT INTO categories (id, name, position) VALUES (%s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM categories)) ON CONFLICT (id) DO NOTHING",
            (cat_id, new_value),
        )
    if field == "brand":
        brand_id = _slugify(new_value)
        cursor.execute(
            "INSERT INTO brands (id, name, position) VALUES (%s, %s, (SELECT COALESCE(MAX(position), -1) + 1 FROM brands)) ON CONFLICT (id) DO NOTHING",
            (brand_id, new_value),
        )
    conn.commit()
    cursor.close()
    conn.close()

    await state.clear()
    await message.answer("✅ Успішно оновлено! Напишіть /admin для повернення в панель.")


@router.callback_query(F.data.startswith("edit_colors_"))
async def process_edit_colors(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS: return
    product_id = callback.data.replace("edit_colors_", "")
    products = get_db_products(include_hidden=True)
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        await callback.answer("Товар не знайдено!")
        return

    cq = product.get('colorQuantities', {})
    buttons = []
    for color in cq.keys():
        buttons.append([InlineKeyboardButton(text=f"Змінити залишок: {color} ({cq[color]} шт.)",
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
    if callback.from_user.id not in ADMIN_IDS: return
    parts = callback.data.replace("ch_cqty_", "").split("_", 1)
    await state.update_data(editing_product_id=parts[0], editing_color_name=parts[1], edit_field_name="color_qty")
    await state.set_state(AdminEditStates.waiting_for_new_value)
    await callback.message.answer(f"📦 Введіть нову кількість для кольору **{parts[1]}**:", parse_mode="Markdown")
    await callback.answer()


@router.message(AdminEditStates.waiting_for_new_value, F.text)
async def save_edited_color_qty_proxy(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    if data.get("edit_field_name") != "color_qty": return

    try:
        new_q = int(message.text.strip())
        if new_q < 0: raise ValueError()

        products = get_db_products(include_hidden=True)
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

        await message.answer("✅ Кількість кольору оновлено! Напишіть /admin.", parse_mode="Markdown")
        await state.clear()
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


# ============================================================================
# ДОДАВАННЯ ТОВАРУ ЗІ ШВИДКИМ ВИБОРОМ БРЕНДІВ КНОПКАМИ
# ============================================================================

@router.callback_query(F.data == "add_new_product")
async def process_add_new(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in ADMIN_IDS: return
    await state.set_state(AddProductStates.waiting_for_brand)

    brand_markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🦈 Attack Shark", callback_data="brand_Attack Shark"),
         InlineKeyboardButton(text="⚡ AJAZZ", callback_data="brand_AJAZZ")],
        [InlineKeyboardButton(text="🎹 AULA", callback_data="brand_AULA"),
         InlineKeyboardButton(text="🚀 MCHOSE", callback_data="brand_MCHOSE")],
        [InlineKeyboardButton(text="🎮 VGN", callback_data="brand_VGN")],
        [InlineKeyboardButton(text="✍️ Ввести інший бренд вручну", callback_data="brand_custom")]
    ])
    await callback.message.answer(
        "🏷 Оберіть **бренд** товару за допомогою кнопок або введіть вручну:",
        reply_markup=brand_markup,
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("brand_"), AddProductStates.waiting_for_brand)
async def select_brand_cb(callback: CallbackQuery, state: FSMContext):
    brand = callback.data.replace("brand_", "")
    if brand == "custom":
        await callback.message.answer("🏷 Введіть **назву бренду** текстом:")
        await callback.answer()
        return
    await state.update_data(brand=brand)
    await state.set_state(AddProductStates.waiting_for_title)
    try:
        await callback.message.delete()
    except Exception:
        pass
    await callback.message.answer(
        f"✅ Обрано бренд: **{brand}**\n\n✏️ Введіть **модель / назву** товару:",
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
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(tag=message.text.strip())
    await ask_category_step(message, state)


async def ask_category_step(message: Message, state: FSMContext):
    await state.set_state(AddProductStates.waiting_for_category)
    categories = get_active_categories()
    rows = []
    row_buf = []
    for cat in categories:
        row_buf.append(InlineKeyboardButton(text=cat, callback_data=f"cat_{cat}"))
        if len(row_buf) == 2:
            rows.append(row_buf)
            row_buf = []
    if row_buf:
        rows.append(row_buf)
    category_markup = InlineKeyboardMarkup(inline_keyboard=rows)
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
        parse_mode="Markdown")
    await callback.answer()


@router.message(AddProductStates.waiting_for_specs)
async def process_spec_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
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
        if not colors_list: colors_list = ["Чорний", "Білий"]
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

    if action not in colors_list: colors_list.append(action)
    await state.update_data(selected_colors=colors_list)
    await callback.answer(f"Додано: {action}! Обрано: {', '.join(colors_list)}")


@router.message(AddProductStates.waiting_for_color_qty)
async def process_color_qty_input(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        qty = int(message.text.strip())
        if qty < 0: raise ValueError()
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
            await state.update_data(color_quantities_dict=cq_dict, current_color_photo_index=0, color_images_dict={})
            await state.set_state(AddProductStates.waiting_for_color_main_photo)
            first_c = colors_list[0]
            await message.answer(f"🖼 Надішліть **обов'язкове головне фото** для кольору **{first_c}**:",
                                 parse_mode="Markdown")
    except ValueError:
        await message.answer("❌ Будь ласка, введіть ціле число (0 або більше):")


@router.message(AddProductStates.waiting_for_color_main_photo, F.photo)
async def process_color_main_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return

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

    done_markup = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="✅ Готово (перейти далі)", callback_data="col_gallery_done")]]
    )
    await message.answer(
        f"✅ Головне фото для кольору **{current_color}** успішно збережено!\n\n📸 Тепер надішліть додаткові фото галереї (або натисніть «Готово»):",
        reply_markup=done_markup, parse_mode="Markdown"
    )


@router.message(AddProductStates.waiting_for_color_main_photo)
async def process_color_main_photo_wrong(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await message.answer("❌ Будь ласка, надішліть **головне фото** для цього кольору (це обов'язкове поле):",
                         parse_mode="Markdown")


album_cache = {}


@router.message(AddProductStates.waiting_for_color_gallery_photos, F.photo)
async def process_color_gallery_photo(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    photo_file_id = message.photo[-1].file_id
    photo_url = await get_file_url(message.bot, photo_file_id)
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    current_color = colors_list[idx]
    ci_dict = data.get("color_images_dict", {})
    if current_color not in ci_dict: ci_dict[current_color] = {"main": "", "gallery": []}

    if message.media_group_id:
        if message.media_group_id not in album_cache: album_cache[message.media_group_id] = []
        album_cache[message.media_group_id].append(photo_url)
        await asyncio.sleep(0.7)
        photos = album_cache.pop(message.media_group_id, None)
        if not photos: return
        for p in photos:
            if p not in ci_dict[current_color]["gallery"]: ci_dict[current_color]["gallery"].append(p)
    else:
        if photo_url not in ci_dict[current_color]["gallery"]: ci_dict[current_color]["gallery"].append(photo_url)

    await state.update_data(color_images_dict=ci_dict)
    await message.answer(
        f"✅ Додано в галерею кольору **{current_color}** (всього: {len(ci_dict[current_color]['gallery'])}).",
        parse_mode="Markdown")


@router.callback_query(F.data == "col_gallery_done", AddProductStates.waiting_for_color_gallery_photos)
async def col_gallery_done_cb(callback: CallbackQuery, state: FSMContext):
    await advance_to_next_color_or_desc(callback.message, state, from_callback=True, callback_query=callback)


async def advance_to_next_color_or_desc(message_or_callback_msg, state: FSMContext, from_callback=False,
                                        callback_query=None):
    data = await state.get_data()
    colors_list = data.get("selected_colors", [])
    idx = data.get("current_color_photo_index", 0)
    target_msg = callback_query.message if (from_callback and callback_query) else message_or_callback_msg
    if from_callback and callback_query:
        try:
            await callback_query.message.delete()
        except Exception:
            pass

    idx += 1
    if idx < len(colors_list):
        await state.update_data(current_color_photo_index=idx)
        await state.set_state(AddProductStates.waiting_for_color_main_photo)
        next_color = colors_list[idx]
        await target_msg.answer(f"🖼 Надішліть **обов'язкове головне фото** для наступного кольору **{next_color}**:",
                                parse_mode="Markdown")
        if callback_query: await callback_query.answer()
    else:
        await state.set_state(AddProductStates.waiting_for_description)
        await target_msg.answer("📝 Введіть короткий опис товару:", parse_mode="Markdown")
        if callback_query: await callback_query.answer()


@router.message(AddProductStates.waiting_for_description)
async def add_description(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    await state.update_data(description=message.text.strip())
    await state.set_state(AddProductStates.waiting_for_img)
    await message.answer("🖼 Надішліть **головне фото** товару для каталогу:", parse_mode="Markdown")


@router.message(AddProductStates.waiting_for_img, F.photo)
async def add_img(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    main_photo_url = await get_file_url(message.bot, message.photo[-1].file_id)
    await state.update_data(img=main_photo_url)
    await state.set_state(AddProductStates.waiting_for_gallery)
    skip_gal_markup = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⏭ Пропустити / Завершити", callback_data="skip_general_gallery")]])
    await message.answer("📸 Надішліть загальні додаткові фото галереї:", reply_markup=skip_gal_markup,
                         parse_mode="Markdown")


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
    if message.from_user.id not in ADMIN_IDS: return
    photo_url = await get_file_url(message.bot, photo_file_id=message.photo[-1].file_id)
    data = await state.get_data()
    gallery_list = data.get("gallery_list", [])
    if photo_url not in gallery_list: gallery_list.append(photo_url)
    await state.update_data(gallery_list=gallery_list)
    await message.answer(f"✅ Додано в загальну галерею ({len(gallery_list)}). Напишіть /done для збереження.")


@router.message(AddProductStates.waiting_for_gallery, F.text)
async def add_general_gallery_text(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS: return
    data = await state.get_data()
    gallery_list = data.get("gallery_list", [])
    await save_product_to_db(message, state, gallery_list=gallery_list)


async def save_product_to_db(message: Message, state: FSMContext, gallery_list=None):
    if gallery_list is None:
        data = await state.get_data()
        gallery_list = data.get("gallery_list", [])
    data = await state.get_data()

    body = {
        "brand": data.get("brand", "M1LIP"),
        "title": data.get("title", "Товар"),
        "price": data.get("price", 0),
        "tag": data.get("tag", ""),
        "category": data.get("category", "Аксесуари"),
        "description": data.get("description", ""),
        "img": data.get("img", ""),
        "gallery": gallery_list,
        "specs": data.get("specs", []),
        "colors": [
            {
                "name": name,
                "quantity": qty,
                "main": data.get("color_images_dict", {}).get(name, {}).get("main", ""),
                "gallery": data.get("color_images_dict", {}).get(name, {}).get("gallery", []),
            }
            for name, qty in data.get("color_quantities_dict", {"Чорний": 5, "Білий": 5}).items()
        ],
    }
    product_id = _save_admin_product(body)

    await state.clear()
    await message.answer(
        f"🎉 Товар **{body['brand']} {body['title']}** успішно створено та додано в базу!\n\nНапишіть /admin для керування.",
        parse_mode="Markdown")


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
    await callback.message.answer("🗑 Товар успішно видалено з бази!")
    await callback.answer()


async def run_server():
    port = int(os.environ.get("PORT", 10000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def run_bot():
    if not TOKEN:
        logging.warning("BOT_TOKEN не встановлено — бот вимкнено, працює лише сайт/API.")
        return
    bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception:
        logging.exception("Bot polling stopped due to an error. The site/API keeps running.")


async def main():
    await asyncio.gather(run_server(), run_bot(), return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
