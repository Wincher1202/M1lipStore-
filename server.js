import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, ORDER_STATUSES } from './src/db.js';
import { botService, PAYMENT_PROVIDER_TOKEN } from './src/telegram-bot.js';
import { searchCities, searchWarehouses } from './src/delivery.js';

// Enforce Kyiv / Ukraine Timezone globally
process.env.TZ = 'Europe/Kyiv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// Helper: Telegram InitData User extraction
// ----------------------------------------------------
function extractTelegramUser(req) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  if (!initData || typeof initData !== 'string') return null;

  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

// ----------------------------------------------------
// Products, Categories, Brands APIs
// ----------------------------------------------------
app.get('/api/products', (req, res) => {
  const products = db.getProducts(req.query);
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ detail: 'Товар не знайдено' });
  }
  res.json(product);
});

app.post('/api/products', (req, res) => {
  try {
    const newProd = db.addProduct(req.body);
    res.status(201).json(newProd);
  } catch (err) {
    res.status(400).json({ detail: 'Помилка збереження товару: ' + err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const updated = db.updateProduct(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ detail: 'Товар не знайдено' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ detail: 'Помилка оновлення товару: ' + err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const deleted = db.deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ detail: 'Товар не знайдено' });
    }
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(400).json({ detail: 'Помилка видалення товару: ' + err.message });
  }
});

app.get('/api/categories', (req, res) => {
  res.json(db.getCategories());
});

app.get('/api/brands', (req, res) => {
  const includeHidden = req.query.include_hidden === 'true';
  res.json(db.getBrands(includeHidden));
});

app.post('/api/brands', (req, res) => {
  const { name, logo } = req.body;
  if (!name) return res.status(400).json({ detail: 'Назва бренду обовʼязкова' });
  const brand = db.addBrand({ name, logo });
  res.status(201).json(brand);
});

app.put('/api/brands/:id', (req, res) => {
  const updated = db.updateBrand(req.params.id, req.body);
  if (!updated) return res.status(404).json({ detail: 'Бренд не знайдено' });
  res.json(updated);
});

app.delete('/api/brands/:id', (req, res) => {
  const deleted = db.deleteBrand(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Бренд не знайдено' });
  res.json({ ok: true, deleted });
});

// ----------------------------------------------------
// Delivery Service APIs
// ----------------------------------------------------
app.get('/api/delivery/providers', (req, res) => {
  res.json([
    {
      id: 'nova_poshta',
      name: 'Нова Пошта',
      note: 'Відділення та поштомати по всій Україні',
      configured: true,
      types: [
        { id: 'branch', name: 'Відділення Нової Пошти', icon: '🏢' },
        { id: 'postomat', name: 'Поштомат Нової Пошти', icon: '📦' }
      ]
    },
    {
      id: 'ukrposhta',
      name: 'Укрпошта',
      note: 'Відділення Укрпошти',
      configured: true,
      types: [
        { id: 'branch', name: 'Відділення Укрпошти', icon: '📮' }
      ]
    }
  ]);
});

app.get('/api/delivery/:provider_id/cities', async (req, res) => {
  try {
    const provider = req.params.provider_id || 'nova_poshta';
    const query = req.query.query || '';
    const cities = await searchCities(query, provider);
    res.json(cities);
  } catch (err) {
    res.status(500).json({ detail: 'Помилка пошуку міст: ' + err.message });
  }
});

app.get('/api/delivery/:provider_id/warehouses', async (req, res) => {
  try {
    const provider = req.params.provider_id || 'nova_poshta';
    const cityName = req.query.city_name || req.query.cityName || 'Київ';
    const cityRef = req.query.city_ref || req.query.cityRef || '';
    const type = req.query.type || 'all'; // branch | postomat | all
    const query = req.query.query || '';
    const limit = Number(req.query.limit) || 120;

    const warehouses = await searchWarehouses({
      cityName,
      cityRef,
      type,
      query,
      limit,
      provider
    });
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ detail: 'Помилка пошуку відділень: ' + err.message });
  }
});

