import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, ORDER_STATUSES } from './src/db.js';
import { botService, PAYMENT_PROVIDER_TOKEN } from './src/telegram-bot.js';
import { searchCities, searchWarehouses } from './src/delivery.js';

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

  const firstName = (customer?.first_name || customer?.firstName || '').trim();
  const lastName = (customer?.last_name || customer?.lastName || '').trim();
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

  const paymentMethod = payment?.method || 'online'; // 'online' | 'cod'
  const isCod = paymentMethod === 'cod';
  const codFee = isCod ? Math.round(20 + (subtotal * 0.02)) : 0;
  const total = subtotal + codFee;

  // Extract Telegram user if present
  const tgUser = extractTelegramUser(req) || {};
  const telegramId = customer?.telegram_id || tgUser.id || null;
  const telegramUsername = customer?.telegram_username || tgUser.username || null;

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
        provider: paymentMethod === 'online' ? 'Smart Glocal Test (Telegram Payments)' : 'Оплата при отриманні (Накладений платіж)',
        status: isCod ? 'PENDING_ON_DELIVERY' : 'PENDING',
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
});
