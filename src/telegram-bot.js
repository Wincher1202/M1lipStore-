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
        } else if (res.error_code === 409 || res.description?.includes('Conflict')) {
          console.warn('[TelegramBot] Conflict: Another bot instance is polling with this token. Waiting 8s before retry...');
          await new Promise(r => setTimeout(r, 8000));
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
    const storeUrl = process.env.PUBLIC_APP_URL || 'https://wincher1202.github.io/M1lipStore-/';
    const keyboard = [];

    if (isAdminUser) {
      keyboard.push([{ text: '👑 Панель адміністратора' }, { text: '📦 Переглянути замовлення' }]);
    }

    keyboard.push([
      { text: '🛍 Мої замовлення' },
      { text: '🌐 Відкрити магазин', web_app: { url: storeUrl } }
    ]);
    keyboard.push([{ text: '📦 Відстежити замовлення' }, { text: '💬 Підтримка' }]);

    return {
      keyboard,
      resize_keyboard: true,
      is_persistent: true
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

    // Cancel wizard or action on /cancel
    if (text === '/cancel' || text === '❌ Скасувати' || text === 'Скасувати') {
      if (this.adminSessions[chatId]) {
        delete this.adminSessions[chatId];
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '❌ Дію скасовано. Повернення до головного меню.',
          reply_markup: this.getReplyKeyboard(from)
        });
        return;
      }
    }

    // Check if admin is currently in Add Product Wizard session
    if (this.adminSessions[chatId]?.action === 'wizard_add_product') {
      await this.handleWizardMessage(chatId, from, msg);
      return;
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

      const appUrl = process.env.PUBLIC_APP_URL || 'https://wincher1202.github.io/M1lipStore-/';
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'HTML',
        reply_markup: this.getReplyKeyboard(from)
      });
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `✨ Оберіть потрібну дію або відкрийте вітрину магазину:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Відкрити каталог MILIPSTORE', web_app: { url: appUrl } }],
            [{ text: '🛍 Мої замовлення', callback_data: `orders_list:${chatId}` }, { text: '💬 Підтримка', callback_data: 'customer_support' }]
          ]
        }
      });
      return;
    }

    // OPEN WEB STORE
    if (
      text === '🌐 Відкрити магазин' || 
      text === '🌐 Відкрити каталог' || 
      text === '/shop' || 
      text === '/store' ||
      text === '/catalog'
    ) {
      const appUrl = process.env.PUBLIC_APP_URL || 'https://wincher1202.github.io/M1lipStore-/';
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🛒 <b>Каталог MILIPSTORE</b>\n\nОбирайте найкращі ігрові девайси зі швидкою доставкою по всій Україні:\n👉 <a href="${appUrl}">${appUrl}</a>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Відкрити магазин (Web App)', web_app: { url: appUrl } }],
            [{ text: '🌐 Відкрити в браузері', url: appUrl }]
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

    // ADMIN COMMAND: /add_product [Brand | Model | Price | Category | Description]
    if (text.startsWith('/add_product')) {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
        return;
      }
      const rawParams = text.replace('/add_product', '').trim();
      if (rawParams.includes('|')) {
        const parts = rawParams.split('|').map(s => s.trim());
        const brand = parts[0] || 'MILIP';
        const model = parts[1] || 'Новий девайс';
        const price = parseInt(parts[2] || '999', 10) || 999;
        const category = parts[3] || 'Аксесуари';
        const description = parts[4] || `${brand} ${model} — якісний ігровий девайс від MILIPSTORE.`;

        const newProd = {
          id: `prod-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
          brand,
          title: `${brand} ${model}`,
          price,
          old_price: Math.round(price * 1.15),
          tag: 'НОВИНКА',
          category,
          quantity: 15,
          colors: 'Black, White',
          description,
          img: this.getDefaultProductImage(brand, category),
          gallery: [this.getDefaultProductImage(brand, category)],
          specs: this.getDefaultSpecs(category),
          color_images: {
            Black: { main: '/attack-shark-x3-black.jpg', gallery: [] },
            White: { main: '/attack-shark-x3-white.jpg', gallery: [] }
          },
          color_quantities: { Black: 10, White: 5 },
          sku: `${brand.toUpperCase().slice(0, 3)}-${model.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
          featured: true,
          popular: true,
          hidden: false,
          created_at: new Date().toISOString()
        };

        db.addProduct(newProd);
        db.addCategory(category);
        db.addBrand(brand);

        const appUrl = (process.env.APP_URL || 'https://m1lipstore.onrender.com').replace(/\/$/, '');
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Товар «${newProd.title}» успішно додано до каталогу!</b>\n\n💰 Ціна: <b>${newProd.price} ₴</b>\n🗂 Категорія: <b>${newProd.category}</b>\n📦 Залишок: <b>${newProd.quantity} шт.</b>\n🆔 Артикул: <code>${newProd.sku}</code>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Відкрити каталог', web_app: { url: appUrl } }],
              [{ text: '➕ Додати ще один товар', callback_data: 'add_new_product' }],
              [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
            ]
          }
        });
        return;
      }

      // No pipe parameters -> Start interactive step-by-step wizard
      await this.startAddProductWizard(chatId);
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

    // CUSTOMER: Support
    if (data === 'customer_support') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💬 <b>Служба підтримки MILIPSTORE</b>\n\nГрафік роботи: Щодня 09:00 — 21:00\nTelegram менеджера: @milipmanager\nКанал магазину: @m1lipstore\n\nМи з радістю відповімо на будь-які ваші запитання!`,
        parse_mode: 'HTML'
      });
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

    // Admin Add Product Prompt & Wizard
    if (data === 'add_new_product' || data === 'admin_add_product') {
      await this.startAddProductWizard(chatId);
      return;
    }

    // Admin Product Wizard Callbacks
    if (data.startsWith('wiz_')) {
      await this.handleWizardCallback(chatId, from, data);
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
      const color = i.color ? `\nКолір: ${i.color}` : '';
      return `🕹 <b>${i.title}</b>${color}\nКількість: ${i.qty} шт.\nЦіна: <b>${i.price * i.qty} ₴</b>`;
    }).join('\n\n');

    const fullName = [customer.first_name, customer.last_name, customer.middle_name].filter(Boolean).join(' ') ||
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Клієнт';

    const provName = delivery.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';
    const methodType = (delivery.type === 'postomat' || delivery.method === 'postomat') ? 'поштомат' : 'відділення';

    let text = `🛍 <b>ОПЛАТА ЗАМОВЛЕННЯ</b>\n\n`;
    text += `<b>Замовлення:</b> <code>#${order.order_id}</code>\n\n`;
    text += `🛒 <b>Товари:</b>\n\n${itemsSummary}\n\n`;
    text += `💰 <b>Разом за товари:</b> <b>${order.subtotal || order.total} ₴</b>\n\n`;

    text += `👤 <b>Покупець:</b>\n`;
    text += `<b>ПІБ:</b> ${fullName}\n`;
    text += `📞 <b>Телефон:</b> <code>${customer.phone || 'не вказано'}</code>\n`;
    if (customer.email) text += `📧 <b>Email:</b> ${customer.email}\n`;
    text += `\n`;

    text += `📦 <b>Доставка:</b>\n`;
    text += `${provName} — ${methodType}\n`;
    text += `📍 <b>Місто:</b> ${delivery.city || 'Україна'}\n`;
    text += `🏤 <b>Пункт:</b> ${delivery.department || delivery.address || 'Відділення'}\n\n`;

    text += `💳 <b>Оплата:</b>\n`;
    text += `Спосіб: ${isOnline ? 'Онлайн-оплата (Smart Glocal Test)' : 'Оплата при отриманні'}\n`;
    text += `Стан: ${isPaid ? '✅ <b>Оплачено</b>' : '⏳ <b>Очікує оплати</b>'}\n`;
    text += `Сума: <b>${order.total} ₴</b>\n\n`;

    if (isOnline && !isPaid) {
      text += `🔒 <i>Перевірте дані замовлення перед оплатою.</i>`;
    }

    const buttons = [];

    // If online and unpaid: Show payment action buttons in chat!
    if (isOnline && !isPaid) {
      buttons.push([
        { text: `💳 Оплатити ${order.total} ₴`, callback_data: `send_invoice:${order.order_id}` }
      ]);
      buttons.push([
        { text: `⚡ Сплатити (Smart Glocal Test)`, callback_data: `pay_test:${order.order_id}` }
      ]);
    }

    buttons.push([
      { text: '🔄 Оновити статус', callback_data: `view_order:${order.order_id}` },
      { text: '📦 Мої замовлення', callback_data: `orders_list:${chatId}` }
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
      description: `Оплата ігрових девайсів у магазині MILIPSTORE (${order.items.length} поз.)`,
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

    orders.slice(0, 8).forEach(o => {
      let emoji = '📦';
      if (o.status === 'PENDING_PAYMENT') emoji = '⏳';
      if (o.status === 'NEW') emoji = '🟡';
      if (o.status === 'CONFIRMED') emoji = '✅';
      if (o.status === 'SHIPPED') emoji = '🚚';
      if (o.status === 'DELIVERED') emoji = '🏢';
      if (o.status === 'COMPLETED') emoji = '🎉';
      if (o.status === 'CANCELLED') emoji = '❌';

      const isPaid = o.payment?.status === 'PAID';
      const isUnpaid = o.payment?.method === 'online' && !isPaid;
      const itemsBrief = o.items.map(i => `${i.title} × ${i.qty}`).join(', ');
      const provName = o.delivery?.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';

      text += `<b>#${o.order_id}</b>\n`;
      text += `• ${itemsBrief}\n`;
      text += `💰 <b>${o.total} ₴</b>\n`;
      text += `💳 ${isPaid ? 'Оплачено ✅' : (isUnpaid ? 'Очікує оплати ⏳' : 'Оплата при отриманні 📦')}\n`;
      text += `📦 ${provName} — ${o.delivery?.department || o.delivery?.city || ''}\n`;
      text += `Статус: ${emoji} <b>${ORDER_STATUSES[o.status]?.name || o.status}</b>\n`;
      if (o.tracking_number) text += `ТТН: <code>${o.tracking_number}</code>\n`;
      text += `\n`;

      if (isUnpaid) {
        buttons.push([
          { text: `💳 Оплатити #${o.order_id} (${o.total} ₴)`, callback_data: `send_invoice:${o.order_id}` },
          { text: `🔍 Деталі`, callback_data: `view_order:${o.order_id}` }
        ]);
      } else {
        buttons.push([
          { text: `🔍 Переглянути #${o.order_id}`, callback_data: `view_order:${o.order_id}` }
        ]);
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
    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const itemsList = (order.items || []).map(i => `• ${i.title}${i.color ? ` (${i.color})` : ''} — ${i.qty} шт. × ${i.price} ₴`).join('\n');
    const payStatus = order.payment?.status === 'PAID' ? '✅ Оплачено онлайн' : (order.payment?.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');
    const fullName = [cust.first_name, cust.last_name, cust.middle_name].filter(Boolean).join(' ') || [cust.first_name, cust.last_name].filter(Boolean).join(' ') || 'Клієнт';
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';

    const adminMsg = `🔔 <b>НОВЕ ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n` +
      `🛍 <b>Товари:</b>\n${itemsList}\n\n` +
      `💰 <b>Разом:</b> <b>${order.total} ₴</b> • ${payStatus}\n\n` +
      `👤 <b>Покупець:</b>\n${fullName}\n` +
      `📞 <code>${cust.phone || 'не вказано'}</code>\n` +
      (cust.email ? `📧 ${cust.email}\n` : '') +
      (cust.telegram_username ? `✈️ @${cust.telegram_username}\n` : '') +
      `\n` +
      `📦 <b>Доставка:</b>\n` +
      `${provName}\n` +
      `м. ${deliv.city || ''}\n` +
      `${deliv.department || deliv.address || ''}\n\n` +
      `💳 <b>Оплата:</b>\n` +
      `${order.payment?.provider || 'Smart Glocal Test'}\n` +
      `${payStatus}`;

    const adminButtons = [
      [
        { text: '📋 Переглянути замовлення', callback_data: `admin_view:${order.order_id}` }
      ],
      [
        { text: '✅ Підтвердити', callback_data: `admin_confirm:${order.order_id}` },
        { text: '❌ Скасувати', callback_data: `setstatus_${order.order_id}_CANCELLED` }
      ],
      [
        { text: '🚚 Вказати ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
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
      const text = `🎉 <b>ОПЛАТА УСПІШНА!</b>\n\n` +
        `Ваше замовлення <b>#${order.order_id}</b> успішно оплачено.\n\n` +
        `💰 <b>Сума:</b> <b>${order.total} ₴</b>\n\n` +
        `📦 <b>Статус:</b>\n🟡 <b>Очікує підтвердження</b>\n\n` +
        `Ми отримали оплату та передали замовлення менеджеру.\n` +
        `Очікуйте подальших повідомлень щодо вашого замовлення.`;

      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Мої замовлення', callback_data: `orders_list:${order.customer.telegram_id}` }],
            [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }
  }

  async sendAdminPaymentSuccess(order) {
    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const itemsList = (order.items || []).map(i => `• ${i.title}${i.color ? ` (${i.color})` : ''} — ${i.qty} шт. × ${i.price} ₴`).join('\n');
    const fullName = [cust.first_name, cust.last_name, cust.middle_name].filter(Boolean).join(' ') || [cust.first_name, cust.last_name].filter(Boolean).join(' ') || 'Клієнт';
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';

    const adminMsg = `🔔 <b>НОВЕ ОПЛАЧЕНЕ ЗАМОВЛЕННЯ</b>\n\n` +
      `<b>#${order.order_id}</b>\n\n` +
      `🛍 <b>Товари:</b>\n${itemsList}\n\n` +
      `💰 <b>Разом:</b> <b>${order.total} ₴</b>\n\n` +
      `👤 <b>Покупець:</b>\n` +
      `${fullName}\n` +
      `📞 <code>${cust.phone || 'не вказано'}</code>\n` +
      (cust.email ? `📧 ${cust.email}\n` : '') +
      (cust.telegram_username ? `✈️ @${cust.telegram_username}\n` : '') +
      `\n` +
      `📦 <b>Доставка:</b>\n` +
      `${provName}\n` +
      `м. ${deliv.city || ''}\n` +
      `${deliv.department || deliv.address || ''}\n\n` +
      `💳 <b>Оплата:</b>\n` +
      `Smart Glocal Test\n` +
      `✅ <b>Оплачено</b>`;

    const adminButtons = [
      [
        { text: '📋 Переглянути замовлення', callback_data: `admin_view:${order.order_id}` }
      ],
      [
        { text: '✅ Підтвердити', callback_data: `admin_confirm:${order.order_id}` },
        { text: '❌ Скасувати', callback_data: `setstatus_${order.order_id}_CANCELLED` }
      ],
      [
        { text: '🚚 Вказати ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
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
        messageText = `✅ <b>Ваше замовлення ${orderNum} підтверджено менеджером.</b>\n\nМи вже розпочали комплектацію та підготовку до пакування.`;
        break;
      case 'PACKING_PREP':
        messageText = `📦 <b>Ваше замовлення ${orderNum} готується до пакування.</b>`;
        break;
      case 'PACKED':
        messageText = `📦 <b>Ваше замовлення ${orderNum} упаковано.</b>`;
        break;
      case 'DISPATCH_PREP':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} готується до відправки.</b>`;
        break;
      case 'SHIPPED': {
        const track = ttn || order.tracking_number;
        const provName = order.delivery?.provider === 'ukrposhta' ? 'Укрпошта' : (order.delivery?.provider_name || 'Нова Пошта');
        messageText = `🚚 <b>Ваше замовлення ${orderNum} відправлено!</b>`;
        if (track) {
          messageText += `\n\nНомер ТТН: <code>${track}</code>\nСлужба доставки: <b>${provName}</b>\n\nВи можете відстежувати рух посилки у застосунку перевізника або на сайті.`;
        }
        break;
      }
      case 'DELIVERED':
        messageText = `📍 <b>Ваше замовлення ${orderNum} прибуло до відділення / поштомату.</b>\nБудь ласка, отримайте вашу посилку.`;
        break;
      case 'COMPLETED':
        messageText = `🎉 <b>Ваше замовлення ${orderNum} успішно виконано!</b>\nДякуємо за покупку в MILIPSTORE!`;
        break;
      case 'CANCELLED':
        messageText = `❌ <b>Ваше замовлення ${orderNum} скасовано.</b>\nЯкщо у вас виникли запитання, зверніться до нашої служби підтримки @milipmanager.`;
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

  // ----------------------------------------------------
  // Interactive Product Creation Wizard (Admin)
  // ----------------------------------------------------
  async startAddProductWizard(chatId) {
    this.adminSessions[chatId] = {
      action: 'wizard_add_product',
      step: 'brand',
      data: {
        brand: '',
        title: '',
        price: 0,
        category: '',
        colors: [],
        color_images: {},
        color_quantities: {},
        quantity: 10,
        img: '',
        gallery: [],
        description: '',
        currentColorIndex: 0,
        currentQtyIndex: 0
      }
    };

    const brands = [
      [{ text: '🦈 Attack Shark', callback_data: 'wiz_brand:Attack Shark' }, { text: '⚡ AULA', callback_data: 'wiz_brand:AULA' }],
      [{ text: '🚀 VXE / VGN', callback_data: 'wiz_brand:VXE' }, { text: '🎮 Ajazz', callback_data: 'wiz_brand:Ajazz' }],
      [{ text: '⚡ Darmoshark', callback_data: 'wiz_brand:Darmoshark' }, { text: '💎 Mchose', callback_data: 'wiz_brand:Mchose' }],
      [{ text: '➕ Ввести інший бренд вручну', callback_data: 'wiz_brand:CUSTOM' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `➕ <b>Майстер додавання товару MILIPSTORE</b>\n\n` +
        `<b>Крок 1/6: Оберіть бренд товару:</b>\n` +
        `<i>Натисніть на один із популярних брендів нижче або введіть свій бренд:</i>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: brands }
    });
  }

  async handleWizardCallback(chatId, from, data) {
    const session = this.adminSessions[chatId];
    if (!session || session.action !== 'wizard_add_product') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: 'ℹ️ Сесію додавання товару завершено або скасовано. Щоб розпочати заново, натисніть /add_product або оберіть «➕ Додати новий товар» в адмін-панелі.',
        reply_markup: this.getReplyKeyboard(from)
      });
      return;
    }

    if (data === 'wiz_cancel') {
      delete this.adminSessions[chatId];
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '❌ Додавання товару скасовано.',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }]]
        }
      });
      return;
    }

    // STEP 1: BRAND
    if (data.startsWith('wiz_brand:')) {
      const brandVal = data.replace('wiz_brand:', '').trim();
      if (brandVal === 'CUSTOM') {
        session.step = 'custom_brand';
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `🏷 <b>Введіть назву бренду текстом</b>\n\n<i>Наприклад: Razer, Logitech, ATK, Keychron, Lamzu:</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
          }
        });
        return;
      }

      session.data.brand = brandVal;
      await this.promptWizardTitle(chatId);
      return;
    }

    // STEP 3: PRICE BUTTONS
    if (data.startsWith('wiz_price:')) {
      const priceVal = parseInt(data.replace('wiz_price:', '').trim(), 10) || 999;
      session.data.price = priceVal;
      await this.promptWizardCategory(chatId);
      return;
    }

    // STEP 4: CATEGORY
    if (data.startsWith('wiz_cat:')) {
      const catVal = data.replace('wiz_cat:', '').trim();
      if (catVal === 'CUSTOM') {
        session.step = 'custom_category';
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `🗂 <b>Введіть назву нової категорії текстом</b>\n\n<i>Наприклад: Світчі, Кейкапи, Мікрофони, Кронштейни:</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
          }
        });
        return;
      }

      session.data.category = catVal;
      db.addCategory(catVal);
      await this.promptWizardColors(chatId);
      return;
    }

    // STEP 5: COLOR TOGGLES
    if (data.startsWith('wiz_color_toggle:')) {
      const colName = data.replace('wiz_color_toggle:', '').trim();
      if (!session.data.colors) session.data.colors = [];
      const idx = session.data.colors.indexOf(colName);
      if (idx !== -1) {
        session.data.colors.splice(idx, 1);
      } else {
        session.data.colors.push(colName);
      }
      await this.promptWizardColors(chatId);
      return;
    }

    if (data === 'wiz_color:CUSTOM') {
      session.step = 'custom_color';
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🎨 <b>Введіть назву кольору / варіації текстом</b>\n\n<i>Наприклад: Gradient Purple, Matt White, Retro Grey, Cyberpunk:</i>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
        }
      });
      return;
    }

    if (data === 'wiz_colors_done') {
      if (!session.data.colors || session.data.colors.length === 0) {
        session.data.colors = ['Black'];
      }
      session.data.currentColorIndex = 0;
      await this.promptWizardColorPhoto(chatId);
      return;
    }

    if (data === 'wiz_colors_skip') {
      session.data.colors = ['Black'];
      session.data.currentColorIndex = 0;
      await this.promptWizardColorPhoto(chatId);
      return;
    }

    // STEP 6: PHOTO ACTIONS
    if (data === 'wiz_photo_auto') {
      const colors = session.data.colors || ['Black'];
      const curColor = colors[session.data.currentColorIndex] || 'Black';
      const autoImg = this.getDefaultColorImage(curColor, session.data.brand, session.data.category);
      if (!session.data.color_images) session.data.color_images = {};
      session.data.color_images[curColor] = { main: autoImg, gallery: [autoImg] };
      if (!session.data.img) session.data.img = autoImg;

      session.data.currentColorIndex++;
      if (session.data.currentColorIndex < colors.length) {
        await this.promptWizardColorPhoto(chatId);
      } else {
        session.data.currentQtyIndex = 0;
        await this.promptWizardColorQuantity(chatId);
      }
      return;
    }

    if (data === 'wiz_photo_skip_one') {
      session.data.currentColorIndex++;
      const colors = session.data.colors || ['Black'];
      if (session.data.currentColorIndex < colors.length) {
        await this.promptWizardColorPhoto(chatId);
      } else {
        session.data.currentQtyIndex = 0;
        await this.promptWizardColorQuantity(chatId);
      }
      return;
    }

    if (data === 'wiz_photo_skip_all') {
      session.data.currentQtyIndex = 0;
      await this.promptWizardColorQuantity(chatId);
      return;
    }

    // STEP 7: QUANTITIES
    if (data.startsWith('wiz_qty:')) {
      const qtyVal = parseInt(data.replace('wiz_qty:', '').trim(), 10) || 10;
      const colors = session.data.colors || ['Black'];
      const curColor = colors[session.data.currentQtyIndex] || 'Black';
      if (!session.data.color_quantities) session.data.color_quantities = {};
      session.data.color_quantities[curColor] = qtyVal;

      session.data.currentQtyIndex++;
      if (session.data.currentQtyIndex < colors.length) {
        await this.promptWizardColorQuantity(chatId);
      } else {
        await this.showWizardConfirm(chatId);
      }
      return;
    }

    if (data.startsWith('wiz_qty_all:')) {
      const qtyVal = parseInt(data.replace('wiz_qty_all:', '').trim(), 10) || 10;
      const colors = session.data.colors || ['Black'];
      if (!session.data.color_quantities) session.data.color_quantities = {};
      colors.forEach(c => {
        session.data.color_quantities[c] = qtyVal;
      });
      await this.showWizardConfirm(chatId);
      return;
    }

    // STEP 8: CONFIRM & PUBLISH
    if (data === 'wiz_save_publish') {
      await this.saveWizardProduct(chatId);
      return;
    }
  }

  async handleWizardMessage(chatId, from, msg) {
    const session = this.adminSessions[chatId];
    if (!session || session.action !== 'wizard_add_product') return;

    const text = (msg.text || '').trim();

    // 1. Custom Brand Input
    if (session.step === 'custom_brand') {
      if (!text) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⚠️ Будь ласка, введіть коректну назву бренду:' });
        return;
      }
      session.data.brand = text;
      db.addBrand(text);
      await this.promptWizardTitle(chatId);
      return;
    }

    // 2. Title / Model Input
    if (session.step === 'title') {
      if (!text) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⚠️ Будь ласка, надішліть назву моделі товару:' });
        return;
      }
      session.data.title = text;
      await this.promptWizardPrice(chatId);
      return;
    }

    // 3. Price Input
    if (session.step === 'price') {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(num) || num <= 0) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⚠️ Вкажіть коректне число для ціни (наприклад: <code>1899</code>):',
          parse_mode: 'HTML'
        });
        return;
      }
      session.data.price = num;
      await this.promptWizardCategory(chatId);
      return;
    }

    // 4. Custom Category Input
    if (session.step === 'custom_category') {
      if (!text) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⚠️ Будь ласка, введіть назву категорії:' });
        return;
      }
      session.data.category = text;
      db.addCategory(text);
      await this.promptWizardColors(chatId);
      return;
    }

    // 5. Custom Color Input
    if (session.step === 'custom_color') {
      if (!text) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⚠️ Будь ласка, введіть назву кольору:' });
        return;
      }
      if (!session.data.colors) session.data.colors = [];
      if (!session.data.colors.includes(text)) {
        session.data.colors.push(text);
      }
      await this.promptWizardColors(chatId);
      return;
    }

    // 6. Color Photo Input (Image upload or Image URL)
    if (session.step === 'color_photos') {
      let photoUrl = '';

      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)/i.test(text) || /^https?:\/\//i.test(text)) {
        photoUrl = text;
      }

      if (photoUrl) {
        const colors = session.data.colors || ['Black'];
        const curColor = colors[session.data.currentColorIndex] || 'Black';
        if (!session.data.color_images) session.data.color_images = {};
        session.data.color_images[curColor] = { main: photoUrl, gallery: [photoUrl] };
        if (!session.data.img) session.data.img = photoUrl;

        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `✅ Фото для кольору <b>${curColor}</b> успішно збережено!`,
          parse_mode: 'HTML'
        });

        session.data.currentColorIndex++;
        if (session.data.currentColorIndex < colors.length) {
          await this.promptWizardColorPhoto(chatId);
        } else {
          session.data.currentQtyIndex = 0;
          await this.promptWizardColorQuantity(chatId);
        }
        return;
      }

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `⚠️ Будь ласка, завантажте фото або надішліть посилання на картинку (або скористайтеся кнопками «Використати авто-фото» / «Пропустити»).`
      });
      return;
    }

    // 7. Quantity Input
    if (session.step === 'color_quantities') {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(num) || num < 0) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⚠️ Будь ласка, введіть число залишку (наприклад: <code>10</code>):',
          parse_mode: 'HTML'
        });
        return;
      }

      const colors = session.data.colors || ['Black'];
      const curColor = colors[session.data.currentQtyIndex] || 'Black';
      if (!session.data.color_quantities) session.data.color_quantities = {};
      session.data.color_quantities[curColor] = num;

      session.data.currentQtyIndex++;
      if (session.data.currentQtyIndex < colors.length) {
        await this.promptWizardColorQuantity(chatId);
      } else {
        await this.showWizardConfirm(chatId);
      }
      return;
    }
  }

  async promptWizardTitle(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'title';

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🏷 <b>Бренд:</b> ${session.data.brand}\n\n` +
        `<b>Крок 2/6: Введіть назву / модель товару:</b>\n\n` +
        `<i>Приклад: R1 Pro Max Wireless, F75 Tri-Mode Gasket, Mad Major 8K</i>\n\n` +
        `Надішліть назву наступним повідомленням у чат:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
      }
    });
  }

  async promptWizardPrice(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'price';

    const priceButtons = [
      [{ text: '899 ₴', callback_data: 'wiz_price:899' }, { text: '1299 ₴', callback_data: 'wiz_price:1299' }, { text: '1599 ₴', callback_data: 'wiz_price:1599' }],
      [{ text: '1999 ₴', callback_data: 'wiz_price:1999' }, { text: '2499 ₴', callback_data: 'wiz_price:2499' }, { text: '2899 ₴', callback_data: 'wiz_price:2899' }],
      [{ text: '3299 ₴', callback_data: 'wiz_price:3299' }, { text: '3899 ₴', callback_data: 'wiz_price:3899' }, { text: '4499 ₴', callback_data: 'wiz_price:4499' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🏷 <b>Товар:</b> ${session.data.brand} ${session.data.title}\n\n` +
        `<b>Крок 3/6: Вкажіть ціну товару (у гривнях):</b>\n\n` +
        `<i>Оберіть швидку кнопку або введіть число текстом (наприклад: <code>1750</code>):</i>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: priceButtons }
    });
  }

  async promptWizardCategory(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'category';

    const catButtons = [
      [{ text: '🖱 Мишки', callback_data: 'wiz_cat:Мишки' }, { text: '⌨️ Клавіатури', callback_data: 'wiz_cat:Клавіатури' }],
      [{ text: '🎧 Навушники', callback_data: 'wiz_cat:Навушники' }, { text: '⬛ Килимки', callback_data: 'wiz_cat:Килимки' }],
      [{ text: '🎮 Геймпади', callback_data: 'wiz_cat:Геймпади' }, { text: '🔌 Аксесуари', callback_data: 'wiz_cat:Аксесуари' }],
      [{ text: '➕ + Ввести нову категорію', callback_data: 'wiz_cat:CUSTOM' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `💰 <b>Ціна:</b> ${session.data.price} ₴\n\n` +
        `<b>Крок 4/6: Оберіть категорію для каталогу:</b>\n` +
        `<i>Категорія одразу з'явиться на сайті та у фільтрах вітрини магазину:</i>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: catButtons }
    });
  }

  async promptWizardColors(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'colors';

    const selected = session.data.colors || [];
    const colorPresets = [
      { id: 'White', name: '⚪ Білий (White)' },
      { id: 'Black', name: '⚫ Чорний (Black)' },
      { id: 'Red', name: '🔴 Червоний (Red)' },
      { id: 'Blue', name: '🔵 Синій (Blue)' },
      { id: 'Purple', name: '🟣 Фіолетовий (Purple)' },
      { id: 'Green', name: '🟢 Зелений / М\'ятний' },
      { id: 'Pink', name: '💖 Рожевий (Pink)' },
      { id: 'Grey', name: '🔘 Сірий (Grey)' }
    ];

    const keyboard = [];
    for (let i = 0; i < colorPresets.length; i += 2) {
      const row = [];
      const c1 = colorPresets[i];
      const isC1 = selected.includes(c1.id);
      row.push({
        text: isC1 ? `✅ ${c1.name}` : c1.name,
        callback_data: `wiz_color_toggle:${c1.id}`
      });

      if (i + 1 < colorPresets.length) {
        const c2 = colorPresets[i + 1];
        const isC2 = selected.includes(c2.id);
        row.push({
          text: isC2 ? `✅ ${c2.name}` : c2.name,
          callback_data: `wiz_color_toggle:${c2.id}`
        });
      }
      keyboard.push(row);
    }

    keyboard.push([{ text: '➕ Ввести свій колір вручну', callback_data: 'wiz_color:CUSTOM' }]);

    const doneText = selected.length > 0
      ? `➡️ ✅ Завершити вибір кольорів (${selected.length}) →`
      : `⏩ Пропустити (Один стандартний колір)`;

    keyboard.push([{ text: doneText, callback_data: selected.length > 0 ? 'wiz_colors_done' : 'wiz_colors_skip' }]);
    keyboard.push([{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]);

    const selectedText = selected.length > 0 ? selected.join(', ') : 'Поки не обрано';

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🗂 <b>Категорія:</b> ${session.data.category}\n\n` +
        `<b>Крок 5/6: Оберіть доступні кольори товару:</b>\n` +
        `Обрані: <b>${selectedText}</b>\n\n` +
        `<i>Натискайте на кнопки кольорів нижче (можна вибрати декілька):</i>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async promptWizardColorPhoto(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'color_photos';

    const colors = session.data.colors || ['Black'];
    if (colors.length === 0 || session.data.currentColorIndex >= colors.length) {
      session.data.currentQtyIndex = 0;
      await this.promptWizardColorQuantity(chatId);
      return;
    }

    const curColor = colors[session.data.currentColorIndex];
    const colorIndexHuman = session.data.currentColorIndex + 1;

    const buttons = [
      [{ text: `🖼 Використати авто-фото для ${curColor}`, callback_data: 'wiz_photo_auto' }],
      [{ text: `⏩ Пропустити фото для ${curColor}`, callback_data: 'wiz_photo_skip_one' }],
      [{ text: `⏭ Пропустити всі фото кольорів →`, callback_data: 'wiz_photo_skip_all' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `📸 <b>Крок 6/6 (Фото ${colorIndexHuman}/${colors.length}): Фото для кольору «${curColor}»</b>\n\n` +
        `Надішліть фотографію товару у кольорі <b>${curColor}</b> (як фото або посилання на зображення):\n\n` +
        `<i>Або оберіть дію нижче:</i>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async promptWizardColorQuantity(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'color_quantities';

    const colors = session.data.colors || ['Black'];
    if (colors.length === 0 || session.data.currentQtyIndex >= colors.length) {
      await this.showWizardConfirm(chatId);
      return;
    }

    const curColor = colors[session.data.currentQtyIndex];
    const qtyIndexHuman = session.data.currentQtyIndex + 1;

    const buttons = [
      [{ text: '5 шт.', callback_data: 'wiz_qty:5' }, { text: '10 шт.', callback_data: 'wiz_qty:10' }, { text: '15 шт.', callback_data: 'wiz_qty:15' }],
      [{ text: '20 шт.', callback_data: 'wiz_qty:20' }, { text: '30 шт.', callback_data: 'wiz_qty:30' }, { text: '50 шт.', callback_data: 'wiz_qty:50' }],
      [{ text: '⏩ Встановити 10 шт. для всіх кольорів', callback_data: 'wiz_qty_all:10' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `📦 <b>Залишок на складі (${qtyIndexHuman}/${colors.length}): «${curColor}»</b>\n\n` +
        `Оберіть кількість на складі для кольору <b>${curColor}</b> або надішліть число у чат:`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async showWizardConfirm(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'confirm';

    const d = session.data;
    const colorsList = (d.colors && d.colors.length) ? d.colors : ['Black'];
    const totalQty = Object.values(d.color_quantities || {}).reduce((a, b) => a + b, 0) || d.quantity || 10;
    
    let colorSummary = '';
    colorsList.forEach(c => {
      const q = d.color_quantities?.[c] ?? Math.round(totalQty / colorsList.length);
      const hasPhoto = d.color_images?.[c]?.main ? '📷 Є фото' : '⚙️ Авто-фото';
      colorSummary += `  • <b>${c}</b>: ${q} шт. (${hasPhoto})\n`;
    });

    const text = `✨ <b>ПЕРЕВІРКА НОВОГО ТОВАРУ</b> ✨\n\n` +
      `🏷 <b>Бренд:</b> ${d.brand}\n` +
      `🎮 <b>Назва:</b> <b>${d.title}</b>\n` +
      `💰 <b>Ціна:</b> <b>${d.price} ₴</b> (стара ціна: ${Math.round(d.price * 1.15)} ₴)\n` +
      `🗂 <b>Категорія:</b> ${d.category}\n` +
      `🎨 <b>Варіанти кольорів та склад:</b>\n${colorSummary}\n` +
      `📦 <b>Загальний залишок:</b> <b>${totalQty} шт.</b>\n\n` +
      `<i>Після підтвердження товар миттєво з'явиться на сайті MILIPSTORE та у Telegram-боті!</i>`;

    const buttons = [
      [{ text: '🚀 ✅ Опублікувати на сайті та в боті', callback_data: 'wiz_save_publish' }],
      [{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]
    ];

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async saveWizardProduct(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    const d = session.data;
    delete this.adminSessions[chatId];

    const brand = d.brand || 'MILIP';
    const title = d.title || 'Ігровий девайс';
    const price = Number(d.price) || 999;
    const category = d.category || 'Аксесуари';
    const colors = (d.colors && d.colors.length) ? d.colors : ['Black'];
    
    // Fill color quantities
    const color_quantities = {};
    let totalQuantity = 0;
    colors.forEach(c => {
      const q = d.color_quantities?.[c] !== undefined ? Number(d.color_quantities[c]) : 10;
      color_quantities[c] = q;
      totalQuantity += q;
    });

    // Fill default images if empty
    const color_images = {};
    const defaultImg = this.getDefaultProductImage(brand, category);
    colors.forEach(c => {
      if (d.color_images?.[c]?.main) {
        color_images[c] = d.color_images[c];
      } else {
        const cImg = this.getDefaultColorImage(c, brand, category);
        color_images[c] = { main: cImg, gallery: [cImg] };
      }
    });

    const mainImg = d.img || color_images[colors[0]]?.main || defaultImg;
    const gallery = Object.values(color_images).map(ci => ci.main).filter(Boolean);
    if (!gallery.includes(mainImg)) gallery.unshift(mainImg);

    const fullTitle = `${brand} ${title}`;
    const slugId = `prod-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    const newProduct = {
      id: slugId,
      brand,
      title: fullTitle,
      price,
      old_price: Math.round(price * 1.15),
      tag: 'НОВИНКА',
      category,
      quantity: totalQuantity,
      colors: colors.join(', '),
      description: `${fullTitle} — якісний ігровий девайс з офіційною гарантією від MILIPSTORE.`,
      img: mainImg,
      gallery: gallery.length ? gallery : [mainImg],
      specs: this.getDefaultSpecs(category),
      color_images,
      color_quantities,
      sku: `${brand.toUpperCase().slice(0, 3)}-${title.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
      featured: true,
      popular: true,
      hidden: false,
      created_at: new Date().toISOString()
    };

    db.addProduct(newProduct);
    db.addCategory(category);
    db.addBrand(brand);

    const appUrl = (process.env.APP_URL || 'https://m1lipstore.onrender.com').replace(/\/$/, '');

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🎉 <b>Товар успішно створено та опубліковано!</b>\n\n` +
        `🏷 <b>${newProduct.title}</b>\n` +
        `💰 Ціна: <b>${newProduct.price} ₴</b>\n` +
        `🗂 Категорія: <b>${newProduct.category}</b>\n` +
        `📦 Залишок: <b>${newProduct.quantity} шт.</b> (${colors.join(', ')})\n` +
        `🆔 Артикул: <code>${newProduct.sku}</code>\n\n` +
        `Товар уже доступний у каталозі магазину та готовий до замовлень!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Відкрити вітрину магазину', web_app: { url: appUrl } }],
          [{ text: '➕ Додати ще один товар', callback_data: 'add_new_product' }],
          [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
        ]
      }
    });
  }

  getDefaultProductImage(brand, category) {
    const cat = (category || '').toLowerCase();
    const br = (brand || '').toLowerCase();
    if (cat.includes('клавіатур')) return '/aula копия.png';
    if (cat.includes('килим') || cat.includes('аксесуар')) return '/images.png';
    if (br.includes('attack shark')) return '/attack-shark-r5-ultra-top-angle.jpg';
    if (br.includes('aula')) return '/aula копия.png';
    if (br.includes('ajazz')) return '/photo_2026-08-25_15-31-22.jpg';
    return '/attack-shark-x3-black.jpg';
  }

  getDefaultColorImage(color, brand, category) {
    const c = (color || '').toLowerCase();
    if (c.includes('біл') || c.includes('white')) return '/attack-shark-x3-white.jpg';
    if (c.includes('чорн') || c.includes('black')) return '/attack-shark-x3-black.jpg';
    if (c.includes('червон') || c.includes('red')) return '/attack-shark-r5-ultra-colors-price.jpg';
    if (c.includes('фіолет') || c.includes('purple')) return '/photo_2026-08-25_15-31-28.jpg';
    if (c.includes('сір') || c.includes('grey') || c.includes('gray')) return '/photo_2026-08-25_15-31-22.jpg';
    if (c.includes('зелен') || c.includes('green') || c.includes('м\'ят')) return '/aula копия.png';
    return this.getDefaultProductImage(brand, category);
  }

  getDefaultSpecs(category) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('мишк')) {
      return [
        { key: 'Сенсор', value: 'PixArt PAW3395 (до 26 000 DPI)' },
        { key: 'Підключення', value: '2.4GHz Wireless / Bluetooth / Type-C' },
        { key: 'Частота опитування', value: 'До 1000-8000 Hz' },
        { key: 'Вага', value: 'Ультралегка конструкція' }
      ];
    }
    if (cat.includes('клавіатур')) {
      return [
        { key: 'Формат', value: '75% Mechanical Gaming' },
        { key: 'Конструкція', value: 'Gasket Mount з шумоізоляцією' },
        { key: 'Підключення', value: 'Tri-Mode: 2.4G / Bluetooth / Type-C' },
        { key: 'Hot-Swap', value: 'Підтримка 3-pin / 5-pin перемикачів' }
      ];
    }
    return [
      { key: 'Тип', value: 'Оригінальний геймерський аксесуар' },
      { key: 'Гарантія', value: 'Офіційна гарантія від виробника' }
    ];
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