// ----------------------------------------------------
// Orders & Telegram Payments APIs
// ----------------------------------------------------
app.post('/api/orders', async (req, res) => {
  const { customer, delivery, payment, items, comment } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ detail: 'Кошик порожній' });
  }

  const firstName = (customer?.first_name || customer?.firstName || customer?.name || '').trim();
  const lastName = (customer?.last_name || customer?.lastName || customer?.surname || '').trim();
  const middleName = (customer?.middle_name || customer?.patronymic || customer?.middleName || '').trim();
  const phone = (customer?.phone || '').trim();
  const email = (customer?.email || '').trim().toLowerCase();

  if (!firstName) {
    return res.status(400).json({ detail: "Вкажіть ваше ім'я" });
  }
  if (!lastName) {
    return res.status(400).json({ detail: 'Вкажіть ваше прізвище' });
  }
  if (!phone) {
    return res.status(400).json({ detail: 'Вкажіть номер телефону' });
  }

  // Calculate pricing
  let subtotal = 0;
  const pricedItems = [];

  for (const it of items) {
    const prod = db.getProductById(it.id);
    const unitPrice = prod ? prod.price : Number(it.price || 0);
    const qty = Math.max(1, Number(it.qty || 1));
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    pricedItems.push({
      id: it.id,
      title: prod ? prod.title : (it.title || 'Товар'),
      brand: prod ? prod.brand : (it.brand || 'MILIPSTORE'),
      sku: prod?.sku || it.sku || `SKU-${it.id}`,
      color: it.color || '',
      img: it.img || prod?.img || '/images.png',
      price: unitPrice,
      qty: qty,
      total: lineTotal
    });
  }

  const paymentMethod = payment?.method || 'manager'; // 'manager' | 'online' | 'cod'
  const isCod = paymentMethod === 'cod';
  const codFee = isCod ? Math.round(20 + (subtotal * 0.02)) : 0;
  const total = subtotal + codFee;

  // Extract Telegram user if present
  const tgUser = extractTelegramUser(req) || {};
  let telegramId = customer?.telegram_id || tgUser.id || null;
  let telegramUsername = customer?.telegram_username || tgUser.username || null;

  // Fallback: match by phone if telegramId is not in request
  if (!telegramId && phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    for (const [tid, u] of Object.entries(db.data.telegram_users || {})) {
      const uPhone = (u.phone || '').replace(/\D/g, '');
      if (uPhone && (uPhone === cleanPhone || (cleanPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))))) {
        telegramId = tid;
        if (!telegramUsername && u.telegram_username) {
          telegramUsername = u.telegram_username;
        }
        break;
      }
    }
  }

  try {
    const order = db.createOrder({
      subtotal,
      delivery_fee: 0,
      cod_fee: codFee,
      total,
      customer: {
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        phone,
        email,
        telegram_id: telegramId,
        telegram_username: telegramUsername
      },
      delivery: {
        provider: delivery?.provider || 'nova_poshta',
        type: delivery?.type || delivery?.method || 'branch',
        city: delivery?.city || '',
        cityRef: delivery?.cityRef || delivery?.city_ref || '',
        warehouseRef: delivery?.warehouseRef || delivery?.warehouse_ref || '',
        warehouse_number: delivery?.warehouse_number || delivery?.department || '',
        department: delivery?.department || delivery?.warehouse_number || '',
        address: delivery?.address || delivery?.department || ''
      },
      payment: {
        method: paymentMethod,
        provider: paymentMethod === 'manager' 
          ? 'Через менеджера (@milipmanager)' 
          : (paymentMethod === 'online' ? 'Smart Glocal Test (Telegram Payments)' : 'Оплата при отриманні (Накладений платіж)'),
        status: paymentMethod === 'manager' ? 'PENDING_MANAGER' : (isCod ? 'PENDING_ON_DELIVERY' : 'PENDING'),
        comment: (comment || payment?.comment || '').trim()
      },
      items: pricedItems
    });

    // Create Telegram invoice link if online payment
    let invoiceLink = null;
    if (paymentMethod === 'online') {
      try {
        invoiceLink = await botService.createInvoiceLink(order);
      } catch (err) {
        console.warn('[Orders] Could not generate Telegram invoice link:', err.message);
      }
    }

    // Link order to Telegram user and phone in database
    if (order.customer?.telegram_id) {
      db.linkOrderToTelegramUser(order.customer.telegram_id, order.order_id, order.customer);
    }
    if (phone) {
      db.linkOrderToPhone(phone, order.order_id);
    }

    // Send notifications to Admin and Customer
    await botService.sendOrderCreatedNotifications(order);

    res.json({
      status: 'success',
      order_id: order.order_id,
      id: order.order_id,
      order,
      invoice_link: invoiceLink,
      subtotal,
      cod_fee: codFee,
      total,
      provider: 'Smart Glocal Test'
    });
  } catch (err) {
    console.error('[Orders] Failed to create order:', err);
    res.status(500).json({ detail: 'Не вдалося створити замовлення: ' + err.message });
  }
});

