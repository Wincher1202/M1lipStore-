import { db, ORDER_STATUSES } from './db.js';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const ADMIN_IDS = (process.env.ADMIN_IDS || '1929165295,1248134309').split(',').map(s => s.trim()).filter(Boolean);
export const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '1877036958:TEST:3ee3e1f439bade2f14881b4f9a87c61392fa6ec6';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramBotService {
  constructor() {
    this.pollingActive = false;
    this.lastUpdateId = 0;
    this.botInfo = null;
    this.adminSessions = {}; // chatId -> { action: 'awaiting_ttn', orderId: '...' }
  }

  async callApi(method, body = {}) {
    if (!BOT_TOKEN) {
      return { ok: false, description: 'BOT_TOKEN is not configured in environment' };
    }
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`[TelegramBot] API call failed (${method}):`, err.message);
      return { ok: false, description: err.message };
    }
  }

  async init() {
    if (!BOT_TOKEN) {
      console.log('[TelegramBot] BOT_TOKEN not specified. Bot notifications will be recorded in DB audit logs.');
      return;
    }

    try {
      const me = await this.callApi('getMe');
      if (me.ok) {
        this.botInfo = me.result;
        console.log(`[TelegramBot] Connected as @${me.result.username} (${me.result.first_name})`);
        this.startPolling();
      } else {
        console.warn('[TelegramBot] Failed to authenticate with Telegram:', me.description);
      }
    } catch (err) {
      console.error('[TelegramBot] Initialization error:', err.message);
    }
  }

  getBotUsername() {
    return this.botInfo?.username || 'm1lipstore_bot';
  }

  // Admin access validation
  isAdmin(from) {
    if (!from) return false;
    const fromId = String(from.id || '');
    const username = (from.username || '').toLowerCase().replace(/^@/, '');

    const configured = [...ADMIN_IDS, ...db.getAdminIds()].map(s => s.toLowerCase().replace(/^@/, ''));
    if (configured.includes(fromId)) return true;
    if (username && configured.includes(username)) return true;

    return false;
  }

  getAllAdminChatIds() {
    const list = [...ADMIN_IDS, ...db.getAdminIds()];
    // Only return numeric chat IDs
    return list.filter(id => /^\d+$/.test(id));
  }

  async startPolling() {
    if (this.pollingActive) return;
    this.pollingActive = true;
    console.log('[TelegramBot] Long polling started...');

    const poll = async () => {
      if (!this.pollingActive) return;
      try {
        const res = await this.callApi('getUpdates', {
          offset: this.lastUpdateId + 1,
          timeout: 25,
          allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
        });

        if (res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            this.lastUpdateId = update.update_id;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        await new Promise(r => setTimeout(r, 3000));
      }

      if (this.pollingActive) {
        setTimeout(poll, 300);
      }
    };

    poll();
  }

  stopPolling() {
    this.pollingActive = false;
  }

  async handleUpdate(update) {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      } else if (update.pre_checkout_query) {
        await this.handlePreCheckoutQuery(update.pre_checkout_query);
      }
    } catch (err) {
      console.error('[TelegramBot] Error processing update:', err);
    }
  }

  getReplyKeyboard(from) {
    const isAdminUser = this.isAdmin(from);
    const keyboard = [];

    if (isAdminUser) {
      keyboard.push([{ text: '👑 Панель адміністратора' }, { text: '📦 Переглянути замовлення' }]);
    }

    keyboard.push([{ text: '🛍 Мої замовлення' }, { text: '🌐 Відкрити магазин' }]);
    keyboard.push([{ text: '📦 Відстежити замовлення' }, { text: '💬 Підтримка' }]);

    return {
      keyboard,
      resize_keyboard: true
    };
  }

  async handleMessage(msg) {
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    const from = msg.from || {};

    if (!chatId) return;

    // Track user in database
    if (from.id) {
      db.linkOrderToTelegramUser(from.id, '', {
        first_name: from.first_name || '',
        last_name: from.last_name || '',
        telegram_username: from.username || ''
      });
    }

    // WebApp Data from Telegram Mini App sendData
    if (msg.web_app_data && msg.web_app_data.data) {
      try {
        const orderData = JSON.parse(msg.web_app_data.data);
        if (!orderData.customer) orderData.customer = {};
        if (from.id) orderData.customer.telegram_id = from.id;
        if (from.username) orderData.customer.telegram_username = from.username;
        if (from.first_name && !orderData.customer.first_name) orderData.customer.first_name = from.first_name;
        if (from.last_name && !orderData.customer.last_name) orderData.customer.last_name = from.last_name;

        let order = orderData.order_id ? db.getOrderById(orderData.order_id) : null;
        if (!order) {
          order = db.createOrder(orderData);
        }
        db.linkOrderToTelegramUser(from.id, order.order_id, order.customer);

        await this.notifyAdminsNewOrder(order);
        await this.sendCustomerOrderWithPayment(chatId, order);
        return;
      } catch (err) {
        console.error('[TelegramBot] Failed to parse web_app_data:', err);
      }
    }

    // Check if admin is currently awaiting TTN input for an order
    if (this.adminSessions[chatId]?.action === 'awaiting_ttn') {
      const orderId = this.adminSessions[chatId].orderId;
      delete this.adminSessions[chatId];

      const ttn = text.replace(/[^\d]/g, '').trim() || text.trim();
      if (ttn.length < 5) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ Номер ТТН надто короткий. Будь ласка, введіть коректний номер ТТН або скористайтеся /ttn ${orderId} <номер>`,
          parse_mode: 'HTML'
        });
        return;
      }

      await this.processAdminSaveTtn(chatId, orderId, ttn);
      return;
    }

    // Successful payment notification from Telegram Payments
    if (msg.successful_payment) {
      const sp = msg.successful_payment;
      const payload = sp.invoice_payload || '';
      const orderId = payload.replace(/^order_/, '').trim();
      console.log(`[TelegramBot] Payment received for order ${orderId} via Telegram Payments!`);

      const order = db.updateOrderPayment(orderId, {
        method: 'online',
        provider: 'Telegram Payments (Smart Glocal Test)',
        status: 'PAID',
        transaction_id: sp.telegram_payment_charge_id || sp.provider_payment_charge_id,
        paid_at: new Date().toISOString()
      });

      if (order) {
        await this.sendCustomerPaymentSuccess(order);
        await this.sendAdminPaymentSuccess(order);
      }
      return;
    }

    // START / WELCOME / DEEP LINK
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const startParam = parts[1] || '';

      // Check if deep link for order payment or tracking: /start order_MLP-XXXXXX
      if (startParam.startsWith('order_')) {
        const orderId = startParam.replace('order_', '').trim();
        const order = db.getOrderById(orderId);

        if (order) {
          // Link customer telegram id to order
          order.customer.telegram_id = from.id;
          if (from.username) order.customer.telegram_username = from.username;
          db.linkOrderToTelegramUser(from.id, order.order_id, order.customer);
          db.save();

          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: `👋 Вітаємо, <b>${from.first_name || 'клієнт'}</b>!\nВаше замовлення <b>#${order.order_id}</b> знайдено в системі.`,
            parse_mode: 'HTML',
            reply_markup: this.getReplyKeyboard(from)
          });

          // Present order card and payment prompt
          await this.sendCustomerOrderWithPayment(chatId, order);
          return;
        }
      }

      const welcomeText = `👋 <b>Вітаємо в офіційному боті MILIPSTORE!</b>\n\n` +
        `🎮 <b>MILIPSTORE</b> — преміальні ігрові девайси та техніка для сетапу:\n` +
        `• Ультралегкі мишки (Attack Shark, Ajazz, Mchose, VGN)\n` +
        `• Кастомні механічні клавіатури з Gasket Mount\n` +
        `• Професійні ігрові поверхні Cordura Control\n\n` +
        `У цьому боті ви можете:\n` +
        `💳 Оплачувати замовлення онлайн безпосередньо в чаті\n` +
        `📦 Відстежувати статус замовлення та номер ТТН\n` +
        `🛍 Переглядати історію покупок`;

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'HTML',
        reply_markup: this.getReplyKeyboard(from)
      });
      return;
    }

    // OPEN WEB STORE
    if (text === '🌐 Відкрити магазин' || text === '🌐 Відкрити каталог') {
      const appUrl = process.env.PUBLIC_APP_URL || 'https://m1lipstore.ua';
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🛒 <b>Каталог MILIPSTORE</b>\n\nОбирайте найкращі ігрові девайси з доставкою по всій Україні:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Перейти до магазину', web_app: { url: appUrl } }]
          ]
        }
      });
      return;
    }

    // VIEW ORDERS FOR ADMIN / CUSTOMER
    if (
      text === '📦 Переглянути замовлення' ||
      text === 'Переглянути замовлення' ||
      text === '/all_orders' ||
      text === '/manage_orders'
    ) {
      if (this.isAdmin(from)) {
        await this.sendAdminOrdersList(chatId, 'ALL');
      } else {
        await this.sendCustomerOrdersList(chatId, from.id);
      }
      return;
    }

    // CUSTOMER ORDERS
    if (text === '🛍 Мої замовлення' || text === '/orders' || text === '/myorders') {
      if (this.isAdmin(from) && text === '/orders') {
        await this.sendAdminOrdersList(chatId, 'ALL');
      } else {
        await this.sendCustomerOrdersList(chatId, from.id);
      }
      return;
    }

    // ORDER TRACKING
    if (text === '📦 Відстежити замовлення' || text === '/track') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🔍 <b>Відстеження замовлення</b>\n\nВведіть номер вашого замовлення (наприклад, <code>MLP-120009</code>) або номер телефону, вказаний при оформленні:`,
        parse_mode: 'HTML'
      });
      return;
    }

    // SUPPORT
    if (text === '💬 Підтримка' || text === '/help') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💬 <b>Служба підтримки MILIPSTORE</b>\n\nГрафік роботи: Щодня 09:00 — 21:00\nTelegram менеджера: @milipmanager\nКанал магазину: @m1lipstore\n\nМи з радістю відповімо на будь-які ваші запитання!`,
        parse_mode: 'HTML'
      });
      return;
    }

    // ADMIN AUTHENTICATION
    if (text.startsWith('/admin_auth')) {
      const secret = text.split(' ')[1] || '';
      if (secret === 'milip2026' || secret === 'admin' || secret === 'store_admin') {
        db.addAdmin(from.id);
        if (from.username) db.addAdmin(from.username);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `🎉 <b>Авторизація успішна!</b>\nВас додано до списку адміністраторів магазину.`,
          parse_mode: 'HTML',
          reply_markup: this.getReplyKeyboard(from)
        });
        await this.sendAdminDashboard(chatId, from);
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ Невірний пароль адміністратора.`,
          parse_mode: 'HTML'
        });
      }
      return;
    }

    // ADMIN PANEL
    if (
      text === '👑 Панель адміністратора' ||
      text === '/admin' ||
      text === '/admin_orders' ||
      text === '⚙️ Адмін-панель' ||
      text === 'Панель адміністратора'
    ) {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `⛔ <b>Доступ обмежено</b>\nЦя команда доступна лише адміністраторам магазину (вказаним у тегах або налаштуваннях бота).\n\nЯкщо ви власник, авторизуйтесь: <code>/admin_auth milip2026</code>`,
          parse_mode: 'HTML'
        });
        return;
      }

      await this.sendAdminDashboard(chatId, from);
      return;
    }

    // ADMIN COMMAND: /confirm <order_id>
    if (text.startsWith('/confirm')) {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
        return;
      }
      const orderId = text.split(' ')[1];
      if (!orderId) {
        await this.callApi('sendMessage', { chat_id: chatId, text: 'Вкажіть номер замовлення: <code>/confirm MLP-123456</code>', parse_mode: 'HTML' });
        return;
      }
      await this.processAdminConfirmOrder(chatId, orderId);
      return;
    }

    // ADMIN COMMAND: /ttn <order_id> <ttn_number>
    if (text.startsWith('/ttn')) {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
        return;
      }
      const parts = text.split(/\s+/);
      const orderId = parts[1];
      const ttn = parts[2];
      if (!orderId || !ttn) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: 'Вкажіть номер замовлення та ТТН:\n<code>/ttn MLP-123456 20450918234851</code>',
          parse_mode: 'HTML'
        });
        return;
      }
      await this.processAdminSaveTtn(chatId, orderId, ttn);
      return;
    }

    // ADMIN COMMAND: /add_admin <id_or_username>
    if (text.startsWith('/add_admin')) {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
        return;
      }
      const newAdmin = text.split(' ')[1];
      if (!newAdmin) {
        await this.callApi('sendMessage', { chat_id: chatId, text: 'Вкажіть ID або тег: <code>/add_admin @username</code> або <code>/add_admin 12345678</code>', parse_mode: 'HTML' });
        return;
      }
      db.addAdmin(newAdmin);
      await this.callApi('sendMessage', { chat_id: chatId, text: `✅ Адміністратора <b>${newAdmin}</b> успішно додано!`, parse_mode: 'HTML' });
      return;
    }

    // ORDER ID LOOKUP BY NUMBER (e.g. #MLP-120009 or MLP-120009)
    if (/^(#?MLP-?\d{5,8})$/i.test(text)) {
      const order = db.getOrderById(text);
      if (order) {
        if (this.isAdmin(from)) {
          await this.sendAdminOrderDetails(chatId, order);
        } else {
          await this.sendCustomerOrderWithPayment(chatId, order);
        }
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ Замовлення з номером <b>${text}</b> не знайдено. Перевірте правильність номера та спробуйте ще раз.`,
          parse_mode: 'HTML'
        });
      }
      return;
    }

    // PHONE LOOKUP (e.g. +380991234567)
    if (/^(\+?38)?0\d{9}$/.test(text.replace(/[\s\-()]/g, ''))) {
      const orders = db.getOrdersByPhone(text);
      if (orders.length > 0) {
        let resp = `📦 <b>Знайдено замовлень за номером ${text} (${orders.length}):</b>\n\n`;
        const buttons = [];
        for (const o of orders.slice(0, 5)) {
          resp += `• <b>#${o.order_id}</b> — ${o.total} ₴ (${ORDER_STATUSES[o.status]?.name || o.status})\n`;
          buttons.push([{ text: `🔍 Замовлення #${o.order_id}`, callback_data: `view_order:${o.order_id}` }]);
        }
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: resp,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        });
        return;
      }
    }
  }

  async handleCallbackQuery(cb) {
    const data = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const msgId = cb.message?.message_id;
    const from = cb.from || {};

    await this.callApi('answerCallbackQuery', { callback_query_id: cb.id });

    // CUSTOMER: View single order
    if (data.startsWith('view_order:')) {
      const orderId = data.replace('view_order:', '').trim();
      const order = db.getOrderById(orderId);
      if (order) {
        await this.sendCustomerOrderWithPayment(chatId, order);
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ Замовлення #${orderId} не знайдено.`,
          parse_mode: 'HTML'
        });
      }
      return;
    }

    // CUSTOMER: Orders list
    if (data.startsWith('orders_list:')) {
      await this.sendCustomerOrdersList(chatId, from.id);
      return;
    }

    // CUSTOMER: Instant Smart Glocal Test Payment in Bot
    if (data.startsWith('pay_test:')) {
      const orderId = data.replace('pay_test:', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        await this.callApi('sendMessage', { chat_id: chatId, text: `❌ Замовлення #${orderId} не знайдено.` });
        return;
      }

      if (order.payment?.status === 'PAID') {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `ℹ️ Замовлення <b>#${orderId}</b> вже успішно оплачено раніше!`,
          parse_mode: 'HTML'
        });
        return;
      }

      const txId = `SG_TG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const updatedOrder = db.updateOrderPayment(orderId, {
        method: 'online',
        provider: 'Smart Glocal Test (Telegram Bot)',
        status: 'PAID',
        transaction_id: txId,
        paid_at: new Date().toISOString()
      });

      await this.sendCustomerPaymentSuccess(updatedOrder);
      await this.sendAdminPaymentSuccess(updatedOrder);
      return;
    }

    // CUSTOMER: Trigger Telegram Invoice
    if (data.startsWith('send_invoice:')) {
      const orderId = data.replace('send_invoice:', '').trim();
      const order = db.getOrderById(orderId);
      if (order) {
        await this.sendNativeTelegramInvoice(chatId, order);
      }
      return;
    }

    // ---------------------------------------------
    // ADMIN ACTIONS (Require isAdmin verification)
    // ---------------------------------------------
    if (!this.isAdmin(from)) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `⛔ Дія доступна тільки адміністраторам.`,
        parse_mode: 'HTML'
      });
      return;
    }

    // Admin Dashboard Refresh or Back to Admin
    if (data === 'admin_dashboard' || data === 'back_to_admin' || data === 'show_classic_admin') {
      await this.sendAdminDashboard(chatId, from);
      return;
    }

    // Admin Orders List: handles view_orders, admin_orders, admin_view_orders, orders, and admin_list:FILTER
    if (
      data === 'view_orders' ||
      data === 'admin_orders' ||
      data === 'admin_view_orders' ||
      data === 'orders' ||
      data.startsWith('admin_list:')
    ) {
      const filter = data.startsWith('admin_list:') ? data.replace('admin_list:', '').trim() : 'ALL';
      await this.sendAdminOrdersList(chatId, filter);
      return;
    }

    // Admin View Order Details: handles show_order_ID and admin_view:ID
    if (data.startsWith('show_order_') || data.startsWith('admin_view:')) {
      const orderId = data.replace(/^show_order_/, '').replace(/^admin_view:/, '').trim();
      const order = db.getOrderById(orderId);
      if (order) {
        await this.sendAdminOrderDetails(chatId, order);
      } else {
        await this.callApi('sendMessage', { chat_id: chatId, text: `❌ Замовлення #${orderId} не знайдено.` });
      }
      return;
    }

    // Admin Quick Status Change (setstatus_ORDERID_STATUS)
    if (data.startsWith('setstatus_')) {
      const rest = data.replace('setstatus_', '').trim();
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        const orderId = rest.substring(0, lastUnderscore);
        const newStatus = rest.substring(lastUnderscore + 1);
        await this.processAdminStatusChange(chatId, orderId, newStatus);
        return;
      }
    }

    // Admin Confirm Order
    if (data.startsWith('admin_confirm:')) {
      const orderId = data.replace('admin_confirm:', '').trim();
      await this.processAdminConfirmOrder(chatId, orderId);
      return;
    }

    // Admin Request TTN Input
    if (data.startsWith('admin_ttn_prompt:')) {
      const orderId = data.replace('admin_ttn_prompt:', '').trim();
      this.adminSessions[chatId] = { action: 'awaiting_ttn', orderId };

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🚚 <b>Вкажіть номер ТТН для замовлення #${orderId}</b>\n\nНадішліть номер накладної (наприклад: <code>20450918234851</code>) наступним повідомленням у цей чат.\n\nАбо скористайтесь командою:\n<code>/ttn ${orderId} 20450918234851</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Скасувати введення', callback_data: `admin_view:${orderId}` }]
          ]
        }
      });
      return;
    }

    // Admin Change Status Menu
    if (data.startsWith('admin_status_menu:')) {
      const orderId = data.replace('admin_status_menu:', '').trim();
      await this.sendAdminStatusChangeMenu(chatId, orderId);
      return;
    }

    // Admin Set Status (colon syntax)
    if (data.startsWith('admin_set_status:')) {
      // format: admin_set_status:STATUS:ORDER_ID
      const parts = data.split(':');
      const newStatus = parts[1];
      const orderId = parts[2];
      await this.processAdminStatusChange(chatId, orderId, newStatus);
      return;
    }

    // Admin Add Product Prompt
    if (data === 'add_new_product') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `➕ <b>Додавання товару до каталогу:</b>\n\nВи можете додати товар за допомогою команди:\n<code>/add_product Бренд | Модель | Ціна | Категорія | Опис</code>\n\nАбо керувати товарами безпосередньо в каталозі магазину.`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }]]
        }
      });
      return;
    }

    // Admin Manage Product
    if (data.startsWith('manage_')) {
      const prodId = data.replace('manage_', '').trim();
      const prod = db.getProductById(prodId);
      if (prod) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `🏷 <b>${prod.brand} ${prod.title}</b>\n💰 Ціна: <b>${prod.price} ₴</b>\n📦 Залишок: <b>${prod.quantity} шт.</b>\nКатегорія: ${prod.category}`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗑 Видалити товар', callback_data: `delete_prod_${prod.id}` }],
              [{ text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }]
            ]
          }
        });
      }
      return;
    }

    // Admin Delete Product
    if (data.startsWith('delete_prod_')) {
      const prodId = data.replace('delete_prod_', '').trim();
      db.deleteProduct(prodId);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🗑 Товар успішно видалено з каталогу.`,
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }]]
        }
      });
      return;
    }
  }

  async handlePreCheckoutQuery(pcq) {
    console.log(`[TelegramBot] Pre-checkout query received for ${pcq.invoice_payload}`);
    await this.callApi('answerPreCheckoutQuery', {
      pre_checkout_query_id: pcq.id,
      ok: true
    });
  }

  // ----------------------------------------------------
  // Customer Presentation & Payment Flow
  // ----------------------------------------------------
  async sendCustomerOrderWithPayment(chatId, order) {
    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const payment = order.payment || {};
    const isOnline = payment.method === 'online';
    const isPaid = payment.status === 'PAID';
    const statusName = order.status_name || ORDER_STATUSES[order.status]?.name || order.status;

    let statusEmoji = '📦';
    if (order.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
    if (order.status === 'NEW') statusEmoji = '🆕';
    if (order.status === 'CONFIRMED') statusEmoji = '✅';
    if (order.status === 'SHIPPED') statusEmoji = '🚚';
    if (order.status === 'DELIVERED') statusEmoji = '🏢';
    if (order.status === 'COMPLETED') statusEmoji = '🎉';
    if (order.status === 'CANCELLED') statusEmoji = '❌';

    const itemsSummary = (order.items || []).map(i => {
      const color = i.color ? ` (${i.color})` : '';
      return `• <b>${i.title}</b>${color}\n  ${i.qty} шт. × ${i.price} ₴ = <b>${i.price * i.qty} ₴</b>`;
    }).join('\n');

    let text = `🛍 <b>Замовлення #${order.order_id}</b>\n\n`;
    text += `<b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n`;
    if (order.tracking_number) {
      text += `<b>Номер ТТН:</b> <code>${order.tracking_number}</code>\n`;
    }

    text += `\n<b>Товари:</b>\n${itemsSummary}\n\n`;
    text += `<b>Доставка:</b>\n`;
    text += `• ${delivery.provider_name || 'Нова Пошта'}, м. ${delivery.city}\n`;
    text += `• ${delivery.department || delivery.address}\n\n`;

    text += `<b>Оплата:</b>\n`;
    if (isOnline) {
      text += `• Спосіб: Онлайн (Smart Glocal Test)\n`;
      text += `• Стан: ${isPaid ? '✅ <b>Оплачено</b>' : '⏳ <b>Очікує оплати</b>'}\n`;
    } else {
      text += `• Спосіб: Оплата при отриманні (Накладений платіж)\n`;
      text += `• Стан: 📦 Оплата у відділенні\n`;
    }

    text += `\n💰 <b>Разом до сплати: ${order.total} ₴</b>\n`;

    const buttons = [];

    // If online and unpaid: Show payment action buttons in chat!
    if (isOnline && !isPaid) {
      text += `\n💳 <b>Оплата замовлення:</b>\nНатисніть кнопку нижче для миттєвої оплати прямо в чаті:`;
      buttons.push([
        { text: `💳 Оплатити замовлення (${order.total} ₴)`, callback_data: `send_invoice:${order.order_id}` }
      ]);
      buttons.push([
        { text: `⚡ Швидка оплата (Smart Glocal Test)`, callback_data: `pay_test:${order.order_id}` }
      ]);
    }

    buttons.push([
      { text: '🔄 Оновити статус', callback_data: `view_order:${order.order_id}` },
      { text: '📋 Всі мої замовлення', callback_data: `orders_list:${chatId}` }
    ]);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendNativeTelegramInvoice(chatId, order) {
    if (!BOT_TOKEN) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `⚠️ Оплата через Telegram Payments: скористайтеся тестовою кнопкою нижче:`,
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ Швидка тестова оплата (${order.total} ₴)`, callback_data: `pay_test:${order.order_id}` }]
          ]
        }
      });
      return;
    }

    const payload = `order_${order.order_id}`;
    const amountInKopecks = Math.round(Number(order.total) * 100);

    const invoiceParams = {
      chat_id: chatId,
      title: `Замовлення #${order.order_id}`,
      description: `Оплата замовлення в інтернет-магазині MILIPSTORE (${order.items.length} поз.)`,
      payload,
      provider_token: PAYMENT_PROVIDER_TOKEN,
      currency: 'UAH',
      prices: [
        { label: `Замовлення #${order.order_id}`, amount: amountInKopecks }
      ],
      start_parameter: `order_${order.order_id}`,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      is_flexible: false
    };

    const res = await this.callApi('sendInvoice', invoiceParams);
    if (!res.ok) {
      console.warn('[TelegramBot] sendInvoice failed:', res.description);
      // Fallback message with quick test payment button
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💳 <b>Оплата замовлення #${order.order_id}</b>\nСума до сплати: <b>${order.total} ₴</b>\n\nВи можете провести тестову оплату за допомогою кнопки:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ Підтвердити оплату ${order.total} ₴ (Smart Glocal Test)`, callback_data: `pay_test:${order.order_id}` }]
          ]
        }
      });
    }
  }

  async sendCustomerOrdersList(chatId, telegramUserId) {
    const orders = db.getOrdersByTelegramId(telegramUserId || chatId);

    if (!orders || orders.length === 0) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🛍 <b>Мої замовлення</b>\n\nУ вас поки немає оформлених замовлень.\nОберіть девайси в нашому магазині та оформлюйте замовлення!`,
        parse_mode: 'HTML'
      });
      return;
    }

    let text = `🛍 <b>Ваші замовлення (${orders.length}):</b>\n\n`;
    const buttons = [];

    orders.slice(0, 6).forEach(o => {
      let emoji = '📦';
      if (o.status === 'PENDING_PAYMENT') emoji = '⏳';
      if (o.status === 'NEW') emoji = '🆕';
      if (o.status === 'CONFIRMED') emoji = '✅';
      if (o.status === 'SHIPPED') emoji = '🚚';
      if (o.status === 'COMPLETED') emoji = '🎉';
      if (o.status === 'CANCELLED') emoji = '❌';

      const isUnpaid = o.payment?.method === 'online' && o.payment?.status !== 'PAID';
      const itemsBrief = o.items.map(i => `${i.qty}× ${i.title}`).join(', ');

      text += `<b>#${o.order_id}</b> — <b>${o.total} ₴</b>\n`;
      text += `• ${itemsBrief}\n`;
      text += `• Статус: ${emoji} <b>${ORDER_STATUSES[o.status]?.name || o.status}</b>`;
      if (isUnpaid) text += ` • ⚠️ <i>Очікує оплати</i>`;
      if (o.tracking_number) text += `\n• ТТН: <code>${o.tracking_number}</code>`;
      text += `\n\n`;

      if (isUnpaid) {
        buttons.push([{
          text: `💳 Оплатити #${o.order_id} (${o.total} ₴)`,
          callback_data: `view_order:${o.order_id}`
        }]);
      } else {
        buttons.push([{
          text: `🔍 Деталі #${o.order_id} (${o.total} ₴)`,
          callback_data: `view_order:${o.order_id}`
        }]);
      }
    });

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // ----------------------------------------------------
  // Admin Management Flow
  // ----------------------------------------------------
  async sendAdminDashboard(chatId, from) {
    const stats = db.getStats();
    const orders = db.getOrders();

    const newCount = orders.filter(o => o.status === 'NEW').length;
    const pendingPaymentCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length;
    const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length;
    const shippedCount = orders.filter(o => o.status === 'SHIPPED').length;

    let text = `👑 <b>Панель керування MILIPSTORE</b>\n`;
    text += `Адміністратор: <b>${from.first_name || ''}</b> ${from.username ? '(@' + from.username + ')' : ''}\n\n`;
    text += `📊 <b>Статистика замовлень:</b>\n`;
    text += `• 🆕 Нових замовлень: <b>${newCount}</b>\n`;
    text += `• ⏳ Очікують оплати: <b>${pendingPaymentCount}</b>\n`;
    text += `• 📦 Підтверджених: <b>${confirmedCount}</b>\n`;
    text += `• 🚚 Відправлених: <b>${shippedCount}</b>\n`;
    text += `• 📋 Всього замовлень: <b>${stats.total_orders}</b>\n`;
    text += `• 💰 Загальний дохід: <b>${stats.total_sales.toLocaleString('uk-UA')} ₴</b>\n\n`;
    text += `Оберіть дію або категорію для перегляду:`;

    const buttons = [
      [
        { text: '📦 Переглянути замовлення', callback_data: 'view_orders' }
      ],
      [
        { text: `🆕 Нові (${newCount})`, callback_data: 'admin_list:NEW' },
        { text: `⏳ Очікують (${pendingPaymentCount})`, callback_data: 'admin_list:PENDING_PAYMENT' }
      ],
      [
        { text: `📦 Підтверджені (${confirmedCount})`, callback_data: 'admin_list:CONFIRMED' },
        { text: `🚚 Відправлені (${shippedCount})`, callback_data: 'admin_list:SHIPPED' }
      ],
      [
        { text: `📋 Всі замовлення (${stats.total_orders})`, callback_data: 'admin_list:ALL' },
        { text: '➕ Додати новий товар', callback_data: 'add_new_product' }
      ],
      [
        { text: '🔄 Оновити дані', callback_data: 'admin_dashboard' }
      ]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminOrdersList(chatId, filter = 'ALL') {
    let orders = db.getOrders();
    let filterTitle = 'Всі замовлення';

    if (filter !== 'ALL') {
      orders = orders.filter(o => o.status === filter);
      filterTitle = ORDER_STATUSES[filter]?.name || filter;
    }

    if (orders.length === 0) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `📋 <b>${filterTitle}:</b>\n\nНаразі немає замовлень у цій категорії.`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Всі замовлення', callback_data: 'view_orders' },
              { text: '🔙 До панелі керування', callback_data: 'admin_dashboard' }
            ]
          ]
        }
      });
      return;
    }

    let text = `📋 <b>${filterTitle} (${orders.length}):</b>\n\n`;
    text += `Оберіть замовлення зі списку для перегляду та зміни статусу:\n\n`;

    const buttons = [];

    orders.slice(0, 10).forEach(o => {
      const name = `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Клієнт';
      const statusLabel = ORDER_STATUSES[o.status]?.name || o.status;
      let statusIcon = '📦';
      if (o.status === 'NEW') statusIcon = '🆕';
      else if (o.status === 'PENDING_PAYMENT') statusIcon = '⏳';
      else if (o.status === 'CONFIRMED') statusIcon = '✅';
      else if (o.status === 'SHIPPED') statusIcon = '🚚';
      else if (o.status === 'DELIVERED') statusIcon = '🏢';
      else if (o.status === 'CANCELLED') statusIcon = '❌';

      text += `${statusIcon} <b>#${o.order_id}</b> — <b>${o.total} ₴</b> | <i>${statusLabel}</i>\n`;
      text += `👤 ${name} (<code>${o.customer?.phone || 'без тел.'}</code>)\n`;
      text += `📍 ${o.delivery?.city || ''}, ${o.delivery?.department || o.delivery?.address || ''}\n`;
      if (o.tracking_number) text += `🚚 ТТН: <code>${o.tracking_number}</code>\n`;
      text += `\n`;

      const row = [
        { text: `🔍 #${o.order_id} | ${o.total} ₴ | ${statusIcon}`, callback_data: `admin_view:${o.order_id}` }
      ];
      if (o.status === 'NEW' || o.status === 'PENDING_PAYMENT') {
        row.push({ text: `✅ Підтвердити`, callback_data: `admin_confirm:${o.order_id}` });
      }
      buttons.push(row);
    });

    buttons.push([
      { text: '🆕 Нові', callback_data: 'admin_list:NEW' },
      { text: '⏳ Очікують', callback_data: 'admin_list:PENDING_PAYMENT' },
      { text: '✅ Підтверджені', callback_data: 'admin_list:CONFIRMED' }
    ]);
    buttons.push([
      { text: '🚚 Відправлені', callback_data: 'admin_list:SHIPPED' },
      { text: '📋 Всі', callback_data: 'admin_list:ALL' },
      { text: '🔄 Оновити', callback_data: 'view_orders' }
    ]);
    buttons.push([
      { text: '🔙 До панелі керування', callback_data: 'admin_dashboard' }
    ]);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminOrderDetails(chatId, order) {
    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const pay = order.payment || {};
    const statusName = ORDER_STATUSES[order.status]?.name || order.status;

    let statusEmoji = '📦';
    if (order.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
    if (order.status === 'NEW') statusEmoji = '🆕';
    if (order.status === 'CONFIRMED') statusEmoji = '✅';
    if (order.status === 'PACKING_PREP') statusEmoji = '⚙️';
    if (order.status === 'PACKED') statusEmoji = '📦';
    if (order.status === 'DISPATCH_PREP') statusEmoji = '🚚';
    if (order.status === 'SHIPPED') statusEmoji = '🚚';
    if (order.status === 'DELIVERED') statusEmoji = '🏢';
    if (order.status === 'COMPLETED') statusEmoji = '🎉';
    if (order.status === 'CANCELLED') statusEmoji = '❌';

    const itemsText = (order.items || []).map(i => {
      const color = i.color ? ` (${i.color})` : '';
      return `• <b>${i.title}</b>${color}\n  ${i.qty} шт. × ${i.price} ₴ = <b>${i.price * i.qty} ₴</b>`;
    }).join('\n');

    let text = `👑 <b>ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n`;
    text += `📊 <b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n`;
    text += `📅 <b>Дата:</b> ${new Date(order.created_at || Date.now()).toLocaleString('uk-UA')}\n`;
    if (order.tracking_number) {
      text += `🚚 <b>Номер ТТН:</b> <code>${order.tracking_number}</code>\n`;
    }

    text += `\n👤 <b>Покупець:</b>\n`;
    text += `• Ім'я: ${cust.first_name} ${cust.last_name || ''}\n`;
    text += `• Телефон: <code>${cust.phone || 'не вказано'}</code>\n`;
    if (cust.telegram_username) text += `• Telegram: @${cust.telegram_username}\n`;
    else if (cust.telegram_id) text += `• Telegram ID: <code>${cust.telegram_id}</code>\n`;
    if (cust.email) text += `• Email: ${cust.email}\n`;

    text += `\n🏢 <b>Доставка:</b>\n`;
    text += `• Служба: ${deliv.provider_name || 'Нова Пошта'}\n`;
    text += `• Місто: ${deliv.city}\n`;
    text += `• Відділення / адреса: ${deliv.department || deliv.address}\n`;

    text += `\n💳 <b>Оплата:</b>\n`;
    const payMethodName = pay.method === 'online' ? 'Онлайн у Telegram-боті' : 'Оплата при отриманні (Накладений платіж)';
    const payStatusName = pay.status === 'PAID' ? '✅ ОПЛАЧЕНО' : (pay.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');
    text += `• Спосіб: ${payMethodName}\n`;
    text += `• Статус: ${payStatusName}\n`;
    if (pay.transaction_id) text += `• ID транзакції: <code>${pay.transaction_id}</code>\n`;

    text += `\n🛍 <b>Товари (${order.items?.length || 0}):</b>\n${itemsText}\n\n`;
    text += `💰 <b>Загальна сума: ${order.total} ₴</b>\n`;
    if (order.admin_comment || pay.comment) {
      text += `📝 <b>Коментар:</b> <i>${order.admin_comment || pay.comment}</i>\n`;
    }

    const buttons = [];

    // Row 1: Primary actions
    if (order.status === 'NEW' || order.status === 'PENDING_PAYMENT') {
      buttons.push([
        { text: '✅ Підтвердити замовлення', callback_data: `admin_confirm:${order.order_id}` },
        { text: '🚚 Вказати ТТН / Відправити', callback_data: `admin_ttn_prompt:${order.order_id}` }
      ]);
    } else {
      buttons.push([
        { text: '🚚 Вказати / Змінити ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
      ]);
    }

    // Row 2: Direct status switcher
    buttons.push([
      { text: '🆕 Нове', callback_data: `setstatus_${order.order_id}_NEW` },
      { text: '⏳ Очікує', callback_data: `setstatus_${order.order_id}_PENDING_PAYMENT` },
      { text: '✅ Оплачено', callback_data: `setstatus_${order.order_id}_PAID` }
    ]);
    buttons.push([
      { text: '⚙️ В обробці', callback_data: `setstatus_${order.order_id}_PACKING_PREP` },
      { text: '🚚 Відправлено', callback_data: `setstatus_${order.order_id}_SHIPPED` },
      { text: '🏢 Доставлено', callback_data: `setstatus_${order.order_id}_DELIVERED` }
    ]);
    buttons.push([
      { text: '🎉 Виконано', callback_data: `setstatus_${order.order_id}_COMPLETED` },
      { text: '❌ Скасувати', callback_data: `setstatus_${order.order_id}_CANCELLED` }
    ]);

    // Row 3: Navigation
    buttons.push([
      { text: '📋 До списку замовлень', callback_data: 'view_orders' },
      { text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }
    ]);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminStatusChangeMenu(chatId, orderId) {
    const order = db.getOrderById(orderId);
    if (!order) return;

    const text = `⚙️ <b>Зміна статусу замовлення #${orderId}</b>\nПоточний статус: <b>${ORDER_STATUSES[order.status]?.name || order.status}</b>\n\nОберіть новий статус:`;

    const buttons = [
      [
        { text: '✅ Підтверджено', callback_data: `admin_set_status:CONFIRMED:${orderId}` },
        { text: '📦 До пакування', callback_data: `admin_set_status:PACKING_PREP:${orderId}` }
      ],
      [
        { text: '📦 Упаковано', callback_data: `admin_set_status:PACKED:${orderId}` },
        { text: '🚚 До відправки', callback_data: `admin_set_status:DISPATCH_PREP:${orderId}` }
      ],
      [
        { text: '🚚 Відправлено', callback_data: `admin_set_status:SHIPPED:${orderId}` },
        { text: '🏢 Доставлено', callback_data: `admin_set_status:DELIVERED:${orderId}` }
      ],
      [
        { text: '🎉 Виконано', callback_data: `admin_set_status:COMPLETED:${orderId}` },
        { text: '❌ Скасувати', callback_data: `admin_set_status:CANCELLED:${orderId}` }
      ],
      [
        { text: '🔙 Назад до замовлення', callback_data: `admin_view:${orderId}` }
      ]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async processAdminConfirmOrder(chatId, orderId) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.callApi('sendMessage', { chat_id: chatId, text: `❌ Замовлення #${orderId} не знайдено.` });
      return;
    }

    db.updateOrderStatus(orderId, 'CONFIRMED', 'Admin', 'Підтверджено адміністратором у Telegram-боті');
    const updated = db.getOrderById(orderId);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>Замовлення #${orderId} успішно підтверджено!</b>\nПокупця сповіщено в Telegram, статус оновлено до «Підтверджено».`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚚 Вказати ТТН / Відправити', callback_data: `admin_ttn_prompt:${orderId}` },
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` }
          ],
          [
            { text: '📋 До списку замовлень', callback_data: 'view_orders' }
          ]
        ]
      }
    });

    // Notify customer in Telegram with payment button if online and unpaid
    if (order.customer?.telegram_id) {
      let custMsg = `📦 <b>Ваше замовлення #${order.order_id} підтверджено менеджером!</b>\n\nМи вже розпочали комплектацію та підготовку до відправлення.`;
      const custButtons = [];

      if (order.payment?.method === 'online' && order.payment?.status !== 'PAID') {
        custMsg += `\n\n💳 <b>Оплата замовлення:</b>\nСума до сплати: <b>${order.total} ₴</b>.\nНатисніть кнопку нижче, щоб безпечно оплатити замовлення онлайн у боті:`;
        custButtons.push([
          { text: `💳 Оплатити ${order.total} ₴ онлайн`, callback_data: `pay_test:${order.order_id}` }
        ]);
      }

      custButtons.push([
        { text: '🔍 Переглянути замовлення', callback_data: `view_order:${order.order_id}` }
      ]);

      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text: custMsg,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: custButtons }
      });
    }
  }

  async processAdminSaveTtn(chatId, orderId, ttn) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.callApi('sendMessage', { chat_id: chatId, text: `❌ Замовлення #${orderId} не знайдено.` });
      return;
    }

    db.updateOrderTtn(orderId, ttn, 'Admin');
    db.updateOrderStatus(orderId, 'SHIPPED', 'Admin', `Додано ТТН ${ttn} та переведено у статус Відправлено`);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>ТТН збережено для #${orderId}!</b>\n\nНомер ТТН: <code>${ttn}</code>\nСтатус змінено на: <b>Відправлено (SHIPPED)</b>\nПокупцю надіслано повідомлення з номером накладної.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` },
            { text: '📋 До списку замовлень', callback_data: 'view_orders' }
          ]
        ]
      }
    });

    // Notify customer in Telegram with TTN
    if (order.customer?.telegram_id) {
      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text: `🚚 <b>Ваше замовлення #${order.order_id} вже відправлено!</b>\n\nНомер ТТН: <code>${ttn}</code>\nПеревізник: <b>${order.delivery?.provider_name || 'Нова Пошта'}</b>\n\nВи можете відстежувати рух посилки у додатку перевізника або на сайті. Дякуємо за довіру до MILIPSTORE!`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }
  }

  async processAdminStatusChange(chatId, orderId, newStatus) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.callApi('sendMessage', { chat_id: chatId, text: `❌ Замовлення #${orderId} не знайдено.` });
      return;
    }

    if (newStatus === 'PAID') {
      db.updateOrderPayment(orderId, {
        method: 'online',
        provider: 'Telegram Admin Mark',
        status: 'PAID',
        paid_at: new Date().toISOString()
      });
      db.updateOrderStatus(orderId, 'CONFIRMED', 'Admin', 'Позначено як оплачено адміністратором');
    } else {
      db.updateOrderStatus(orderId, newStatus, 'Admin', `Статус змінено адміністратором у боті`);
    }

    const updated = db.getOrderById(orderId);
    const statusName = ORDER_STATUSES[updated.status]?.name || updated.status;

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>Статус замовлення #${orderId} успішно змінено на:</b> <b>${statusName}</b>` + (newStatus === 'PAID' ? ' (Оплату зафіксовано)' : ''),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` },
            { text: '📋 До списку замовлень', callback_data: 'view_orders' }
          ]
        ]
      }
    });

    // Notify customer
    await this.notifyCustomerStatusChange(updated, updated.status);
  }

  // ----------------------------------------------------
  // Global Event Triggers
  // ----------------------------------------------------
  async sendOrderCreatedNotifications(order) {
    db.addNotification({
      type: 'ORDER_CREATED',
      order_id: order.order_id,
      total: order.total,
      customer: `${order.customer?.first_name} ${order.customer?.last_name || ''}`,
      status: order.status
    });

    // 1. Notify Customer in Telegram
    if (order.customer?.telegram_id) {
      await this.sendCustomerOrderWithPayment(order.customer.telegram_id, order);
    }

    // 2. Notify Admins
    await this.notifyAdminsNewOrder(order);
  }

  async notifyAdminsNewOrder(order) {
    const itemsList = (order.items || []).map(i => `${i.title} (${i.qty} шт.)`).join(', ');
    const payStatus = order.payment?.status === 'PAID' ? '✅ Оплачено онлайн' : (order.payment?.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');

    const adminMsg = `🔔 <b>НОВЕ ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n` +
      `<b>Сума:</b> <b>${order.total} ₴</b> • ${payStatus}\n` +
      `<b>Покупець:</b> ${order.customer?.first_name} ${order.customer?.last_name || ''} (<code>${order.customer?.phone}</code>)` +
      (order.customer?.telegram_username ? ` @${order.customer.telegram_username}` : '') + `\n` +
      `<b>Доставка:</b> ${order.delivery?.provider_name || 'Нова Пошта'}, ${order.delivery?.city}, ${order.delivery?.department}\n` +
      `<b>Товари (${order.items?.length || 0}):</b> ${itemsList}\n` +
      `<b>Оплата:</b> ${order.payment?.provider || 'Smart Glocal Test'}`;

    const adminButtons = [
      [
        { text: '✅ Підтвердити', callback_data: `admin_confirm:${order.order_id}` },
        { text: '📦 До пакування', callback_data: `admin_set_status:PACKING_PREP:${order.order_id}` }
      ],
      [
        { text: '🚚 Вказати ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` },
        { text: '🔍 Всі деталі', callback_data: `admin_view:${order.order_id}` }
      ]
    ];

    const adminChatIds = this.getAllAdminChatIds();
    for (const adminId of adminChatIds) {
      await this.callApi('sendMessage', {
        chat_id: adminId,
        text: adminMsg,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: adminButtons }
      });
    }
  }

  async sendCustomerPaymentSuccess(order) {
    db.addNotification({
      type: 'PAYMENT_SUCCESS',
      order_id: order.order_id,
      total: order.total,
      transaction_id: order.payment?.transaction_id
    });

    if (order.customer?.telegram_id) {
      const text = `✅ <b>Оплату замовлення #${order.order_id} успішно зараховано!</b>\n\n` +
        `Сума: <b>${order.total} ₴</b>\n` +
        `Провайдер: <b>${order.payment?.provider || 'Smart Glocal Test (Telegram)'}</b>\n` +
        `Транзакція: <code>${order.payment?.transaction_id || 'SG-PAY-OK'}</code>\n\n` +
        `Статус замовлення оновлено: <b>Нові</b>. Менеджер вже готує девайси до пакування та відправки!`;

      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Переглянути замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }
  }

  async sendAdminPaymentSuccess(order) {
    const adminChatIds = this.getAllAdminChatIds();
    for (const adminId of adminChatIds) {
      await this.callApi('sendMessage', {
        chat_id: adminId,
        text: `💰 <b>ОПЛАТА ОТРИМАНА!</b>\n\nЗамовлення: <b>#${order.order_id}</b>\nСума: <b>${order.total} ₴</b>\nПокупець: ${order.customer?.first_name} ${order.customer?.last_name || ''} (<code>${order.customer?.phone}</code>)\nСтатус: ✅ Успішно сплачено онлайн через Smart Glocal Test`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Підтвердити', callback_data: `admin_confirm:${order.order_id}` },
              { text: '🚚 Вказати ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
            ],
            [
              { text: '🔍 Відкрити замовлення', callback_data: `admin_view:${order.order_id}` }
            ]
          ]
        }
      });
    }
  }

  async notifyCustomerStatusChange(order, newStatus, ttn = null) {
    db.addNotification({
      type: 'STATUS_CHANGED',
      order_id: order.order_id,
      status: newStatus,
      status_name: ORDER_STATUSES[newStatus]?.name || newStatus,
      ttn: ttn || order.tracking_number
    });

    if (!order.customer?.telegram_id) return;

    const orderNum = `#${order.order_id}`;
    let messageText = '';

    switch (newStatus) {
      case 'CONFIRMED':
        messageText = `📦 <b>Ваше замовлення ${orderNum} підтверджено менеджером!</b>\n\nМи вже розпочали підготовку до пакування.`;
        break;
      case 'PACKING_PREP':
        messageText = `📦 <b>Ваше замовлення ${orderNum} передано на склад і готується до пакування.</b>`;
        break;
      case 'PACKED':
        messageText = `✅ <b>Ваше замовлення ${orderNum} надійно упаковано</b> та очікує передачі перевізнику.`;
        break;
      case 'DISPATCH_PREP':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} підготовлено до відправлення.</b>`;
        break;
      case 'SHIPPED': {
        const track = ttn || order.tracking_number;
        messageText = `🚚 <b>Ваше замовлення ${orderNum} вже відправлено!</b>`;
        if (track) {
          messageText += `\n\nНомер ТТН: <code>${track}</code>\nСлужба доставки: <b>${order.delivery?.provider_name || 'Нова Пошта'}</b>\nВи можете відстежувати посилку в додатку перевізника.`;
        }
        break;
      }
      case 'DELIVERED':
        messageText = `📦 <b>Ваше замовлення ${orderNum} прибуло до пункту видачі!</b>\nБудь ласка, заберіть вашу посилку.`;
        break;
      case 'COMPLETED':
        messageText = `🎉 <b>Ваше замовлення ${orderNum} успішно виконано!</b>\nДякуємо за покупку в MILIPSTORE. Бажаємо приємного користування та яскравих перемог!`;
        break;
      case 'CANCELLED':
        messageText = `❌ <b>Ваше замовлення ${orderNum} було скасовано.</b>\nЯкщо у вас виникли запитання, зверніться до нашої служби підтримки @milipmanager.`;
        break;
      default:
        messageText = `📦 <b>Оновлено статус замовлення ${orderNum}:</b> <b>${ORDER_STATUSES[newStatus]?.name || newStatus}</b>`;
        break;
    }

    await this.callApi('sendMessage', {
      chat_id: order.customer.telegram_id,
      text: messageText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Переглянути замовлення', callback_data: `view_order:${order.order_id}` }]
        ]
      }
    });
  }

  async createInvoiceLink(order) {
    if (!BOT_TOKEN) return null;
    const payload = `order_${order.order_id}`;
    const amountInKopecks = Math.round(Number(order.total) * 100);

    const invoiceParams = {
      title: `Замовлення #${order.order_id}`,
      description: `Оплата ігрових девайсів у MILIPSTORE (${order.items.length} поз.)`,
      payload,
      provider_token: PAYMENT_PROVIDER_TOKEN,
      currency: 'UAH',
      prices: [
        { label: `Замовлення #${order.order_id}`, amount: amountInKopecks }
      ]
    };

    const res = await this.callApi('createInvoiceLink', invoiceParams);
    if (res.ok && res.result) {
      return res.result;
    }
    return null;
  }
}

export const botService = new TelegramBotService();
botService.init();