app.get('/api/orders/:order_id', (req, res) => {
  const order = db.getOrderById(req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json(order);
});

// Pay / Create invoice link endpoint
app.post('/api/orders/:order_id/pay', async (req, res) => {
  const order = db.getOrderById(req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }

  let invoiceLink = null;
  try {
    invoiceLink = await botService.createInvoiceLink(order);
  } catch (e) {
    // invoice link optional
  }

  res.json({
    status: 'ready',
    order_id: order.order_id,
    total: order.total,
    provider: 'Smart Glocal Test',
    invoice_link: invoiceLink
  });
});

// Secure Payment Verification endpoint
app.post('/api/orders/:order_id/confirm-payment', async (req, res) => {
  const order = db.getOrderById(req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }

  const { transaction_id, provider, payment_token } = req.body;

  // Validate that token or transaction is provided
  const txId = transaction_id || `SG_TX_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const updatedOrder = db.updateOrderPayment(order.order_id, {
    method: 'online',
    provider: provider || 'Smart Glocal Test (Telegram Payments)',
    status: 'PAID',
    transaction_id: txId,
    paid_at: new Date().toISOString()
  });

  // Notify customer and admins
  await botService.sendCustomerPaymentSuccess(updatedOrder);
  await botService.sendAdminPaymentSuccess(updatedOrder);

  res.json({
    status: 'success',
    detail: 'Оплату успішно підтверджено',
    order: updatedOrder
  });
});

// Public search for customer orders by phone or order number
app.get('/api/orders-lookup', (req, res) => {
  const query = (req.query.query || req.query.phone || '').toString().trim();
  if (!query) {
    return res.json([]);
  }

  // If order number format
  if (/^#?MLP-?\d+/i.test(query)) {
    const single = db.getOrderById(query);
    return res.json(single ? [single] : []);
  }

  // Otherwise by phone
  const orders = db.getOrdersByPhone(query);
  res.json(orders);
});

// ----------------------------------------------------
// User Profile & Telegram Orders
// ----------------------------------------------------
app.get('/api/users/me/profile', (req, res) => {
  const tgUser = extractTelegramUser(req);
  if (tgUser) {
    const dbUser = db.data.telegram_users[String(tgUser.id)];
    return res.json({
      telegram_id: tgUser.id,
      first_name: tgUser.first_name || '',
      last_name: tgUser.last_name || '',
      username: tgUser.username || '',
      phone: dbUser?.phone || '',
      saved_deliveries: []
    });
  }

  res.json({
    first_name: 'Гість',
    last_name: '',
    phone: '',
    saved_deliveries: []
  });
});

app.get('/api/users/me/orders', (req, res) => {
  const tgUser = extractTelegramUser(req);
  if (tgUser && tgUser.id) {
    const userOrders = db.getOrdersByTelegramId(tgUser.id);
    return res.json(userOrders);
  }

  // Fallback: phone query if provided
  if (req.query.phone) {
    return res.json(db.getOrdersByPhone(req.query.phone));
  }

  res.json([]);
});

// ----------------------------------------------------
// Admin APIs: Orders Management
// ----------------------------------------------------
app.get('/api/admin/check', (req, res) => {
  res.json({
    ok: true,
    user: { id: 1, first_name: 'Admin', role: 'store_owner' },
    status_definitions: ORDER_STATUSES
  });
});

app.get('/api/admin/orders', (req, res) => {
  const orders = db.getOrders(req.query);
  res.json(orders);
});

// Alias for orders list
app.get('/api/orders', (req, res) => {
  const orders = db.getOrders(req.query);
  res.json(orders);
});

app.get('/api/admin/orders/:order_id', (req, res) => {
  const order = db.getOrderById(req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json(order);
});

const handleStatusUpdate = async (req, res) => {
  const { status, note, ttn } = req.body;
  if (!status || !ORDER_STATUSES[status]) {
    return res.status(400).json({ detail: 'Невалідний статус: ' + status });
  }

  try {
    const result = db.updateOrderStatus(req.params.order_id, status, 'Admin', note);
    if (!result) {
      return res.status(404).json({ detail: 'Замовлення не знайдено' });
    }

    if (ttn) {
      db.updateOrderTtn(req.params.order_id, ttn, 'Admin');
    }

    // Dispatches automatic notification to customer in Telegram
    await botService.notifyCustomerStatusChange(result.order, status, ttn);

    res.json({
      status: 'success',
      order: result.order,
      history_entry: result.historyEntry
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

app.patch('/api/admin/orders/:order_id/status', handleStatusUpdate);
app.patch('/api/orders/:order_id/status', handleStatusUpdate);

const handleTtnUpdate = async (req, res) => {
  const { ttn } = req.body;
  if (!ttn) {
    return res.status(400).json({ detail: 'Вкажіть номер ТТН' });
  }

  const order = db.updateOrderTtn(req.params.order_id, ttn, 'Admin');
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }

  // Notify customer with the new TTN
  await botService.notifyCustomerStatusChange(order, order.status, ttn);

  res.json({ status: 'success', order, ttn });
};

app.patch('/api/admin/orders/:order_id/ttn', handleTtnUpdate);
app.patch('/api/orders/:order_id/ttn', handleTtnUpdate);

const handleCommentUpdate = (req, res) => {
  const { comment } = req.body;
  const order = db.updateOrderComment(req.params.order_id, comment);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json({ status: 'success', order });
};

app.patch('/api/admin/orders/:order_id/comment', handleCommentUpdate);
app.patch('/api/orders/:order_id/comment', handleCommentUpdate);

const handleDeleteOrder = (req, res) => {
  const deleted = db.deleteOrder(req.params.order_id);
  if (!deleted) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json({ status: 'success', detail: 'Замовлення успішно видалено' });
};

app.delete('/api/admin/orders/:order_id', handleDeleteOrder);
app.delete('/api/orders/:order_id', handleDeleteOrder);

app.get('/api/admin/stats', (req, res) => {
  const stats = db.getStats();
  res.json(stats);
});

// Alias for stats
app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  res.json(stats);
});

app.get('/api/admin/notifications', (req, res) => {
  res.json(db.getNotifications());
});

app.get('/api/admin/products', (req, res) => {
  res.json(db.data.products);
});

app.get('/api/admin/categories', (req, res) => {
  res.json(db.getCategories());
});

app.get('/api/admin/brands', (req, res) => {
  res.json(db.getBrands());
});

// ----------------------------------------------------
// Sync & Cloud Database Management APIs
// ----------------------------------------------------
app.get('/api/sync/status', (req, res) => {
  res.json({
    ok: true,
    server_time: new Date().toISOString(),
    products_count: db.data.products.length,
    brands_count: db.data.brands.length,
    categories_count: db.data.categories.length,
    orders_count: db.data.orders.length,
    last_cloud_sync: db.data.last_cloud_sync,
    cloud_url: process.env.CLOUD_SYNC_URL || 'https://m1lipstore.onrender.com',
    version: '1.0.0'
  });
});

app.get('/api/sync/cloud-pull', async (req, res) => {
  try {
    const cloudUrl = req.query.url || process.env.CLOUD_SYNC_URL || 'https://m1lipstore.onrender.com';
    const result = await db.syncWithCloud(cloudUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, detail: err.message });
  }
});

app.get('/api/sync/backup', (req, res) => {
  const backup = db.exportBackup();
  res.json(backup);
});

app.post('/api/sync/restore', (req, res) => {
  try {
    db.importBackup(req.body);
    res.json({ ok: true, message: 'Дані успішно відновлено та синхронізовано' });
  } catch (err) {
    res.status(400).json({ ok: false, detail: err.message });
  }
});

app.post('/api/sync/reset-demo', (req, res) => {
  try {
    db.resetDemoData();
    res.json({ ok: true, message: 'Стандартні дані відновлено' });
  } catch (err) {
    res.status(400).json({ ok: false, detail: err.message });
  }
});

app.delete('/api/sync/products/all', (req, res) => {
  try {
    db.clearAllProducts();
    res.json({ ok: true, message: 'Каталог повністю очищено' });
  } catch (err) {
    res.status(400).json({ ok: false, detail: err.message });
  }
});

const localTelegramPhotoMap = {
  'photos/file_25.jpg': 'photo_2026-08-25_15-31-22.jpg',
  'photos/file_26.jpg': 'photo_2026-08-25_15-32-36.jpg',
  'photos/file_27.jpg': 'photo_2026-08-25_15-32-36.jpg',
  'photos/file_28.jpg': 'photo_2026-08-25_15-32-36.jpg',
  'photos/file_29.jpg': 'photo_2026-08-25_15-31-28.jpg',
  'photos/file_30.jpg': 'photo_2026-08-25_15-31-22.jpg',
  'photos/file_31.jpg': 'photo_2026-08-25_15-31-28.jpg',
  'photos/file_32.jpg': 'photo_2026-08-25_15-31-22.jpg',
  'photos/file_33.jpg': 'photo_2026-08-25_15-31-28.jpg',
  'photos/file_34.jpg': 'photo_2026-08-25_15-32-13.jpg',
  'photos/file_35.jpg': 'photo_2026-08-25_15-32-13.jpg',
  'photos/file_36.jpg': 'photo_2026-08-25_15-32-13.jpg',
  'photos/file_37.jpg': 'photo_2026-08-25_15-32-17.jpg',
  'photos/file_38.jpg': 'photo_2026-08-25_15-32-17.jpg',
  'photos/file_39.jpg': 'photo_2026-08-25_15-32-17.jpg',
  'photos/file_40.jpg': 'photo_2026-08-25_15-32-17.jpg',
  'photos/file_41.jpg': 'photo_2026-08-25_15-32-17.jpg',
  'photos/file_42.jpg': 'photo_2026-08-25_15-32-36.jpg',

  'photos/file_43.jpg': 'photo_2026-08-25_15-32-38.jpg',
  'photos/file_44.jpg': 'photo_2026-08-25_15-33-39.jpg',
  'photos/file_45.jpg': 'photo_2026-08-25_15-32-40.jpg',
  'photos/file_46.jpg': 'photo_2026-08-25_15-33-42.jpg',

  'photos/file_47.jpg': 'attack-shark-r5-ultra-box-bundle-contents.jpg',
  'photos/file_48.jpg': 'attack-shark-r5-ultra-top-angle.jpg',
  'photos/file_49.jpg': 'attack-shark-r5-ultra-back-grip.jpg',
  'photos/file_50.jpg': 'attack-shark-r5-ultra-colors-price.jpg',
  'photos/file_51.jpg': 'attack-shark-r5-ultra-in-hand-setup.jpg',
  'photos/file_52.jpg': 'attack-shark-r5-ultra-colors-price.jpg',

  'photos/file_58.jpg': 'photo_2026-08-25_15-32-42.jpg',
  'photos/file_59.jpg': 'photo_2026-08-25_15-33-43.jpg',

  'photos/file_60.jpg': 'photo_2026-08-25_15-32-44.jpg',
  'photos/file_61.jpg': 'photo_2026-08-25_15-33-49.jpg',
  'photos/file_62.jpg': 'photo_2026-08-25_15-32-44.jpg',
  'photos/file_63.jpg': 'photo_2026-08-25_15-33-49.jpg',

  'photos/file_64.jpg': 'photo_2026-08-25_15-32-46.jpg',
  'photos/file_65.jpg': 'photo_2026-08-25_15-33-50.jpg',
  'photos/file_66.jpg': 'photo_2026-08-25_15-32-46.jpg',
  'photos/file_67.jpg': 'photo_2026-08-25_15-33-50.jpg',

  'photos/file_68.jpg': 'photo_2026-08-25_15-32-57.jpg',
  'photos/file_69.jpg': 'photo_2026-08-25_15-33-52.jpg',
  'photos/file_70.jpg': 'photo_2026-08-25_15-32-57.jpg',

  'photos/file_71.jpg': 'photo_2026-08-25_15-32-59.jpg',
  'photos/file_72.jpg': 'photo_2026-08-25_15-35-39.jpg',
  'photos/file_73.jpg': 'photo_2026-08-25_15-32-59.jpg',

  'photos/file_74.jpg': 'photo_2026-08-25_15-33-02.jpg',
  'photos/file_75.jpg': 'photo_2026-08-25_15-35-47.jpg',
  'photos/file_76.jpg': 'photo_2026-08-25_15-33-02.jpg'
};

app.get('/api/tg-file/*', async (req, res) => {
  const filePath = req.params[0];
  if (!filePath) {
    return res.status(404).send('File not found');
  }

  // 1. Check local mapped files first
  if (localTelegramPhotoMap[filePath]) {
    const localTarget = path.resolve(localTelegramPhotoMap[filePath]);
    if (fs.existsSync(localTarget)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(localTarget);
    }
  }

  // 2. Otherwise fetch dynamically using the bot token
  const token = process.env.BOT_TOKEN;
  if (!token) {
    return res.status(404).send('File not found');
  }
  try {
    const tgUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileRes = await fetch(tgUrl);
    if (!fileRes.ok) return res.status(fileRes.status).send('File not found');
    const contentType = fileRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await fileRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send('Error loading image');
  }
});

app.get('/api/bot-info', (req, res) => {
  res.json({
    username: botService.getBotUsername(),
    name: botService.botInfo?.first_name || 'MILIPSTORE Bot'
  });
});

app.post('/api/telegram/webhook', async (req, res) => {
  if (req.body) {
    try {
      await botService.handleUpdate(req.body);
    } catch (e) {
      console.error('[Webhook] Error:', e);
    }
  }
  res.json({ ok: true });
});

// ----------------------------------------------------
// Static File Serving & Entry Point
// ----------------------------------------------------
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MILIPSTORE server running on http://0.0.0.0:${PORT}`);

  // Auto-sync with cloud on startup
  setTimeout(async () => {
    try {
      const syncRes = await db.syncWithCloud('https://m1lipstore.onrender.com');
      if (syncRes.ok && !syncRes.skipped) {
        console.log(`[CloudSync] Initial sync completed: ${syncRes.products_count} products, ${syncRes.orders_count || 0} orders.`);
      }
    } catch(e) {
      console.warn('[CloudSync] Initial startup sync skipped/failed:', e.message);
    }
  }, 1500);

  // Background sync every 90 seconds
  setInterval(async () => {
    try {
      await db.syncWithCloud('https://m1lipstore.onrender.com');
    } catch(e) {}
  }, 90000);
});
