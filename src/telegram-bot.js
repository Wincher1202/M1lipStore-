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
    this.chatHistory = {}; // chatId -> Set of message IDs for clean chat management
  }

  trackMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    if (!this.chatHistory[chatId]) {
      this.chatHistory[chatId] = new Set();
    }
    this.chatHistory[chatId].add(messageId);
  }

  async cleanupChat(chatId, currentMsgId = null) {
    if (!chatId) return;
    const toDelete = new Set(this.chatHistory[chatId] || []);

    const deletePromises = Array.from(toDelete).map(msgId => this.safeDeleteMessage(chatId, msgId));
    await Promise.allSettled(deletePromises);
    this.chatHistory[chatId] = new Set();
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

  // Safe message deletion for keeping chat clean for users and admins
  async safeDeleteMessage(chatId, messageId) {
    if (!chatId || !messageId) return false;
    try {
      const res = await this.callApi('deleteMessage', { chat_id: chatId, message_id: messageId });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  // Send photo with caption or fallback to text message
  async sendPhotoOrMessage(chatId, photoUrl, text, extra = {}) {
    if (photoUrl && typeof photoUrl === 'string') {
      try {
        const baseUrl = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://m1lipstore.onrender.com').replace(/\/$/, '');
        const fullPhoto = photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl.startsWith('/') ? '' : '/'}${encodeURI(photoUrl)}`;
        
        const photoRes = await this.callApi('sendPhoto', {
          chat_id: chatId,
          photo: fullPhoto,
          caption: text,
          parse_mode: extra.parse_mode || 'HTML',
          reply_markup: extra.reply_markup
        });

        if (photoRes.ok && photoRes.result?.message_id) {
          this.trackMessage(chatId, photoRes.result.message_id);
          return photoRes.result;
        }
      } catch (err) {
        console.warn('[TelegramBot] sendPhoto failed, fallback to text:', err.message);
      }
    }

    return await this.safeEditOrSend(chatId, null, text, extra);
  }

  // Edit message in-place if messageId is provided, or send new message and delete old
  async safeEditOrSend(chatId, messageId, text, extra = {}) {
    if (chatId && messageId) {
      try {
        const editRes = await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: extra.parse_mode || 'HTML',
          reply_markup: extra.reply_markup,
          disable_web_page_preview: extra.disable_web_page_preview ?? true
        });
        if (editRes.ok && editRes.result?.message_id) {
          this.trackMessage(chatId, editRes.result.message_id);
          return editRes.result;
        }
      } catch (err) {
        // Fallback to sending new
      }
    }

    const sendRes = await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: extra.parse_mode || 'HTML',
      reply_markup: extra.reply_markup,
      disable_web_page_preview: extra.disable_web_page_preview ?? true
    });

    if (sendRes.ok && sendRes.result?.message_id) {
      this.trackMessage(chatId, sendRes.result.message_id);
    }

    if (sendRes.ok && messageId) {
      await this.safeDeleteMessage(chatId, messageId);
    }
    return sendRes.result;
  }

  // Unified full name formatting including Patronymic (По батькові)
  formatCustomerFullName(cust) {
    if (!cust) return 'Покупець';
    const last = (cust.last_name || '').trim();
    const first = (cust.first_name || '').trim();
    const middle = (cust.middle_name || cust.patronymic || '').trim();

    if (last && first && middle) return `${last} ${first} ${middle}`;
    if (last && first) return `${last} ${first}`;
    if (first && middle) return `${first} ${middle}`;
    if (first) return first;
    if (last) return last;
    return 'Покупець';
  }

  // Specification string parser supporting "Key (Value)", "Key: Value", "Key - Value"
  parseSpecLine(line) {
    const clean = (line || '').trim();
    if (!clean) return null;

    // Pattern 1: Сенсор (Paw3395) or Сенсор (PixArt PAW3395 26000 DPI)
    const parenMatch = clean.match(/^([^()]+)\((.+)\)$/);
    if (parenMatch) {
      const key = parenMatch[1].trim();
      const value = parenMatch[2].trim();
      if (key && value) return { key, value };
    }

    // Pattern 2: Сенсор: Paw3395 or Сенсор - Paw3395 or Сенсор — Paw3395
    const sepMatch = clean.match(/^([^:—\-]+)[:—\-]\s*(.+)$/);
    if (sepMatch) {
      const key = sepMatch[1].trim();
      const value = sepMatch[2].trim();
      if (key && value) return { key, value };
    }

    return { key: 'Характеристика', value: clean };
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
    // Deduplicate and only return numeric chat IDs
    return Array.from(new Set(list.map(s => String(s).trim()))).filter(id => /^\d+$/.test(id));
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
    const storeUrl = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://wincher1202.github.io/M1lipStore-/').replace(/\/$/, '');
    const keyboard = [];

    if (isAdminUser) {
      keyboard.push([
        { text: '👑 Панель адміністратора' },
        { text: '📦 Каталог товарів' },
        { text: '📥 Вхідні' }
      ]);
    }

    keyboard.push([
      { text: '🚀 Відкрити каталог', web_app: { url: storeUrl } },
      { text: '🛍 Мої замовлення' }
    ]);
    keyboard.push([
      { text: '📦 Відстежити замовлення' },
      { text: '💬 Підтримка' }
    ]);

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

        await this.sendOrderCreatedNotifications(order);
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

    // Check if admin is currently in Product Field Edit session
    if (this.adminSessions[chatId]?.action === 'edit_product_field') {
      await this.handleEditProductFieldMessage(chatId, from, msg);
      return;
    }

    // Check if admin is currently in Add Product Wizard session
    if (this.adminSessions[chatId]?.action === 'wizard_add_product') {
      await this.handleWizardMessage(chatId, from, msg);
      return;
    }

    // Check if admin is currently awaiting TTN input for an order
    if (this.adminSessions[chatId]?.action === 'awaiting_ttn') {
      const orderId = this.adminSessions[chatId].orderId;
      const promptMsgId = this.adminSessions[chatId].promptMsgId;
      delete this.adminSessions[chatId];

      if (msg.message_id) {
        await this.safeDeleteMessage(chatId, msg.message_id);
      }

      const ttn = text.replace(/[^\d]/g, '').trim() || text.trim();
      if (ttn.length < 5) {
        await this.safeEditOrSend(chatId, promptMsgId, `⚠️ Номер ТТН надто короткий. Будь ласка, введіть коректний номер ТТН:`, {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: `admin_view:${orderId}` }]]
          }
        });
        return;
      }

      await this.processAdminSaveTtn(chatId, orderId, ttn, promptMsgId);
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

    // START / WELCOME / DEEP LINK - Clean Single Message
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

      // Clean up previous clutter in chat on /start so only one clean welcome message remains
      if (msg.message_id) {
        await this.cleanupChat(chatId, msg.message_id);
      }

      const welcomeText = `👋 <b>Вітаємо в офіційному боті MILIPSTORE!</b>\n\n` +
        `🎮 <b>MILIPSTORE</b> — преміальні ігрові девайси та техніка для сетапу:\n` +
        `• Ультралегкі бездротові мишки\n` +
        `• Кастомні механічні клавіатури з Gasket Mount\n` +
        `• Професійні ігрові поверхні Cordura Control\n\n` +
        `У цьому боті ви можете:\n` +
        `💳 Оплачувати замовлення онлайн безпосередньо в чаті\n` +
        `📦 Відстежувати статус замовлення та номер ТТН\n` +
        `🛍 Переглядати історію покупок\n\n` +
        `👇 <i>Оберіть потрібну дію на панелі кнопок внизу екрана:</i>`;

      const sendRes = await this.callApi('sendMessage', {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'HTML',
        reply_markup: this.getReplyKeyboard(from)
      });
      if (sendRes.ok && sendRes.result?.message_id) {
        this.trackMessage(chatId, sendRes.result.message_id);
      }
      return;
    }

    // INBOX NOTIFICATIONS FOR ADMIN
    if (text === '📥 Вхідні' || text === '📥 Вхідні повідомлення' || text === '/inbox') {
      if (this.isAdmin(from)) {
        await this.sendAdminInbox(chatId);
      } else {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
      }
      return;
    }

    // OPEN WEB STORE / CATALOG MANAGEMENT
    if (
      text === '📦 Каталог товарів' ||
      text === 'Каталог товарів' ||
      text === '🌐 Відкрити магазин' || 
      text === '🌐 Відкрити каталог' || 
      text === '🚀 Відкрити каталог' ||
      text === '/shop' || 
      text === '/store' ||
      text === '/catalog' ||
      text === '/products'
    ) {
      if (this.isAdmin(from) && (text === '📦 Каталог товарів' || text === 'Каталог товарів' || text === '/catalog' || text === '/products')) {
        await this.sendAdminCatalog(chatId);
        return;
      }

      const appUrl = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://wincher1202.github.io/M1lipStore-/').replace(/\/$/, '');
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
        await this.sendCustomerOrderWithPayment(chatId, order, msgId);
      } else {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} не знайдено.`);
      }
      return;
    }

    // CUSTOMER: Orders list
    if (data.startsWith('orders_list:')) {
      await this.sendCustomerOrdersList(chatId, from.id, msgId);
      return;
    }

    // CUSTOMER: Instant Smart Glocal Test Payment in Bot
    if (data.startsWith('pay_test:')) {
      const orderId = data.replace('pay_test:', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} не знайдено.`);
        return;
      }

      if (order.payment?.status === 'PAID') {
        await this.safeEditOrSend(chatId, msgId, `ℹ️ Замовлення <b>#${orderId}</b> вже успішно оплачено раніше!`, {
          reply_markup: {
            inline_keyboard: [[{ text: '🛍 Мої замовлення', callback_data: `orders_list:${chatId}` }]]
          }
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

      await this.sendCustomerPaymentSuccess(updatedOrder, msgId);
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
      await this.safeEditOrSend(chatId, msgId, `💬 <b>Служба підтримки MILIPSTORE</b>\n\nГрафік роботи: Щодня 09:00 — 21:00\nTelegram менеджера: @milipmanager\nКанал магазину: @m1lipstore\n\nМи з радістю відповімо на будь-які ваші запитання!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍 Мої замовлення', callback_data: `orders_list:${chatId}` }]
          ]
        }
      });
      return;
    }

    // ---------------------------------------------
    // ADMIN ACTIONS (Require isAdmin verification)
    // ---------------------------------------------
    if (!this.isAdmin(from)) {
      await this.safeEditOrSend(chatId, msgId, `⛔ Дія доступна тільки адміністраторам.`);
      return;
    }

    // Admin Dashboard Refresh or Back to Admin
    if (data === 'admin_dashboard' || data === 'back_to_admin' || data === 'show_classic_admin') {
      await this.sendAdminDashboard(chatId, from, msgId);
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
      const filter = data.startsWith('admin_list:') ? data.replace('admin_list:', '').trim() : 'ACTIVE';
      await this.sendAdminOrdersList(chatId, filter, msgId);
      return;
    }

    // Admin View Order Details: handles show_order_ID and admin_view:ID
    if (data.startsWith('show_order_') || data.startsWith('admin_view:')) {
      const orderId = data.replace(/^show_order_/, '').replace(/^admin_view:/, '').trim();
      const order = db.getOrderById(orderId);
      if (order) {
        await this.sendAdminOrderDetails(chatId, order, msgId);
      } else {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} не знайдено.`);
      }
      return;
    }

    // Admin Delete Order - Confirmation Prompt
    if (data.startsWith('admin_delete_prompt:')) {
      const orderId = data.replace('admin_delete_prompt:', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} не знайдено.`);
        return;
      }
      const custName = this.formatCustomerFullName(order.customer);
      await this.safeEditOrSend(chatId, msgId, `⚠️ <b>Підтвердження видалення замовлення #${orderId}</b>\n\n` +
        `👤 Покупець: <b>${custName}</b>\n` +
        `💰 Сума: <b>${order.total} ₴</b>\n` +
        `📊 Статус: <b>${order.status_name || order.status}</b>\n\n` +
        `Ви дійсно хочете повністю видалити це замовлення з бази даних?\n` +
        `<i>❗ Ця дія безповоротна.</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑 Так, видалити назавжди', callback_data: `admin_delete_confirm:${orderId}` }],
            [{ text: '❌ Скасувати (Повернутися)', callback_data: `admin_view:${orderId}` }]
          ]
        }
      });
      return;
    }

    // Admin Delete Order - Execution
    if (data.startsWith('admin_delete_confirm:')) {
      const orderId = data.replace('admin_delete_confirm:', '').trim();
      const deleted = db.deleteOrder(orderId);
      if (deleted) {
        await this.safeEditOrSend(chatId, msgId, `🗑 <b>Замовлення #${orderId} успішно видалено з бази.</b>`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ До активних замовлень', callback_data: 'admin_list:ACTIVE' }],
              [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
            ]
          }
        });
      } else {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} вже було видалене або не знайдене.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ До списку замовлень', callback_data: 'admin_list:ACTIVE' }],
              [{ text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }]
            ]
          }
        });
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
        await this.processAdminStatusChange(chatId, orderId, newStatus, msgId);
        return;
      }
    }

    // Admin Confirm Order
    if (data.startsWith('admin_confirm:')) {
      const orderId = data.replace('admin_confirm:', '').trim();
      await this.processAdminConfirmOrder(chatId, orderId, msgId);
      return;
    }

    // Admin Request TTN Input
    if (data.startsWith('admin_ttn_prompt:')) {
      const orderId = data.replace('admin_ttn_prompt:', '').trim();
      this.adminSessions[chatId] = { action: 'awaiting_ttn', orderId, promptMsgId: msgId };

      await this.safeEditOrSend(chatId, msgId, `🚚 <b>Вкажіть номер ТТН для замовлення #${orderId}</b>\n\nНадішліть номер накладної (наприклад: <code>20450918234851</code>) наступним повідомленням у цей чат.\n\nАбо скористайтесь командою:\n<code>/ttn ${orderId} 20450918234851</code>`, {
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
      await this.sendAdminStatusChangeMenu(chatId, orderId, msgId);
      return;
    }

    // Admin Set Status (colon syntax)
    if (data.startsWith('admin_set_status:')) {
      // format: admin_set_status:STATUS:ORDER_ID
      const parts = data.split(':');
      const newStatus = parts[1];
      const orderId = parts[2];
      await this.processAdminStatusChange(chatId, orderId, newStatus, msgId);
      return;
    }

    // Admin Add Product Prompt & Wizard
    if (data === 'add_new_product' || data === 'admin_add_product') {
      await this.startAddProductWizard(chatId, msgId);
      return;
    }

    // Admin Catalog List
    if (data === 'admin_catalog' || data === 'manage_catalog') {
      await this.sendAdminCatalog(chatId, 0, msgId);
      return;
    }

    if (data.startsWith('admin_catalog_page:')) {
      const page = parseInt(data.replace('admin_catalog_page:', ''), 10) || 0;
      await this.sendAdminCatalog(chatId, page, msgId);
      return;
    }

    // Admin View Single Product Details & Edit Menu
    if (data.startsWith('admin_prod_view:')) {
      const prodId = data.replace('admin_prod_view:', '').trim();
      await this.sendAdminProductView(chatId, prodId, msgId);
      return;
    }

    // Admin Edit Specific Product Field
    if (data.startsWith('edit_prod_field:')) {
      const parts = data.split(':');
      const prodId = parts[1];
      const field = parts[2];
      await this.startEditProductField(chatId, prodId, field, msgId);
      return;
    }

    // Admin Edit Product Field Callbacks
    if (data.startsWith('edit_prod_cb:')) {
      await this.handleEditProductFieldCallback(chatId, from, data, msgId);
      return;
    }

    // Admin Delete Product Prompt
    if (data.startsWith('admin_delete_prod_prompt:')) {
      const prodId = data.replace('admin_delete_prod_prompt:', '').trim();
      const prod = db.getProductById(prodId);
      if (!prod) {
        await this.safeEditOrSend(chatId, msgId, '❌ Товар не знайдено.');
        return;
      }
      await this.safeEditOrSend(chatId, msgId, `⚠️ <b>Підтвердження видалення товару</b>\n\n` +
        `🏷 Товар: <b>${prod.brand} ${prod.title}</b>\n` +
        `💰 Ціна: <b>${prod.price} ₴</b> | Залишок: <b>${prod.quantity} шт.</b>\n\n` +
        `Ви дійсно бажаєте видалити цей товар з каталогу назавжди?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑 Так, видалити з каталогу', callback_data: `admin_delete_prod_confirm:${prodId}` }],
            [{ text: '❌ Скасувати (Повернутися)', callback_data: `admin_prod_view:${prodId}` }]
          ]
        }
      });
      return;
    }

    // Admin Delete Product Confirm
    if (data.startsWith('admin_delete_prod_confirm:')) {
      const prodId = data.replace('admin_delete_prod_confirm:', '').trim();
      db.deleteProduct(prodId);
      await this.safeEditOrSend(chatId, msgId, '🗑 <b>Товар успішно видалено з каталогу.</b>', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 До каталогу товарів', callback_data: 'admin_catalog' }],
            [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
          ]
        }
      });
      return;
    }

    // Admin Inbox / Notification Logs
    if (data === 'admin_inbox' || data === 'inbox') {
      await this.sendAdminInbox(chatId, msgId);
      return;
    }

    if (data === 'admin_inbox_clear') {
      db.clearNotifications();
      await this.sendAdminInbox(chatId, msgId);
      return;
    }

    // Admin Product Wizard Callbacks
    if (data.startsWith('wiz_')) {
      await this.handleWizardCallback(chatId, from, data, msgId);
      return;
    }

    // Admin Manage Product (Legacy compatibility)
    if (data.startsWith('manage_')) {
      const prodId = data.replace('manage_', '').trim();
      await this.sendAdminProductView(chatId, prodId, msgId);
      return;
    }

    // Admin Delete Product (Legacy compatibility)
    if (data.startsWith('delete_prod_')) {
      const prodId = data.replace('delete_prod_', '').trim();
      db.deleteProduct(prodId);
      await this.safeEditOrSend(chatId, msgId, `🗑 Товар успішно видалено з каталогу.`, {
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
  // ----------------------------------------------------
  // Customer Presentation & Payment Flow
  // ----------------------------------------------------
  async sendCustomerOrderWithPayment(chatId, order, messageId = null) {
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
    if (order.status === 'PACKING_PREP' || order.status === 'PACKED') statusEmoji = '📦';
    if (order.status === 'DISPATCH_PREP') statusEmoji = '🚚';
    if (order.status === 'SHIPPED') statusEmoji = '🚚';
    if (order.status === 'DELIVERED') statusEmoji = '🏢';
    if (order.status === 'COMPLETED') statusEmoji = '🎉';
    if (order.status === 'CANCELLED') statusEmoji = '❌';

    const itemsSummary = (order.items || []).map((i, idx) => {
      const color = i.color ? `\n   • Колір: <b>${i.color}</b>` : '';
      return `${idx + 1}. 🕹 <b>${i.title}</b>${color}\n   • Кількість: ${i.qty} шт. × ${i.price} ₴ = <b>${i.price * i.qty} ₴</b>`;
    }).join('\n\n');

    const fullName = this.formatCustomerFullName(customer);
    const provName = delivery.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова Пошта';
    const methodType = (delivery.type === 'postomat' || delivery.method === 'postomat') ? 'поштомат' : 'відділення';

    // Find photo of the 1st ordered item and exact color
    const firstItem = (order.items && order.items[0]) || {};
    const prod = db.getProductById(firstItem.product_id || firstItem.id);
    let colorPhoto = null;
    if (firstItem.color && prod?.color_images?.[firstItem.color]?.main) {
      colorPhoto = prod.color_images[firstItem.color].main;
    } else if (firstItem.color && firstItem.color_images?.[firstItem.color]?.main) {
      colorPhoto = firstItem.color_images[firstItem.color].main;
    } else if (firstItem.img) {
      colorPhoto = firstItem.img;
    } else if (prod?.img) {
      colorPhoto = prod.img;
    }

    let text = `🛍 <b>ДЕТАЛІ ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n`;
    text += `📊 <b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n`;
    text += `📅 <b>Дата:</b> ${new Date(order.created_at || Date.now()).toLocaleString('uk-UA')}\n`;
    if (order.tracking_number) {
      text += `🚚 <b>Номер ТТН:</b> <code>${order.tracking_number}</code>\n`;
    }
    text += `\n🛒 <b>Товари в замовленні:</b>\n${itemsSummary}\n\n`;
    text += `💰 <b>Сума до сплати:</b> <b>${order.total} ₴</b>\n\n`;

    text += `👤 <b>Отримувач:</b>\n`;
    text += `• ПІБ: <b>${fullName}</b>\n`;
    text += `• Телефон: <code>${customer.phone || 'не вказано'}</code>\n`;
    if (customer.email) text += `• Email: ${customer.email}\n`;
    text += `\n`;

    text += `📦 <b>Доставка:</b>\n`;
    text += `• Служба: <b>${provName}</b> (${methodType})\n`;
    text += `• Населений пункт: <b>${delivery.city || 'Україна'}</b>\n`;
    text += `• Відділення / адреса: ${delivery.department || delivery.address || 'Відділення'}\n\n`;

    text += `💳 <b>Оплата:</b>\n`;
    text += `• Спосіб: ${isOnline ? 'Онлайн-оплата' : 'Оплата при отриманні'}\n`;
    text += `• Стан: ${isPaid ? '✅ <b>Оплачено</b>' : '⏳ <b>Очікує оплати</b>'}\n`;
    if (payment.transaction_id) {
      text += `• ID транзакції: <code>${payment.transaction_id}</code>\n`;
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
      { text: '🔄 Оновити інформацію', callback_data: `view_order:${order.order_id}` },
      { text: '🛍 Мої замовлення', callback_data: `orders_list:${chatId}` }
    ]);

    await this.sendPhotoOrMessage(chatId, colorPhoto, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendCustomerPaymentSuccess(order, messageId = null) {
    const cust = order.customer || {};
    const fullName = this.formatCustomerFullName(cust);
    const text = `✅ <b>ОПЛАТУ УСПІШНО ЗАРАХОВАНО!</b>\n\n` +
      `Дякуємо за покупку в <b>MILIPSTORE</b>! 🎉\n\n` +
      `Ваше замовлення <b>#${order.order_id}</b> успішно оплачено та передано на склад.\n\n` +
      `💰 <b>Сума:</b> <b>${order.total} ₴</b>\n` +
      `💳 <b>Спосіб:</b> ${order.payment?.provider || 'Smart Glocal Test'}\n` +
      `🆔 <b>ID транзакції:</b> <code>${order.payment?.transaction_id || 'SG_OFFLINE_AUTO'}</code>\n` +
      `📦 <b>Статус:</b> 🟡 <b>Очікує комплектації</b>\n\n` +
      `Ми вже формуємо ваше замовлення! Очікуйте на сповіщення про відправку та номер ТТН у цьому чаті.`;

    const buttons = [
      [{ text: '🛍 Мої замовлення', callback_data: `orders_list:${order.customer?.telegram_id || cust.telegram_id || ''}` }],
      [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
    ];

    const targetChatId = order.customer?.telegram_id || cust.telegram_id;
    if (targetChatId) {
      await this.safeEditOrSend(targetChatId, messageId, text, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
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

  async sendCustomerOrdersList(chatId, telegramUserId, messageId = null) {
    const orders = db.getOrdersByTelegramId(telegramUserId || chatId);

    if (!orders || orders.length === 0) {
      const appUrl = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://m1lipstore.onrender.com').replace(/\/$/, '');
      await this.safeEditOrSend(chatId, messageId, `🛍 <b>Мої замовлення</b>\n\nУ вас поки немає оформлених замовлень.\nОберіть девайси в нашому магазині та оформлюйте замовлення!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Відкрити каталог', web_app: { url: appUrl } }]
          ]
        }
      });
      return;
    }

    const recentOrders = orders.slice(0, 5);

    for (const o of recentOrders) {
      const isPaid = o.payment?.status === 'PAID';
      const isCod = o.payment?.is_cod || o.payment?.method === 'cod';
      const isUnpaid = o.payment?.method === 'online' && !isPaid;
      const statusLabel = ORDER_STATUSES[o.status]?.name || o.status;
      const provName = o.delivery?.provider === 'ukrposhta' ? 'Укрпошта' : (o.delivery?.provider_name || 'Нова Пошта');
      const delivPoint = o.delivery?.department || o.delivery?.address || o.delivery?.city || '';

      let statusEmoji = '📦';
      if (o.status === 'NEW') statusEmoji = '🆕';
      else if (o.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
      else if (o.status === 'CONFIRMED') statusEmoji = '✅';
      else if (o.status === 'PACKING_PREP' || o.status === 'PACKED') statusEmoji = '📦';
      else if (o.status === 'DISPATCH_PREP' || o.status === 'SHIPPED') statusEmoji = '🚚';
      else if (o.status === 'DELIVERED') statusEmoji = '🏢';
      else if (o.status === 'COMPLETED') statusEmoji = '🎉';
      else if (o.status === 'CANCELLED') statusEmoji = '❌';

      const firstItem = (o.items && o.items[0]) || {};
      const itemColor = firstItem.color || '';
      const prod = db.getProductById(firstItem.product_id || firstItem.id);

      // Find exact color photo
      let colorPhoto = null;
      if (itemColor && prod?.color_images?.[itemColor]?.main) {
        colorPhoto = prod.color_images[itemColor].main;
      } else if (itemColor && firstItem.color_images?.[itemColor]?.main) {
        colorPhoto = firstItem.color_images[itemColor].main;
      } else if (firstItem.img) {
        colorPhoto = firstItem.img;
      } else if (prod?.img) {
        colorPhoto = prod.img;
      }

      let cardText = `🛍 <b>Замовлення #${o.order_id}</b>\n\n`;
      cardText += `🕹 <b>${firstItem.title || 'Товар'}</b>\n`;
      cardText += `🎨 Колір: <b>${itemColor || 'Стандартний'}</b>${firstItem.qty > 1 ? ` (×${firstItem.qty} шт.)` : ''}\n`;
      if (o.items && o.items.length > 1) {
        cardText += `<i>+ ще ${o.items.length - 1} поз. у замовленні</i>\n`;
      }
      cardText += `💰 <b>Сума: ${o.total} ₴</b>\n`;
      cardText += `📊 Статус: ${statusEmoji} <b>${statusLabel}</b>\n`;
      cardText += `🏢 Доставка: <b>${provName}</b> (${delivPoint})\n`;
      cardText += `💳 Оплата: <b>${isPaid ? 'Оплачено ✅' : (isUnpaid ? 'Очікує оплати ⏳' : 'Накладений платіж 📦')}</b>\n`;
      if (o.tracking_number) {
        cardText += `🚚 Номер ТТН: <code>${o.tracking_number}</code>\n`;
      }

      const buttons = [];
      if (isUnpaid) {
        buttons.push([
          { text: `💳 Оплатити #${o.order_id} (${o.total} ₴)`, callback_data: `send_invoice:${o.order_id}` },
          { text: `⚡ Сплатити (Test)`, callback_data: `pay_test:${o.order_id}` }
        ]);
      }
      buttons.push([
        { text: '🔍 Повні деталі замовлення', callback_data: `view_order:${o.order_id}` }
      ]);

      await this.sendPhotoOrMessage(chatId, colorPhoto, cardText, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }

  // ----------------------------------------------------
  // Admin Management Flow
  // ----------------------------------------------------
  async sendAdminDashboard(chatId, from, messageId = null) {
    const stats = db.getStats();
    const orders = db.getOrders();

    // Only orders that are paid or cash on delivery appear for admin processing
    const isReadyForAdmin = o => (o.payment?.status === 'PAID' || o.payment?.is_cod || o.payment?.method === 'cod') && o.status !== 'PENDING_PAYMENT';
    const activeOrders = orders.filter(o => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status) && isReadyForAdmin(o));
    const archiveOrders = orders.filter(o => ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status));

    const newCount = activeOrders.filter(o => o.status === 'NEW').length;
    const confirmedCount = activeOrders.filter(o => o.status === 'CONFIRMED').length;
    const packingCount = activeOrders.filter(o => o.status === 'PACKING_PREP' || o.status === 'PACKED' || o.status === 'DISPATCH_PREP').length;
    const shippedCount = activeOrders.filter(o => o.status === 'SHIPPED').length;

    let text = `👑 <b>Адмін-панель MILIPSTORE</b>\n\n`;
    text += `Адміністратор: <b>${from.first_name || ''}</b> ${from.username ? '(@' + from.username + ')' : ''}\n\n`;
    text += `📊 <b>Стан замовлень:</b>\n`;
    text += `• ⚡ <b>Активні (в роботі): ${activeOrders.length}</b>\n`;
    if (activeOrders.length > 0) {
      text += `  └ 🆕 Нові (оплачені): ${newCount} | ✅ Підтверджені: ${confirmedCount} | 📦 Пакування: ${packingCount} | 🚚 Відправлені: ${shippedCount}\n`;
    }
    text += `• 🗄 <b>Архів (доставлені / завершені): ${archiveOrders.length}</b>\n`;
    text += `• 💰 <b>Виторг: ${stats.total_sales.toLocaleString('uk-UA')} ₴</b>\n\n`;
    text += `<i>Оберіть розділ нижче:</i>`;

    const buttons = [
      [
        { text: `⚡ Активні замовлення (${activeOrders.length})`, callback_data: 'admin_list:ACTIVE' },
        { text: `🗄 Архів (${archiveOrders.length})`, callback_data: 'admin_list:ARCHIVE' }
      ],
      [
        { text: '📦 Каталог товарів', callback_data: 'admin_catalog' },
        { text: '➕ Додати новий товар', callback_data: 'add_new_product' }
      ],
      [
        { text: '📥 Вхідні повідомлення', callback_data: 'admin_inbox' }
      ]
    ];

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminOrdersList(chatId, filter = 'ACTIVE', messageId = null) {
    const allOrders = db.getOrders();
    let orders = [];
    let filterTitle = 'Активні замовлення';

    const isReadyForAdmin = o => (o.payment?.status === 'PAID' || o.payment?.is_cod || o.payment?.method === 'cod') && o.status !== 'PENDING_PAYMENT';
    const activeCount = allOrders.filter(o => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status) && isReadyForAdmin(o)).length;
    const archiveCount = allOrders.filter(o => ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status)).length;

    if (filter === 'ARCHIVE') {
      orders = allOrders.filter(o => ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status));
      filterTitle = '🗄 Архів замовлень (доставлені та завершені)';
    } else {
      orders = allOrders.filter(o => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status) && isReadyForAdmin(o));
      filterTitle = '⚡ Активні замовлення (в роботі)';
    }

    if (orders.length === 0) {
      const emptyMsg = filter === 'ARCHIVE'
        ? `🗄 <b>Архів замовлень порожній</b>\n\nСюди потрапляють замовлення зі статусом «Доставлено», «Виконано» або «Скасовано».`
        : `⚡ <b>Активних замовлень немає</b>\n\nВсі поточні замовлення опрацьовані або очікують оплати клієнтом.`;

      await this.safeEditOrSend(chatId, messageId, emptyMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `⚡ Активні (${activeCount})`, callback_data: 'admin_list:ACTIVE' },
              { text: `🗄 Архів (${archiveCount})`, callback_data: 'admin_list:ARCHIVE' }
            ],
            [
              { text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }
            ]
          ]
        }
      });
      return;
    }

    let text = `📋 <b>${filterTitle} (${orders.length}):</b>\n\n`;
    text += `<i>Натисніть на замовлення нижче, щоб відкрити інформацію та керувати статусом:</i>\n\n`;

    const buttons = [];

    orders.slice(0, 10).forEach(o => {
      const name = this.formatCustomerFullName(o.customer);
      const statusLabel = ORDER_STATUSES[o.status]?.name || o.status;
      let statusIcon = '📦';
      if (o.status === 'NEW') statusIcon = '🆕';
      else if (o.status === 'PENDING_PAYMENT') statusIcon = '⏳';
      else if (o.status === 'CONFIRMED') statusIcon = '✅';
      else if (o.status === 'PACKING_PREP' || o.status === 'PACKED') statusIcon = '📦';
      else if (o.status === 'DISPATCH_PREP' || o.status === 'SHIPPED') statusIcon = '🚚';
      else if (o.status === 'DELIVERED') statusIcon = '🏢';
      else if (o.status === 'COMPLETED') statusIcon = '🎉';
      else if (o.status === 'CANCELLED') statusIcon = '❌';

      text += `${statusIcon} <b>#${o.order_id}</b> — <b>${o.total} ₴</b> | <i>${statusLabel}</i>\n`;
      text += `👤 ${name} (<code>${o.customer?.phone || 'без тел.'}</code>)\n`;
      text += `📍 ${o.delivery?.city || ''}, ${o.delivery?.department || o.delivery?.address || ''}\n`;
      if (o.tracking_number) text += `🚚 ТТН: <code>${o.tracking_number}</code>\n`;
      text += `\n`;

      buttons.push([
        { text: `🔍 #${o.order_id} • ${o.total} ₴ • ${statusIcon} ${statusLabel}`, callback_data: `admin_view:${o.order_id}` }
      ]);
    });

    buttons.push([
      { text: `⚡ Активні (${activeCount})`, callback_data: 'admin_list:ACTIVE' },
      { text: `🗄 Архів (${archiveCount})`, callback_data: 'admin_list:ARCHIVE' }
    ]);
    buttons.push([
      { text: '🔙 До адмін-панелі', callback_data: 'admin_dashboard' }
    ]);

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminOrderDetails(chatId, order, messageId = null) {
    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const pay = order.payment || {};
    const statusName = ORDER_STATUSES[order.status]?.name || order.status;

    let statusEmoji = '📦';
    if (order.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
    if (order.status === 'NEW') statusEmoji = '🆕';
    if (order.status === 'CONFIRMED') statusEmoji = '✅';
    if (order.status === 'PACKING_PREP' || order.status === 'PACKED') statusEmoji = '📦';
    if (order.status === 'DISPATCH_PREP') statusEmoji = '🚚';
    if (order.status === 'SHIPPED') statusEmoji = '🚚';
    if (order.status === 'DELIVERED') statusEmoji = '🏢';
    if (order.status === 'COMPLETED') statusEmoji = '🎉';
    if (order.status === 'CANCELLED') statusEmoji = '❌';

    const itemsText = (order.items || []).map(i => {
      const color = i.color ? ` (${i.color})` : '';
      return `• <b>${i.title}</b>${color}\n  ${i.qty} шт. × ${i.price} ₴ = <b>${i.price * i.qty} ₴</b>`;
    }).join('\n');

    const fullName = this.formatCustomerFullName(cust);

    let text = `👑 <b>ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n`;
    text += `📊 <b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n`;
    text += `📅 <b>Дата створення:</b> ${new Date(order.created_at || Date.now()).toLocaleString('uk-UA')}\n`;
    if (order.tracking_number) {
      text += `🚚 <b>Номер ТТН:</b> <code>${order.tracking_number}</code>\n`;
    }

    text += `\n👤 <b>Покупець:</b>\n`;
    text += `• ПІБ: <b>${fullName}</b>\n`;
    text += `• Прізвище: <b>${cust.last_name || '—'}</b>\n`;
    text += `• Ім'я: <b>${cust.first_name || '—'}</b>\n`;
    text += `• По батькові: <b>${cust.middle_name || cust.patronymic || '—'}</b>\n`;
    text += `• Телефон: <code>${cust.phone || 'не вказано'}</code>\n`;
    if (cust.telegram_username) text += `• Telegram: @${cust.telegram_username}\n`;
    else if (cust.telegram_id) text += `• Telegram ID: <code>${cust.telegram_id}</code>\n`;
    if (cust.email) text += `• Email: ${cust.email}\n`;

    text += `\n🏢 <b>Доставка:</b>\n`;
    text += `• Перевізник: <b>${deliv.provider_name || 'Нова Пошта'}</b>\n`;
    text += `• Місто: <b>${deliv.city}</b>\n`;
    text += `• Відділення / адреса: ${deliv.department || deliv.address}\n`;

    text += `\n💳 <b>Оплата:</b>\n`;
    const payMethodName = pay.method === 'online' ? 'Онлайн у Telegram-боті' : 'Оплата при отриманні (Накладений платіж)';
    const payStatusName = pay.status === 'PAID' ? '✅ ОПЛАЧЕНО' : (pay.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');
    text += `• Спосіб: ${payMethodName}\n`;
    text += `• Стан: <b>${payStatusName}</b>\n`;
    if (pay.transaction_id) text += `• ID транзакції: <code>${pay.transaction_id}</code>\n`;

    text += `\n🛍 <b>Товари в замовленні:</b>\n${itemsText}\n\n`;
    text += `💰 <b>ЗАГАЛЬНА СУМА: ${order.total} ₴</b>\n`;
    if (order.admin_comment || pay.comment) {
      text += `📝 <b>Примітка:</b> <i>${order.admin_comment || pay.comment}</i>\n`;
    }

    const buttons = [];

    // Row 1: Change status
    buttons.push([
      { text: '🔄 Змінити статус замовлення', callback_data: `admin_status_menu:${order.order_id}` }
    ]);

    // Row 2: TTN
    buttons.push([
      { text: order.tracking_number ? '🚚 Змінити номер ТТН' : '🚚 Вказати номер ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
    ]);

    // Row 3: Delete
    buttons.push([
      { text: '🗑 Видалити замовлення', callback_data: `admin_delete_prompt:${order.order_id}` }
    ]);

    // Row 4: Navigation
    const isArchived = ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status);
    buttons.push([
      { text: isArchived ? '🗄 До архіву' : '⚡ До активних', callback_data: isArchived ? 'admin_list:ARCHIVE' : 'admin_list:ACTIVE' },
      { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
    ]);

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminStatusChangeMenu(chatId, orderId, messageId = null) {
    const order = db.getOrderById(orderId);
    if (!order) return;

    const currentStatusName = ORDER_STATUSES[order.status]?.name || order.status;
    const custName = this.formatCustomerFullName(order.customer);
    const text = `🔄 <b>Зміна статусу замовлення #${orderId}</b>\n\n` +
      `Поточний статус: <b>${currentStatusName}</b>\n` +
      `Клієнт: <b>${custName}</b> | Сума: <b>${order.total} ₴</b>\n\n` +
      `<i>Оберіть новий статус (покупцю буде надіслано автоматичне сповіщення в Telegram):</i>`;

    const buttons = [
      [
        { text: '📦 Пакування товару', callback_data: `admin_set_status:PACKING_PREP:${orderId}` },
        { text: '🚚 Готується до відправки', callback_data: `admin_set_status:DISPATCH_PREP:${orderId}` }
      ],
      [
        { text: '🚚 Відправлено (Вказати ТТН)', callback_data: `admin_ttn_prompt:${orderId}` }
      ],
      [
        { text: '🏢 Доставлено (В архів)', callback_data: `admin_set_status:DELIVERED:${orderId}` }
      ],
      [
        { text: '❌ Скасувати замовлення (В архів)', callback_data: `admin_set_status:CANCELLED:${orderId}` }
      ],
      [
        { text: '🔙 Назад до замовлення', callback_data: `admin_view:${orderId}` }
      ]
    ];

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async processAdminConfirmOrder(chatId, orderId, messageId = null) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.safeEditOrSend(chatId, messageId, `❌ Замовлення #${orderId} не знайдено.`);
      return;
    }

    db.updateOrderStatus(orderId, 'CONFIRMED', 'Admin', 'Підтверджено адміністратором у Telegram-боті');
    const updated = db.getOrderById(orderId);

    await this.safeEditOrSend(chatId, messageId, `✅ <b>Замовлення #${orderId} успішно підтверджено!</b>\nПокупця сповіщено в Telegram про зміну статусу.`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚚 Вказати ТТН / Відправити', callback_data: `admin_ttn_prompt:${orderId}` },
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` }
          ],
          [
            { text: '⚡ До списку замовлень', callback_data: 'admin_list:ACTIVE' }
          ]
        ]
      }
    });

    // Notify customer
    await this.notifyCustomerStatusChange(updated, 'CONFIRMED');
  }

  async processAdminSaveTtn(chatId, orderId, ttn, messageId = null) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.safeEditOrSend(chatId, messageId, `❌ Замовлення #${orderId} не знайдено.`);
      return;
    }

    db.updateOrderTtn(orderId, ttn, 'Admin');
    db.updateOrderStatus(orderId, 'SHIPPED', 'Admin', `Додано ТТН ${ttn} та переведено у статус Відправлено`);
    const updated = db.getOrderById(orderId);

    await this.safeEditOrSend(chatId, messageId, `✅ <b>ТТН збережено для #${orderId}!</b>\n\nНомер ТТН: <code>${ttn}</code>\nСтатус змінено на: <b>🚚 Відправлено (SHIPPED)</b>\nПокупцю надіслано повідомлення з номером накладної.`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` },
            { text: '⚡ До активних замовлень', callback_data: 'admin_list:ACTIVE' }
          ]
        ]
      }
    });

    // Notify customer with TTN
    await this.notifyCustomerStatusChange(updated, 'SHIPPED', ttn);
  }

  async processAdminStatusChange(chatId, orderId, newStatus, messageId = null) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.safeEditOrSend(chatId, messageId, `❌ Замовлення #${orderId} не знайдено.`);
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
    const isArchived = ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(updated.status);

    await this.safeEditOrSend(chatId, messageId, `✅ <b>Статус замовлення #${orderId} успішно змінено на:</b> <b>${statusName}</b>` + (newStatus === 'PAID' ? ' (Оплату зафіксовано)' : '') + (isArchived ? '\n\n📁 Замовлення переміщено в <b>Архів</b>.' : ''), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 До замовлення', callback_data: `admin_view:${orderId}` },
            { text: isArchived ? '🗄 До архіву' : '⚡ До активних', callback_data: isArchived ? 'admin_list:ARCHIVE' : 'admin_list:ACTIVE' }
          ]
        ]
      }
    });

    // Notify customer
    await this.notifyCustomerStatusChange(updated, updated.status);
  }

  async notifyCustomerStatusChange(order, newStatus, ttn = null) {
    if (!order) return;

    db.addNotification({
      type: 'STATUS_CHANGED',
      order_id: order.order_id,
      status: newStatus,
      status_name: ORDER_STATUSES[newStatus]?.name || newStatus,
      ttn: ttn || order.tracking_number
    });

    const targetChatId = db.getTelegramIdForOrder(order);
    if (!targetChatId) {
      console.log(`[TelegramBot] No Telegram chat ID linked for customer in order #${order.order_id}`);
      return;
    }

    const orderNum = `#${order.order_id}`;
    let messageText = '';
    const track = ttn || order.tracking_number;
    const provName = order.delivery?.provider === 'ukrposhta' ? 'Укрпошта' : (order.delivery?.provider_name || 'Нова Пошта');

    switch (newStatus) {
      case 'CONFIRMED':
        messageText = `✅ <b>Ваше замовлення ${orderNum} підтверджено менеджером!</b>\n\nМи вже прийняли замовлення в роботу та розпочали комплектацію на складі.`;
        if (order.payment?.method === 'online' && order.payment?.status !== 'PAID') {
          messageText += `\n\n💳 <b>Очікується онлайн-оплата:</b> ${order.total} ₴`;
        }
        break;
      case 'PAID':
        messageText = `💳 <b>Оплату за замовлення ${orderNum} успішно зараховано!</b>\n\nСума: <b>${order.total} ₴</b>.\nДякуємо! Ваше замовлення передано на склад для пакування.`;
        break;
      case 'PACKING_PREP':
      case 'PACKED':
        messageText = `📦 <b>Ваше замовлення ${orderNum} зараз упаковується на складі!</b>\n\nМи дбайливо перевіряємо та пакуємо ваші девайси перед відправкою.`;
        break;
      case 'DISPATCH_PREP':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} зібрано та готується до відправки!</b>\n\nНевдовзі посилка буде передана поштовій службі.`;
        break;
      case 'SHIPPED':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} вже відправлено!</b>\n\n`;
        if (track) {
          messageText += `Номер ТТН: <code>${track}</code>\n`;
        }
        messageText += `Служба доставки: <b>${provName}</b>\n\nВи можете відстежувати рух посилки за номером ТТН у додатку перевізника або на сайті.`;
        break;
      case 'DELIVERED':
        messageText = `🏢 <b>Ваше замовлення ${orderNum} прибуло у відділення / поштомат!</b>\n\nПосилка вже чекає на вас. Будь ласка, отримайте ваше замовлення!`;
        break;
      case 'COMPLETED':
        messageText = `🎉 <b>Ваше замовлення ${orderNum} успішно виконано!</b>\n\nДякуємо за покупку в MILIPSTORE! Приємного користування девайсами!`;
        break;
      case 'CANCELLED':
        messageText = `❌ <b>Ваше замовлення ${orderNum} було скасовано.</b>\n\nЯкщо у вас виникли будь-які запитання, звертайтеся до нашої служби підтримки @milipmanager.`;
        break;
      default:
        messageText = `📦 <b>Оновлено статус вашого замовлення ${orderNum}:</b> <b>${ORDER_STATUSES[newStatus]?.name || newStatus}</b>`;
        break;
    }

    const custButtons = [];
    if (order.payment?.method === 'online' && order.payment?.status !== 'PAID' && (newStatus === 'CONFIRMED' || newStatus === 'NEW')) {
      custButtons.push([
        { text: `💳 Оплатити ${order.total} ₴ онлайн`, callback_data: `pay_test:${order.order_id}` }
      ]);
    }
    custButtons.push([
      { text: '🔍 Переглянути замовлення', callback_data: `view_order:${order.order_id}` },
      { text: '🛍 Мої замовлення', callback_data: `orders_list:${targetChatId}` }
    ]);

    try {
      await this.callApi('sendMessage', {
        chat_id: targetChatId,
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: custButtons }
      });
      console.log(`[TelegramBot] Sent status notification to customer (${targetChatId}) for order #${order.order_id}`);
    } catch (e) {
      console.error(`[TelegramBot] Failed to send status notification to customer:`, e);
    }
  }

  // ----------------------------------------------------
  // Global Event Triggers
  // ----------------------------------------------------
  async sendOrderCreatedNotifications(order) {
    db.addNotification({
      type: 'ORDER_CREATED',
      order_id: order.order_id,
      total: order.total,
      customer: this.formatCustomerFullName(order.customer),
      status: order.status
    });

    // 1. Notify Customer in Telegram (Send order invoice card)
    if (order.customer?.telegram_id) {
      await this.sendCustomerOrderWithPayment(order.customer.telegram_id, order);
    }

    // 2. Anti-Spam Admin Notification:
    // Only notify admins immediately if order is Cash-On-Delivery (COD) or already PAID.
    // For unpaid online orders, admin will only receive notification once payment is completed.
    const isPaid = order.payment?.status === 'PAID';
    const isCod = order.payment?.is_cod || order.payment?.method === 'cod';

    if (isPaid || isCod) {
      if (!order._admin_notified) {
        order._admin_notified = true;
        db.save();
        await this.notifyAdminsNewOrder(order);
      }
    }
  }

  async notifyAdminsNewOrder(order) {
    if (order._admin_notified) return;
    order._admin_notified = true;
    order._admin_paid_notified = true;
    db.save();

    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const itemsList = (order.items || []).map(i => `• ${i.title}${i.color ? ` (${i.color})` : ''} — ${i.qty} шт. × ${i.price} ₴`).join('\n');
    const isPaid = order.payment?.status === 'PAID';
    const isCod = order.payment?.is_cod || order.payment?.method === 'cod';
    const payStatus = isPaid ? '✅ Оплачено онлайн' : (isCod ? '📦 Накладений платіж' : '⏳ Очікує оплати');
    const fullName = this.formatCustomerFullName(cust);
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';

    const adminMsg = `🔔 <b>НОВЕ ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n` +
      `🛍 <b>Товари:</b>\n${itemsList}\n\n` +
      `💰 <b>Разом:</b> <b>${order.total} ₴</b> • ${payStatus}\n\n` +
      `👤 <b>Покупець:</b>\n` +
      `• ПІБ: <b>${fullName}</b>\n` +
      `• Телефон: <code>${cust.phone || 'не вказано'}</code>\n` +
      (cust.telegram_username ? `• Telegram: @${cust.telegram_username}\n` : '') +
      (cust.email ? `• Email: ${cust.email}\n` : '') +
      `\n` +
      `📦 <b>Доставка:</b>\n` +
      `• Перевізник: <b>${provName}</b>\n` +
      `• Місто: <b>${deliv.city || ''}</b>\n` +
      `• Адреса / відділення: ${deliv.department || deliv.address || ''}\n\n` +
      `💳 <b>Оплата:</b>\n` +
      `• Спосіб: ${order.payment?.provider || (isCod ? 'Накладений платіж' : 'Онлайн')}\n` +
      `• Статус: <b>${payStatus}</b>`;

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

  async sendCustomerPaymentSuccess(order, messageId = null) {
    db.addNotification({
      type: 'PAYMENT_SUCCESS',
      order_id: order.order_id,
      total: order.total,
      transaction_id: order.payment?.transaction_id
    });

    const cust = order.customer || {};
    const fullName = this.formatCustomerFullName(cust);
    const targetChatId = order.customer?.telegram_id || cust.telegram_id;

    if (targetChatId) {
      const text = `✅ <b>ОПЛАТУ УСПІШНО ЗАРАХОВАНО!</b>\n\n` +
        `Дякуємо за покупку в <b>MILIPSTORE</b>! 🎉\n\n` +
        `Ваше замовлення <b>#${order.order_id}</b> успішно оплачено та передано на склад.\n\n` +
        `💰 <b>Сума:</b> <b>${order.total} ₴</b>\n` +
        `💳 <b>Спосіб:</b> ${order.payment?.provider || 'Smart Glocal Test'}\n` +
        `🆔 <b>ID транзакції:</b> <code>${order.payment?.transaction_id || 'SG_OFFLINE_AUTO'}</code>\n` +
        `📦 <b>Статус:</b> 🟡 <b>Очікує комплектації</b>\n\n` +
        `Ми вже формуємо ваше замовлення! Очікуйте на сповіщення про відправку та номер ТТН у цьому чаті.`;

      const buttons = [
        [{ text: '🛍 Мої замовлення', callback_data: `orders_list:${targetChatId}` }],
        [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
      ];

      await this.safeEditOrSend(targetChatId, messageId, text, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }

  async sendAdminPaymentSuccess(order) {
    if (order._admin_paid_notified || order._admin_notified) return;
    order._admin_paid_notified = true;
    order._admin_notified = true;
    db.save();

    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const itemsList = (order.items || []).map(i => `• ${i.title}${i.color ? ` (${i.color})` : ''} — ${i.qty} шт. × ${i.price} ₴`).join('\n');
    const fullName = this.formatCustomerFullName(cust);
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова пошта';

    const adminMsg = `🎉 <b>НОВЕ ОПЛАЧЕНЕ ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n` +
      `🛍 <b>Товари:</b>\n${itemsList}\n\n` +
      `💰 <b>Оплачено:</b> <b>${order.total} ₴</b> ✅\n\n` +
      `👤 <b>Покупець:</b>\n` +
      `• ПІБ: <b>${fullName}</b>\n` +
      `• Телефон: <code>${cust.phone || 'не вказано'}</code>\n` +
      (cust.telegram_username ? `• Telegram: @${cust.telegram_username}\n` : '') +
      (cust.email ? `• Email: ${cust.email}\n` : '') +
      `\n` +
      `📦 <b>Доставка:</b>\n` +
      `• Перевізник: <b>${provName}</b>\n` +
      `• Місто: <b>${deliv.city || ''}</b>\n` +
      `• Відділення / адреса: ${deliv.department || deliv.address || ''}\n\n` +
      `💳 <b>Оплата:</b>\n` +
      `• Система: Smart Glocal Test\n` +
      `• Статус: <b>Оплачено ✅</b>`;

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

  // ----------------------------------------------------
  // Interactive Product Creation Wizard (Admin)
  // ----------------------------------------------------
  async startAddProductWizard(chatId, messageId = null) {
    this.adminSessions[chatId] = {
      action: 'wizard_add_product',
      step: 'brand',
      cardMsgId: messageId,
      data: {
        brand: '',
        title: '',
        description: '',
        specs: [],
        price: 0,
        category: '',
        colors: [],
        color_images: {},
        color_quantities: {},
        quantity: 10,
        img: '',
        gallery: [],
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

    const res = await this.safeEditOrSend(chatId, messageId, `➕ <b>Створення нового товару MILIPSTORE</b>\n\n` +
      `<b>Крок 1/8: Оберіть бренд товару:</b>\n` +
      `<i>Натисніть на один із брендів нижче або введіть назву вручну:</i>`, {
      reply_markup: { inline_keyboard: brands }
    });

    if (res?.result?.message_id) {
      this.adminSessions[chatId].cardMsgId = res.result.message_id;
    }
  }

  async handleWizardCallback(chatId, from, data, messageId = null) {
    const session = this.adminSessions[chatId];
    if (!session || session.action !== 'wizard_add_product') {
      await this.safeEditOrSend(chatId, messageId, 'ℹ️ Сесію створення товару завершено або скасовано. Щоб розпочати заново, натисніть /add_product або оберіть «➕ Додати новий товар» в адмін-панелі.');
      return;
    }

    if (messageId) {
      session.cardMsgId = messageId;
    }

    if (data === 'wiz_cancel') {
      const cardId = session.cardMsgId;
      delete this.adminSessions[chatId];
      await this.safeEditOrSend(chatId, cardId, '❌ Створення товару скасовано.', {
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
        await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Введіть назву бренду текстом:</b>\n\n<i>Наприклад: Razer, Logitech, ATK, Keychron, Lamzu:</i>`, {
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

    // STEP 3: DESCRIPTION SKIP / AUTO
    if (data === 'wiz_desc_skip' || data === 'wiz_desc_auto') {
      const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
      session.data.description = `${fullTitle} — якісний ігровий девайс з офіційною гарантією від MILIPSTORE.`;
      await this.promptWizardSpecs(chatId);
      return;
    }

    // STEP 4: SPECS ACTIONS
    if (data === 'wiz_specs_done') {
      if (!session.data.specs || session.data.specs.length === 0) {
        session.data.specs = this.getDefaultSpecs(session.data.category || 'мишки');
      }
      await this.promptWizardPrice(chatId);
      return;
    }

    if (data === 'wiz_specs_skip') {
      session.data.specs = this.getDefaultSpecs(session.data.category || 'мишки');
      await this.promptWizardPrice(chatId);
      return;
    }

    if (data === 'wiz_specs_clear') {
      session.data.specs = [];
      await this.promptWizardSpecs(chatId);
      return;
    }

    // STEP 6: CATEGORY
    if (data.startsWith('wiz_cat:')) {
      const catVal = data.replace('wiz_cat:', '').trim();
      if (catVal === 'CUSTOM') {
        session.step = 'custom_category';
        await this.safeEditOrSend(chatId, session.cardMsgId, `🗂 <b>Введіть назву нової категорії текстом:</b>\n\n<i>Наприклад: Світчі, Кейкапи, Мікрофони, Кронштейни:</i>`, {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
          }
        });
        return;
      }

      session.data.category = catVal;
      db.addCategory(catVal);
      await this.promptWizardTag(chatId);
      return;
    }

    // STEP 7: TAG / BADGE
    if (data.startsWith('wiz_tag:')) {
      const tagVal = data.replace('wiz_tag:', '').trim();
      session.data.tag = (tagVal === 'SKIP' || tagVal === 'CLEAR') ? '' : tagVal;
      await this.promptWizardColors(chatId);
      return;
    }

    // STEP 8: COLOR TOGGLES (Single Plate Multi-selection without spamming)
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
      await this.safeEditOrSend(chatId, session.cardMsgId, `🎨 <b>Введіть назву кольору / варіації текстом:</b>\n\n<i>Наприклад: Gradient Purple, Matt White, Retro Grey, Cyberpunk:</i>`, {
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
      await this.promptWizardCatalogPhoto(chatId);
      return;
    }

    if (data === 'wiz_colors_skip') {
      session.data.colors = ['Black'];
      await this.promptWizardCatalogPhoto(chatId);
      return;
    }

    // STEP 8: MAIN CATALOG PHOTO ACTIONS (Mandatory manual upload/link only)
    if (data === 'wiz_cat_photo_auto' || data === 'wiz_cat_photo_skip') {
      await this.safeEditOrSend(chatId, session.cardMsgId, `⚠️ <b>Головне фото для каталогу є обов'язковим!</b>\n\nБудь ласка, надішліть файл зображення або пряме посилання на картинку в цей чат:`, {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]]
        }
      });
      return;
    }

    // STEP 9: COLOR PHOTOS ACTIONS (Per Color)
    const colors = session.data.colors || ['Black'];
    const curColor = colors[session.data.currentColorIndex] || 'Black';

    if (data === 'wiz_color_done_photos') {
      const hasPhoto = !!(session.data.color_images?.[curColor]?.main || (session.data.color_images?.[curColor]?.gallery || []).length > 0);
      if (!hasPhoto) {
        await this.safeEditOrSend(chatId, session.cardMsgId, `⚠️ <b>Фото для кольору «${curColor}» є обов'язковим!</b>\n\nБудь ласка, надішліть файл зображення або пряме посилання на картинку в цей чат:`, {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
          }
        });
        return;
      }

      session.data.currentColorIndex++;
      if (session.data.currentColorIndex < colors.length) {
        await this.promptWizardColorPhotos(chatId);
      } else {
        session.data.currentQtyIndex = 0;
        await this.promptWizardColorQuantity(chatId);
      }
      return;
    }

    if (data === 'wiz_color_photo_auto' || data === 'wiz_color_photo_skip' || data === 'wiz_color_photo_skip_all') {
      await this.safeEditOrSend(chatId, session.cardMsgId, `⚠️ <b>Фото для кольору «${curColor}» є обов'язковим!</b>\n\nПропуск фото для кольорів вимкнено. Будь ласка, надішліть фото для «${curColor}» у чат:`, {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
        }
      });
      return;
    }

    // STEP 10: QUANTITIES (Manual text input with Skip option)
    if (data === 'wiz_qty_skip') {
      const curColorQty = colors[session.data.currentQtyIndex] || 'Black';
      if (!session.data.color_quantities) session.data.color_quantities = {};
      session.data.color_quantities[curColorQty] = 0;

      session.data.currentQtyIndex++;
      if (session.data.currentQtyIndex < colors.length) {
        await this.promptWizardColorQuantity(chatId);
      } else {
        await this.showWizardConfirm(chatId);
      }
      return;
    }

    if (data.startsWith('wiz_qty:')) {
      const qtyVal = parseInt(data.replace('wiz_qty:', '').trim(), 10) || 0;
      const curColorQty = colors[session.data.currentQtyIndex] || 'Black';
      if (!session.data.color_quantities) session.data.color_quantities = {};
      session.data.color_quantities[curColorQty] = qtyVal;

      session.data.currentQtyIndex++;
      if (session.data.currentQtyIndex < colors.length) {
        await this.promptWizardColorQuantity(chatId);
      } else {
        await this.showWizardConfirm(chatId);
      }
      return;
    }

    // STEP 11: CONFIRM & PUBLISH
    if (data === 'wiz_save_publish') {
      await this.saveWizardProduct(chatId);
      return;
    }
  }

  async handleWizardMessage(chatId, from, msg) {
    const session = this.adminSessions[chatId];
    if (!session || session.action !== 'wizard_add_product') return;

    // Delete user's incoming message to keep the chat clean
    if (msg.message_id) {
      await this.safeDeleteMessage(chatId, msg.message_id);
    }

    const text = (msg.text || '').trim();

    // 1. Custom Brand Input
    if (session.step === 'custom_brand') {
      if (!text) {
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, введіть коректну назву бренду:');
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
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, надішліть назву моделі товару:');
        return;
      }
      session.data.title = text;
      await this.promptWizardDescription(chatId);
      return;
    }

    // 3. Description Input
    if (session.step === 'description') {
      if (text) {
        session.data.description = text;
      } else {
        const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
        session.data.description = `${fullTitle} — якісний ігровий девайс від MILIPSTORE.`;
      }
      await this.promptWizardSpecs(chatId);
      return;
    }

    // 4. Specs / Characteristics Input (up to 10 specs, format: Сенсор (Paw3395) or command /done)
    if (session.step === 'specs') {
      if (text === '/done' || text.toLowerCase() === 'готово' || text.toLowerCase() === 'далі' || text.toLowerCase() === 'stop') {
        if (!session.data.specs || session.data.specs.length === 0) {
          session.data.specs = this.getDefaultSpecs(session.data.category || 'мишки');
        }
        await this.promptWizardPrice(chatId);
        return;
      }

      if (!session.data.specs) session.data.specs = [];

      // Support multi-line input or single line input
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (session.data.specs.length >= 10) break;
        const parsed = this.parseSpecLine(line);
        if (parsed && parsed.key && parsed.value) {
          // Avoid duplicate keys
          const existingIdx = session.data.specs.findIndex(s => s.key.toLowerCase() === parsed.key.toLowerCase());
          if (existingIdx !== -1) {
            session.data.specs[existingIdx] = parsed;
          } else {
            session.data.specs.push(parsed);
          }
        }
      }

      // If reached 10 specs, automatically advance to price
      if (session.data.specs.length >= 10) {
        await this.promptWizardPrice(chatId);
      } else {
        await this.promptWizardSpecs(chatId);
      }
      return;
    }

    // 5. Price Input (Manual Only)
    if (session.step === 'price') {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(num) || num <= 0) {
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Вкажіть коректне число для ціни (наприклад: <code>1899</code>):', {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
          }
        });
        return;
      }
      session.data.price = num;
      await this.promptWizardCategory(chatId);
      return;
    }

    // 6. Custom Category Input
    if (session.step === 'custom_category') {
      if (!text) {
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, введіть назву категорії:');
        return;
      }
      session.data.category = text;
      db.addCategory(text);
      await this.promptWizardTag(chatId);
      return;
    }

    // 7. Tag / Badge Input
    if (session.step === 'tag') {
      session.data.tag = text ? text.trim() : '';
      await this.promptWizardColors(chatId);
      return;
    }

    // 8. Custom Color Input
    if (session.step === 'custom_color') {
      if (!text) {
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, введіть назву кольору:');
        return;
      }
      if (!session.data.colors) session.data.colors = [];
      if (!session.data.colors.includes(text)) {
        session.data.colors.push(text);
      }
      await this.promptWizardColors(chatId);
      return;
    }

    // 8. Main Catalog Photo Input (Only 1 Photo - Mandatory)
    if (session.step === 'catalog_photo') {
      let photoUrl = '';
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (/^https?:\/\/.+/i.test(text)) {
        photoUrl = text;
      }

      if (photoUrl) {
        session.data.img = photoUrl;
        session.data.currentColorIndex = 0;
        await this.promptWizardColorPhotos(chatId);
        return;
      }

      await this.safeEditOrSend(chatId, session.cardMsgId, `⚠️ <b>Головне фото є обов'язковим!</b>\n\nБудь ласка, надішліть файл зображення або пряме посилання на картинку:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]
          ]
        }
      });
      return;
    }

    // 9. Color Photos Input (Unlimited Photos per Color)
    if (session.step === 'color_photos') {
      let photoUrl = '';
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (/^https?:\/\/.+/i.test(text)) {
        photoUrl = text;
      }

      if (photoUrl) {
        const colors = session.data.colors || ['Black'];
        const curColor = colors[session.data.currentColorIndex] || 'Black';
        if (!session.data.color_images) session.data.color_images = {};
        if (!session.data.color_images[curColor]) {
          session.data.color_images[curColor] = { main: photoUrl, gallery: [photoUrl] };
        } else {
          if (!session.data.color_images[curColor].main) {
            session.data.color_images[curColor].main = photoUrl;
          }
          if (!session.data.color_images[curColor].gallery) {
            session.data.color_images[curColor].gallery = [];
          }
          if (!session.data.color_images[curColor].gallery.includes(photoUrl)) {
            session.data.color_images[curColor].gallery.push(photoUrl);
          }
        }

        await this.promptWizardColorPhotos(chatId);
        return;
      }

      await this.safeEditOrSend(chatId, session.cardMsgId, `⚠️ Будь ласка, завантажте фото або скористайтеся кнопками нижче:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➡️ Завершити фото', callback_data: 'wiz_color_done_photos' }],
            [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
          ]
        }
      });
      return;
    }

    // 10. Quantity Input
    if (session.step === 'color_quantities') {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(num) || num < 0) {
        await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, введіть число залишку (наприклад: <code>10</code>):');
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

    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Бренд:</b> ${session.data.brand}\n\n` +
      `<b>Крок 2/8: Введіть назву / модель товару:</b>\n\n` +
      `<i>Приклад: R1 Pro Max Wireless, F75 Tri-Mode Gasket, Mad Major 8K</i>\n\n` +
      `Надішліть назву наступним повідомленням у чат:`, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
      }
    });
  }

  async promptWizardDescription(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'description';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `<b>Крок 3/8: Введіть опис товару:</b>\n\n` +
      `Надішліть текст опису або натисніть «⏩ Пропустити» (буде згенеровано стандартний гарний опис):`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏩ Пропустити (Створити авто-опис)', callback_data: 'wiz_desc_skip' }],
          [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
        ]
      }
    });
  }

  async promptWizardSpecs(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'specs';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    const specs = session.data.specs || [];

    let specsListFormatted = '';
    if (specs.length > 0) {
      specsListFormatted = `\n📋 <b>Вже додані характеристики (${specs.length}/10):</b>\n` +
        specs.map((s, idx) => `  ${idx + 1}. <b>${s.key}:</b> ${s.value}`).join('\n') + `\n`;
    }

    const text = `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `<b>Крок 4/8: Характеристики та переваги товару (до 10 шт.):</b>\n\n` +
      `<i>Формат введення (кожна з нового рядка або по одній):</i>\n` +
      `<code>Сенсор (Paw3395)</code>\n` +
      `<code>Вага (49г)</code>\n` +
      `<code>Перемикачі (Huano Blue Shell Pink Dot)</code>\n` +
      `<code>Підключення (2.4G / Bluetooth / Type-C)</code>\n` +
      `${specsListFormatted}\n` +
      `<i>Надішліть характеристики текстом, команду <code>/done</code> або натисніть кнопку:</i>`;

    const buttons = [];
    if (specs.length > 0) {
      buttons.push([{ text: `✅ Зберегти характеристики (${specs.length}) та далі →`, callback_data: 'wiz_specs_done' }]);
      buttons.push([{ text: '🗑 Очистити характеристики', callback_data: 'wiz_specs_clear' }]);
    } else {
      buttons.push([{ text: '⏩ Встановити стандартні характеристики', callback_data: 'wiz_specs_skip' }]);
    }
    buttons.push([{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]);

    await this.safeEditOrSend(chatId, session.cardMsgId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async promptWizardPrice(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'price';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `<b>Крок 5/8: Вкажіть ціну товару (у гривнях):</b>\n\n` +
      `<i>Введіть число текстом (наприклад: <code>1499</code>):</i>`, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]]
      }
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
      [{ text: '➕ Ввести нову категорію', callback_data: 'wiz_cat:CUSTOM' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, `💰 <b>Ціна:</b> ${session.data.price} ₴\n\n` +
      `<b>Крок 6/9: Оберіть категорію товару:</b>\n` +
      `<i>Категорія одразу відобразиться у фільтрах вітрини магазину:</i>`, {
      reply_markup: { inline_keyboard: catButtons }
    });
  }

  async promptWizardTag(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'tag';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    const tagButtons = [
      [{ text: '🔥 Топ продажів', callback_data: 'wiz_tag:🔥 ТОП ПРОДАЖІВ' }, { text: '✨ Новинка', callback_data: 'wiz_tag:✨ НОВИНКА' }],
      [{ text: '⚡ Хіт', callback_data: 'wiz_tag:⚡ ХІТ' }, { text: '🏷 Знижка', callback_data: 'wiz_tag:🏷 ЗНИЖКА' }],
      [{ text: '👑 Флагман', callback_data: 'wiz_tag:👑 ФЛАГМАН' }, { text: '🎯 Рекомендуємо', callback_data: 'wiz_tag:🎯 РЕКОМЕНДУЄМО' }],
      [{ text: '⏩ Пропустити (Без бейджа)', callback_data: 'wiz_tag:SKIP' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `<b>Крок 7/9: Оберіть або введіть позначку / бейдж товару:</b>\n\n` +
      `<i>Оберіть популярний бейдж кнопкою або надішліть свій текст повідомленням у чат (або натисніть «⏩ Пропустити»):</i>`, {
      reply_markup: { inline_keyboard: tagButtons }
    });
  }

  async promptWizardColors(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'colors';

    const selected = session.data.colors || [];
    const colorPresets = [
      { id: 'White', name: '⚪ Білий' },
      { id: 'Black', name: '⚫ Чорний' },
      { id: 'Red', name: '🔴 Червоний' },
      { id: 'Blue', name: '🔵 Синій' },
      { id: 'Purple', name: '🟣 Фіолетовий' },
      { id: 'Green', name: '🟢 Зелений / М\'ятний' },
      { id: 'Pink', name: '💖 Рожевий' },
      { id: 'Grey', name: '🔘 Сірий / Графіт' }
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
      ? `➡️ Продовжити з обраними кольорами (${selected.length}) →`
      : `⏩ Пропустити (Один стандартний колір)`;

    keyboard.push([{ text: doneText, callback_data: selected.length > 0 ? 'wiz_colors_done' : 'wiz_colors_skip' }]);
    keyboard.push([{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]);

    const selectedText = selected.length > 0 ? selected.join(', ') : 'Поки не обрано (натисніть на кнопки кольорів)';

    await this.safeEditOrSend(chatId, session.cardMsgId, `🗂 <b>Категорія:</b> ${session.data.category}\n\n` +
      `<b>Крок 7/8: Оберіть кольори товару (однією плашкою з галочками):</b>\n\n` +
      `Обрані: <b>${selectedText}</b>\n\n` +
      `<i>Натискайте на кнопки потрібних кольорів, щоб увімкнути/вимкнути галочку [✅]:</i>`, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async promptWizardCatalogPhoto(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'catalog_photo';

    const buttons = [
      [{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, `📸 <b>Крок 8/8: Головне фото для каталогу (лише 1 фото)</b>\n\n` +
      `Надішліть <b>1 обов'язкове фото</b>, яке буде відображатися на вітрині товару:\n` +
      `<i>Надішліть файл зображення або пряме посилання на картинку в чат.</i>\n\n` +
      `⚠️ <i>Використання авто-фото або пропуск на цьому кроці вимкнено.</i>`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async promptWizardColorPhotos(chatId) {
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
    const uploadedCount = (session.data.color_images?.[curColor]?.gallery || []).length;

    const buttons = [];
    if (uploadedCount > 0) {
      buttons.push([{ text: `➡️ Зберегти фото для «${curColor}» (${uploadedCount} фото) та далі →`, callback_data: 'wiz_color_done_photos' }]);
    }
    buttons.push([{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]);

    const descText = `🎨 <b>Фотографії для кольору «${curColor}» (${colorIndexHuman}/${colors.length})</b>\n\n` +
      `Надішліть фотографії для кольору <b>${curColor}</b>:\n` +
      `• <b>1-ше фото</b> автоматично стане <b>головним для кольору «${curColor}»</b>.\n` +
      `• <b>Усі наступні фото</b> будуть додані до галереї цього кольору (необмежено).\n\n` +
      `📷 <i>Завантажено для «${curColor}»: <b>${uploadedCount} фото</b>${uploadedCount > 0 ? ' (1 головне + ' + (uploadedCount - 1) + ' додаткових)' : ''}</i>\n\n` +
      (uploadedCount === 0 ? `⚠️ <b>Фото для цього кольору є обов'язковим!</b> Надішліть файл або URL.` : `<i>Надішліть ще фото або натисніть «Зберегти фото та далі →»:</i>`);

    await this.safeEditOrSend(chatId, session.cardMsgId, descText, {
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
      [{ text: '⏩ Пропустити (встановити 0 шт.)', callback_data: 'wiz_qty_skip' }],
      [{ text: '❌ Скасувати', callback_data: 'wiz_cancel' }]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, `📦 <b>Склад (${qtyIndexHuman}/${colors.length}): Кількість для кольору «${curColor}»</b>\n\n` +
      `Надішліть кількість одиниць на складі для кольору <b>${curColor}</b> числом текстом у чат (наприклад: <code>15</code>)\n` +
      `або натисніть кнопку «⏩ Пропустити» (буде встановлено 0 шт.):`, {
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
      const photoCount = (d.color_images?.[c]?.gallery || []).length || (d.color_images?.[c]?.main ? 1 : 0);
      const photoInfo = photoCount > 0 ? `📷 ${photoCount} фото` : '⚙️ Авто-фото';
      colorSummary += `  • <b>${c}</b>: ${q} шт. (${photoInfo})\n`;
    });

    let specsSummary = '';
    if (d.specs && d.specs.length > 0) {
      specsSummary = `\n📋 <b>Характеристики (${d.specs.length}):</b>\n` +
        d.specs.map(s => `  • <b>${s.key}:</b> ${s.value}`).join('\n') + `\n`;
    }

    const text = `✨ <b>ПЕРЕВІРКА НОВОГО ТОВАРУ</b> ✨\n\n` +
      `🏷 <b>Бренд:</b> ${d.brand}\n` +
      `🎮 <b>Назва:</b> <b>${d.title}</b>\n` +
      `💰 <b>Ціна:</b> <b>${d.price} ₴</b> (стара ціна: ${Math.round(d.price * 1.15)} ₴)\n` +
      `🗂 <b>Категорія:</b> ${d.category}\n` +
      `🏷 <b>Позначка / Бейдж:</b> <b>${d.tag || 'Без бейджа'}</b>\n` +
      `📝 <b>Опис:</b> <i>${(d.description || '').slice(0, 100)}${(d.description || '').length > 100 ? '...' : ''}</i>\n` +
      `${specsSummary}` +
      `🎨 <b>Варіанти кольорів, фото та склад:</b>\n${colorSummary}\n` +
      `📦 <b>Загальний залишок:</b> <b>${totalQty} шт.</b>\n\n` +
      `<i>Після підтвердження товар миттєво з'явиться на сайті MILIPSTORE та у Telegram-боті!</i>`;

    const buttons = [
      [{ text: '🚀 ✅ Опублікувати на сайті та в боті', callback_data: 'wiz_save_publish' }],
      [{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async saveWizardProduct(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    const d = session.data;
    const cardId = session.cardMsgId;
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

    // Build deduplicated color images structure
    const color_images = {};
    const defaultImg = this.getDefaultProductImage(brand, category);

    colors.forEach(c => {
      const cData = d.color_images?.[c];
      if (cData && cData.main) {
        const rawGallery = Array.isArray(cData.gallery) && cData.gallery.length > 0 ? cData.gallery : [cData.main];
        const cleanGallery = Array.from(new Set([cData.main, ...rawGallery])).filter(Boolean);
        color_images[c] = {
          main: cData.main,
          gallery: cleanGallery
        };
      } else {
        const cImg = this.getDefaultColorImage(c, brand, category);
        color_images[c] = {
          main: cImg,
          gallery: [cImg]
        };
      }
    });

    // Main catalog photo
    const mainCatalogImg = d.img || color_images[colors[0]]?.main || defaultImg;

    // Overall product gallery
    const allGalleryPhotos = [mainCatalogImg];
    colors.forEach(c => {
      if (color_images[c]?.main) allGalleryPhotos.push(color_images[c].main);
      if (Array.isArray(color_images[c]?.gallery)) {
        allGalleryPhotos.push(...color_images[c].gallery);
      }
    });
    const finalProductGallery = Array.from(new Set(allGalleryPhotos)).filter(Boolean);

    const fullTitle = `${brand} ${title}`;
    const slugId = `prod-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    const newProduct = {
      id: slugId,
      brand,
      title: fullTitle,
      price,
      old_price: Math.round(price * 1.15),
      tag: d.tag !== undefined ? d.tag : 'НОВИНКА',
      category,
      quantity: totalQuantity,
      colors: colors.join(', '),
      description: d.description || `${fullTitle} — якісний ігровий девайс з офіційною гарантією від MILIPSTORE.`,
      img: mainCatalogImg,
      gallery: finalProductGallery.length ? finalProductGallery : [mainCatalogImg],
      specs: d.specs && d.specs.length > 0 ? d.specs : this.getDefaultSpecs(category),
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

    await this.safeEditOrSend(chatId, cardId, `🎉 <b>Товар успішно створено та опубліковано!</b>\n\n` +
      `🏷 <b>${newProduct.title}</b>\n` +
      `💰 Ціна: <b>${newProduct.price} ₴</b>\n` +
      `🗂 Категорія: <b>${newProduct.category}</b>\n` +
      `📦 Залишок: <b>${newProduct.quantity} шт.</b> (${colors.join(', ')})\n` +
      `🆔 Артикул: <code>${newProduct.sku}</code>\n\n` +
      `Товар уже доступний у каталозі магазину та готовий до замовлень!`, {
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

  // ----------------------------------------------------
  // Admin Catalog Management & Detailed Product Editing
  // ----------------------------------------------------
  async sendAdminCatalog(chatId, page = 0, messageId = null) {
    const products = db.getProducts();
    const pageSize = 6;
    const totalPages = Math.ceil(products.length / pageSize) || 1;
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));

    const startIdx = currentPage * pageSize;
    const pageProducts = products.slice(startIdx, startIdx + pageSize);

    let text = `📦 <b>КАТАЛОГ ТОВАРІВ MILIPSTORE (${products.length} шт.)</b>\n\n`;
    text += `<i>Сторінка ${currentPage + 1} з ${totalPages}</i>\n`;
    text += `<i>Оберіть товар нижче, щоб переглянути деталі, редагувати бренд, назву, опис, ціну, кольори, характеристики або фото:</i>\n\n`;

    const buttons = [];

    pageProducts.forEach(p => {
      const colorCount = (p.colors || '').split(',').filter(Boolean).length || 1;
      const specCount = (p.specs || []).length;
      text += `🏷 <b>${p.brand} ${p.title}</b>\n`;
      text += `• Ціна: <b>${p.price} ₴</b> | Залишок: <b>${p.quantity} шт.</b> | Кольорів: ${colorCount} | Хар-к: ${specCount}\n\n`;

      buttons.push([
        { text: `✏️ ${p.brand} ${p.title} (${p.price} ₴)`, callback_data: `admin_prod_view:${p.id}` }
      ]);
    });

    // Pagination row
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({ text: '⬅️ Попередня', callback_data: `admin_catalog_page:${currentPage - 1}` });
    }
    navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: `admin_catalog_page:${currentPage}` });
    if (currentPage < totalPages - 1) {
      navRow.push({ text: 'Наступна ➡️', callback_data: `admin_catalog_page:${currentPage + 1}` });
    }
    buttons.push(navRow);

    // Actions
    buttons.push([
      { text: '➕ Додати новий товар', callback_data: 'add_new_product' },
      { text: '👑 Адмін-панель', callback_data: 'admin_dashboard' }
    ]);

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminProductView(chatId, prodId, messageId = null) {
    const prod = db.getProductById(prodId);
    if (!prod) {
      await this.safeEditOrSend(chatId, messageId, `❌ Товар не знайдено в базі даних.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 До списку товарів', callback_data: 'admin_catalog' }],
            [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
          ]
        }
      });
      return;
    }

    const colorsList = (prod.colors || 'Black').split(',').map(s => s.trim()).filter(Boolean);
    const specsList = prod.specs || [];

    let specsFormatted = '<i>Не вказано</i>';
    if (specsList.length > 0) {
      specsFormatted = specsList.map((s, idx) => `  ${idx + 1}. <b>${s.key}:</b> ${s.value}`).join('\n');
    }

    let colorsFormatted = '';
    colorsList.forEach(c => {
      const q = prod.color_quantities?.[c] ?? Math.round(prod.quantity / (colorsList.length || 1));
      const photos = prod.color_images?.[c]?.gallery?.length || (prod.color_images?.[c]?.main ? 1 : 0);
      colorsFormatted += `  • <b>${c}</b>: ${q} шт. (📷 ${photos} фото)\n`;
    });

    let text = `🎮 <b>КЕРУВАННЯ ТОВАРОМ</b>\n\n`;
    text += `🏷 <b>1. Бренд:</b> <b>${prod.brand || '—'}</b>\n`;
    text += `🎮 <b>2. Назва / модель:</b> <b>${prod.title || '—'}</b>\n`;
    text += `📝 <b>3. Опис:</b> <i>${(prod.description || '').slice(0, 120)}${(prod.description || '').length > 120 ? '...' : ''}</i>\n`;
    text += `💰 <b>4. Ціна:</b> <b>${prod.price} ₴</b> (стара: ${prod.old_price || Math.round(prod.price * 1.15)} ₴)\n`;
    text += `🗂 <b>Категорія:</b> <b>${prod.category || '—'}</b> | Артикул: <code>${prod.sku || '—'}</code>\n`;
    text += `🏷 <b>Позначка / Бейдж:</b> <b>${prod.tag || 'Без бейджа'}</b>\n\n`;
    text += `🎨 <b>5. Кольори та склад (${colorsList.length}):</b>\n${colorsFormatted || '  • Black'}\n`;
    text += `📦 <b>Загальний залишок:</b> <b>${prod.quantity} шт.</b>\n\n`;
    text += `📋 <b>6. Характеристики (${specsList.length}/10):</b>\n${specsFormatted}\n\n`;
    text += `📸 <b>7. Головне фото каталогу:</b> ${prod.img ? '✅ Встановлено (1 фото)' : '⚙️ Стандартне'}\n`;
    text += `🖼 <b>8. Фото кольорів:</b> Налаштовано окремо для кожного кольору\n\n`;
    text += `<i>Натисніть на параметр нижче, щоб швидко відредагувати його:</i>`;

    const buttons = [
      [
        { text: '🏷 1. Бренд', callback_data: `edit_prod_field:${prod.id}:brand` },
        { text: '🎮 2. Назва / модель', callback_data: `edit_prod_field:${prod.id}:title` }
      ],
      [
        { text: '📝 3. Опис', callback_data: `edit_prod_field:${prod.id}:description` },
        { text: '💰 4. Ціна', callback_data: `edit_prod_field:${prod.id}:price` }
      ],
      [
        { text: '🎨 5. Кольори', callback_data: `edit_prod_field:${prod.id}:colors` },
        { text: '📋 6. Характеристики', callback_data: `edit_prod_field:${prod.id}:specs` }
      ],
      [
        { text: '📸 7. Головне фото', callback_data: `edit_prod_field:${prod.id}:main_photo` },
        { text: '🖼 8. Фото кольорів', callback_data: `edit_prod_field:${prod.id}:color_photos` }
      ],
      [
        { text: '🏷 9. Позначка / Бейдж', callback_data: `edit_prod_field:${prod.id}:tag` }
      ],
      [
        { text: '🗑 Видалити товар з каталогу', callback_data: `admin_delete_prod_prompt:${prod.id}` }
      ],
      [
        { text: '📦 До каталогу', callback_data: 'admin_catalog' },
        { text: '👑 Адмін-панель', callback_data: 'admin_dashboard' }
      ]
    ];

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async startEditProductField(chatId, prodId, field, messageId = null) {
    const prod = db.getProductById(prodId);
    if (!prod) return;

    this.adminSessions[chatId] = {
      action: 'edit_product_field',
      prodId,
      field,
      cardMsgId: messageId,
      data: {
        tempColors: (prod.colors || 'Black').split(',').map(s => s.trim()).filter(Boolean),
        tempSpecs: prod.specs ? JSON.parse(JSON.stringify(prod.specs)) : [],
        activeColorForPhotos: null
      }
    };

    const cardId = messageId;

    // 1. BRAND
    if (field === 'brand') {
      const brandButtons = [
        [{ text: '🦈 Attack Shark', callback_data: `edit_prod_cb:${prodId}:brand:Attack Shark` }, { text: '⚡ AULA', callback_data: `edit_prod_cb:${prodId}:brand:AULA` }],
        [{ text: '🚀 VXE / VGN', callback_data: `edit_prod_cb:${prodId}:brand:VXE` }, { text: '🎮 Ajazz', callback_data: `edit_prod_cb:${prodId}:brand:Ajazz` }],
        [{ text: '⚡ Darmoshark', callback_data: `edit_prod_cb:${prodId}:brand:Darmoshark` }, { text: '💎 Mchose', callback_data: `edit_prod_cb:${prodId}:brand:Mchose` }],
        [{ text: '🔙 Назад до товару', callback_data: `admin_prod_view:${prodId}` }]
      ];

      await this.safeEditOrSend(chatId, cardId, `🏷 <b>Редагування бренду для товару:</b>\n` +
        `Поточний бренд: <b>${prod.brand}</b>\n\n` +
        `<i>Оберіть бренд кнопкою або надішліть назву текстом у чат:</i>`, {
        reply_markup: { inline_keyboard: brandButtons }
      });
      return;
    }

    // 2. TITLE
    if (field === 'title') {
      await this.safeEditOrSend(chatId, cardId, `🎮 <b>Редагування назви / моделі товару:</b>\n` +
        `Поточна назва: <b>${prod.title}</b>\n\n` +
        `<i>Надішліть нову назву товару наступним повідомленням у чат:</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
          ]
        }
      });
      return;
    }

    // 3. DESCRIPTION
    if (field === 'description') {
      await this.safeEditOrSend(chatId, cardId, `📝 <b>Редагування опису товару:</b>\n\n` +
        `Поточний опис:\n<i>${prod.description || 'Не вказано'}</i>\n\n` +
        `<i>Надішліть новий опис текстом або натисніть кнопку авто-генерації:</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✨ Згенерувати стандартний опис', callback_data: `edit_prod_cb:${prodId}:desc_auto` }],
            [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
          ]
        }
      });
      return;
    }

    // 4. PRICE
    if (field === 'price') {
      await this.safeEditOrSend(chatId, cardId, `💰 <b>Редагування ціни товару:</b>\n` +
        `Поточна ціна: <b>${prod.price} ₴</b>\n\n` +
        `<i>Введіть нову ціну (лише число, наприклад: <code>1899</code>):</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
          ]
        }
      });
      return;
    }

    // 5. COLORS
    if (field === 'colors') {
      await this.renderEditColorsPlate(chatId, prodId, cardId);
      return;
    }

    // 6. SPECS
    if (field === 'specs') {
      await this.renderEditSpecsPlate(chatId, prodId, cardId);
      return;
    }

    // 7. MAIN PHOTO
    if (field === 'main_photo') {
      await this.safeEditOrSend(chatId, cardId, `📸 <b>Головне фото для каталогу (1 фото):</b>\n\n` +
        `Поточне фото: <code>${prod.img || 'немає'}</code>\n\n` +
        `<i>Надішліть нове фото файлом зображення або прямим посиланням на картинку в цей чат:</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
          ]
        }
      });
      return;
    }

    // 8. COLOR PHOTOS
    if (field === 'color_photos') {
      await this.renderEditColorPhotosMenu(chatId, prodId, cardId);
      return;
    }

    // 9. TAG / BADGE
    if (field === 'tag') {
      const tagButtons = [
        [{ text: '🔥 Топ продажів', callback_data: `edit_prod_cb:${prodId}:tag:🔥 ТОП ПРОДАЖІВ` }, { text: '✨ Новинка', callback_data: `edit_prod_cb:${prodId}:tag:✨ НОВИНКА` }],
        [{ text: '⚡ Хіт', callback_data: `edit_prod_cb:${prodId}:tag:⚡ ХІТ` }, { text: '🏷 Знижка', callback_data: `edit_prod_cb:${prodId}:tag:🏷 ЗНИЖКА` }],
        [{ text: '👑 Флагман', callback_data: `edit_prod_cb:${prodId}:tag:👑 ФЛАГМАН` }, { text: '🎯 Рекомендуємо', callback_data: `edit_prod_cb:${prodId}:tag:🎯 РЕКОМЕНДУЄМО` }],
        [{ text: '❌ Прибрати позначку (без бейджа)', callback_data: `edit_prod_cb:${prodId}:tag:CLEAR` }],
        [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
      ];

      await this.safeEditOrSend(chatId, cardId, `🏷 <b>Редагування позначки / бейджа товару:</b>\n` +
        `Поточний бейдж: <b>${prod.tag || 'Не встановлено'}</b>\n\n` +
        `<i>Оберіть позначку кнопкою або надішліть свій текст повідомленням у чат:</i>`, {
        reply_markup: { inline_keyboard: tagButtons }
      });
      return;
    }
  }

  async renderEditColorsPlate(chatId, prodId, messageId) {
    const session = this.adminSessions[chatId];
    const selected = session?.data?.tempColors || ['Black'];

    const colorPresets = [
      { id: 'White', name: '⚪ Білий' },
      { id: 'Black', name: '⚫ Чорний' },
      { id: 'Red', name: '🔴 Червоний' },
      { id: 'Blue', name: '🔵 Синій' },
      { id: 'Purple', name: '🟣 Фіолетовий' },
      { id: 'Green', name: '🟢 Зелений / М\'ятний' },
      { id: 'Pink', name: '💖 Рожевий' },
      { id: 'Grey', name: '🔘 Сірий / Графіт' }
    ];

    const keyboard = [];
    for (let i = 0; i < colorPresets.length; i += 2) {
      const row = [];
      const c1 = colorPresets[i];
      const isC1 = selected.includes(c1.id);
      row.push({
        text: isC1 ? `✅ ${c1.name}` : c1.name,
        callback_data: `edit_prod_cb:${prodId}:color_toggle:${c1.id}`
      });

      if (i + 1 < colorPresets.length) {
        const c2 = colorPresets[i + 1];
        const isC2 = selected.includes(c2.id);
        row.push({
          text: isC2 ? `✅ ${c2.name}` : c2.name,
          callback_data: `edit_prod_cb:${prodId}:color_toggle:${c2.id}`
        });
      }
      keyboard.push(row);
    }

    keyboard.push([{ text: '➕ Ввести свій колір текстом', callback_data: `edit_prod_cb:${prodId}:color_custom_prompt` }]);
    keyboard.push([{ text: `💾 ✅ Зберегти кольори (${selected.length})`, callback_data: `edit_prod_cb:${prodId}:colors_save` }]);
    keyboard.push([{ text: '🔙 Скасувати зміни', callback_data: `admin_prod_view:${prodId}` }]);

    const text = `🎨 <b>Редагування кольорів товару (одна плашка з галочками):</b>\n\n` +
      `Обрані кольори: <b>${selected.join(', ') || 'не обрано'}</b>\n\n` +
      `<i>Натискайте кнопки кольорів, щоб увімкнути/вимкнути [✅], після чого натисніть «💾 Зберегти кольори»:</i>`;

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async renderEditSpecsPlate(chatId, prodId, messageId) {
    const session = this.adminSessions[chatId];
    const specs = session?.data?.tempSpecs || [];

    let specsListFormatted = '<i>Поки що список порожній</i>\n';
    if (specs.length > 0) {
      specsListFormatted = specs.map((s, idx) => `  ${idx + 1}. <b>${s.key}:</b> ${s.value}`).join('\n') + '\n';
    }

    const text = `📋 <b>Редагування характеристик товару (${specs.length}/10):</b>\n\n` +
      `${specsListFormatted}\n` +
      `<i>Формат введення нових характеристик (надішліть текстом у чат):</i>\n` +
      `<code>Сенсор (Paw3395)</code>\n` +
      `<code>Вага (49г)</code>\n` +
      `<code>Перемикачі (Huano Blue Shell Pink Dot)</code>\n\n` +
      `<i>Можна надіслати одразу кілька з нового рядка. Для збереження натисніть кнопку:</i>`;

    const buttons = [
      [{ text: `💾 ✅ Зберегти характеристики (${specs.length})`, callback_data: `edit_prod_cb:${prodId}:specs_save` }],
      [{ text: '🗑 Очистити характеристики', callback_data: `edit_prod_cb:${prodId}:specs_clear` }],
      [{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]
    ];

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async renderEditColorPhotosMenu(chatId, prodId, messageId) {
    const prod = db.getProductById(prodId);
    if (!prod) return;

    const colors = (prod.colors || 'Black').split(',').map(s => s.trim()).filter(Boolean);
    const buttons = [];

    colors.forEach(c => {
      const count = prod.color_images?.[c]?.gallery?.length || (prod.color_images?.[c]?.main ? 1 : 0);
      buttons.push([
        { text: `🎨 ${c} (📷 ${count} фото) →`, callback_data: `edit_prod_cb:${prodId}:color_photo_select:${c}` }
      ]);
    });

    buttons.push([{ text: '🔙 Назад до товару', callback_data: `admin_prod_view:${prodId}` }]);

    const text = `🖼 <b>Фотографії для окремих кольорів:</b>\n\n` +
      `Оберіть колір товару нижче, щоб додати, переглянути або оновити фотографії для нього:\n\n` +
      `• <b>1-ше фото</b> автоматично стає головним фото цього кольору.\n` +
      `• <b>Всі наступні</b> — додаються до галереї цього кольору.`;

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async handleEditProductFieldCallback(chatId, from, data, messageId = null) {
    const session = this.adminSessions[chatId];
    const parts = data.split(':');
    const prodId = parts[1];
    const action = parts[2];
    const param = parts[3];

    const prod = db.getProductById(prodId);
    if (!prod) return;

    // 1. Brand preset chosen
    if (action === 'brand') {
      const newBrand = param;
      prod.brand = newBrand;
      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    // 3. Description auto
    if (action === 'desc_auto') {
      prod.description = `${prod.brand} ${prod.title} — якісний ігровий девайс з офіційною гарантією від MILIPSTORE.`;
      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    // 5. Colors plate toggle
    if (action === 'color_toggle') {
      const col = param;
      if (!session.data.tempColors) session.data.tempColors = [];
      const idx = session.data.tempColors.indexOf(col);
      if (idx !== -1) {
        session.data.tempColors.splice(idx, 1);
      } else {
        session.data.tempColors.push(col);
      }
      await this.renderEditColorsPlate(chatId, prodId, messageId);
      return;
    }

    if (action === 'color_custom_prompt') {
      session.customColorPrompt = true;
      await this.safeEditOrSend(chatId, messageId, `🎨 <b>Введіть назву нового кольору текстом у чат:</b>\n\n<i>Наприклад: Gradient Purple, Matt White, Cyberpunk:</i>`, {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Назад до кольорів', callback_data: `edit_prod_cb:${prodId}:color_cancel_custom` }]]
        }
      });
      return;
    }

    if (action === 'color_cancel_custom') {
      session.customColorPrompt = false;
      await this.renderEditColorsPlate(chatId, prodId, messageId);
      return;
    }

    if (action === 'colors_save') {
      const newColors = (session.data.tempColors && session.data.tempColors.length > 0) ? session.data.tempColors : ['Black'];
      prod.colors = newColors.join(', ');
      
      // Clean up removed colors from color_images
      if (!prod.color_images) prod.color_images = {};
      Object.keys(prod.color_images).forEach(c => {
        if (!newColors.includes(c)) {
          delete prod.color_images[c];
        }
      });

      // Ensure missing color images exist
      newColors.forEach(c => {
        if (!prod.color_images[c]) {
          const autoImg = this.getDefaultColorImage(c, prod.brand, prod.category);
          prod.color_images[c] = { main: autoImg, gallery: [autoImg] };
        }
      });

      // Clean up removed colors from color_quantities
      if (!prod.color_quantities) prod.color_quantities = {};
      Object.keys(prod.color_quantities).forEach(c => {
        if (!newColors.includes(c)) {
          delete prod.color_quantities[c];
        }
      });

      // Ensure missing color quantities exist
      const perColorQty = Math.max(1, Math.round((prod.quantity || 10) / newColors.length));
      newColors.forEach(c => {
        if (prod.color_quantities[c] === undefined) {
          prod.color_quantities[c] = perColorQty;
        }
      });

      // Recalculate total quantity from remaining colors
      prod.quantity = Object.values(prod.color_quantities).reduce((sum, q) => sum + Number(q || 0), 0);

      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    // 9. Tag preset chosen
    if (action === 'tag') {
      prod.tag = (param === 'CLEAR' || param === 'SKIP') ? '' : param;
      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    // 6. Specs actions
    if (action === 'specs_save') {
      prod.specs = session.data.tempSpecs || [];
      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    if (action === 'specs_clear') {
      session.data.tempSpecs = [];
      await this.renderEditSpecsPlate(chatId, prodId, messageId);
      return;
    }

    // 7. Main Photo Auto
    if (action === 'main_photo_auto') {
      const autoImg = this.getDefaultProductImage(prod.brand, prod.category);
      prod.img = autoImg;
      if (!prod.gallery) prod.gallery = [];
      if (!prod.gallery.includes(autoImg)) prod.gallery.unshift(autoImg);
      db.save();
      delete this.adminSessions[chatId];
      await this.sendAdminProductView(chatId, prodId, messageId);
      return;
    }

    // 8. Color Photos Selection
    if (action === 'color_photo_select') {
      const colorName = param;
      session.data.activeColorForPhotos = colorName;

      const curCount = prod.color_images?.[colorName]?.gallery?.length || (prod.color_images?.[colorName]?.main ? 1 : 0);

      const buttons = [
        [{ text: '🖼 Встановити авто-фото для кольору', callback_data: `edit_prod_cb:${prodId}:color_photo_auto:${colorName}` }],
        [{ text: '🗑 Очистити фото цього кольору', callback_data: `edit_prod_cb:${prodId}:color_photo_clear:${colorName}` }],
        [{ text: '🔙 Назад до списку кольорів', callback_data: `edit_prod_cb:${prodId}:color_photos_back` }]
      ];

      const text = `🎨 <b>Фотографії для кольору «${colorName}»</b>\n\n` +
        `📷 Завантажено: <b>${curCount} фото</b>\n\n` +
        `<i>Надсилайте нові фото файлом або посиланням у цей чат:</i>\n` +
        `• 1-ше фото — головне фото кольору.\n` +
        `• Наступні — галерея кольору.\n\n` +
        `Після додавання поверніться назад:`;

      await this.safeEditOrSend(chatId, messageId, text, {
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    if (action === 'color_photo_auto') {
      const colorName = param;
      const autoImg = this.getDefaultColorImage(colorName, prod.brand, prod.category);
      if (!prod.color_images) prod.color_images = {};
      prod.color_images[colorName] = { main: autoImg, gallery: [autoImg] };
      db.save();
      await this.handleEditProductFieldCallback(chatId, from, `edit_prod_cb:${prodId}:color_photo_select:${colorName}`, messageId);
      return;
    }

    if (action === 'color_photo_clear') {
      const colorName = param;
      if (prod.color_images && prod.color_images[colorName]) {
        delete prod.color_images[colorName];
        db.save();
      }
      await this.handleEditProductFieldCallback(chatId, from, `edit_prod_cb:${prodId}:color_photo_select:${colorName}`, messageId);
      return;
    }

    if (action === 'color_photos_back') {
      session.data.activeColorForPhotos = null;
      await this.renderEditColorPhotosMenu(chatId, prodId, messageId);
      return;
    }
  }

  async handleEditProductFieldMessage(chatId, from, msg) {
    const session = this.adminSessions[chatId];
    if (!session || session.action !== 'edit_product_field') return;

    const prodId = session.prodId;
    const field = session.field;
    const cardId = session.cardMsgId;
    const text = (msg.text || '').trim();

    // Clean user message immediately
    if (msg.message_id) {
      await this.safeDeleteMessage(chatId, msg.message_id);
    }

    const prod = db.getProductById(prodId);
    if (!prod) return;

    // 1. BRAND
    if (field === 'brand') {
      if (text) {
        prod.brand = text;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }

    // 2. TITLE
    if (field === 'title') {
      if (text) {
        prod.title = text;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }

    // 3. DESCRIPTION
    if (field === 'description') {
      if (text) {
        prod.description = text;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }

    // 4. PRICE
    if (field === 'price') {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        prod.price = num;
        prod.old_price = Math.round(num * 1.15);
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      } else {
        await this.safeEditOrSend(chatId, cardId, `⚠️ Введіть коректну ціну числом (наприклад: <code>1899</code>):`);
      }
      return;
    }

    // 5. COLORS - Custom text input
    if (field === 'colors' && session.customColorPrompt) {
      if (text) {
        if (!session.data.tempColors) session.data.tempColors = [];
        if (!session.data.tempColors.includes(text)) {
          session.data.tempColors.push(text);
        }
        session.customColorPrompt = false;
        await this.renderEditColorsPlate(chatId, prodId, cardId);
      }
      return;
    }

    // 6. SPECS - Text input format: Key (Value)
    if (field === 'specs') {
      if (text === '/done' || text.toLowerCase() === 'готово' || text.toLowerCase() === 'зберегти') {
        prod.specs = session.data.tempSpecs || [];
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
        return;
      }

      if (!session.data.tempSpecs) session.data.tempSpecs = [];

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (session.data.tempSpecs.length >= 10) break;
        const parsed = this.parseSpecLine(line);
        if (parsed && parsed.key && parsed.value) {
          const existingIdx = session.data.tempSpecs.findIndex(s => s.key.toLowerCase() === parsed.key.toLowerCase());
          if (existingIdx !== -1) {
            session.data.tempSpecs[existingIdx] = parsed;
          } else {
            session.data.tempSpecs.push(parsed);
          }
        }
      }

      await this.renderEditSpecsPlate(chatId, prodId, cardId);
      return;
    }

    // 7. MAIN PHOTO - Single photo upload or URL
    if (field === 'main_photo') {
      let photoUrl = '';
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (/^https?:\/\/.+/i.test(text)) {
        photoUrl = text;
      }

      if (photoUrl) {
        prod.img = photoUrl;
        if (!prod.gallery) prod.gallery = [];
        if (!prod.gallery.includes(photoUrl)) prod.gallery.unshift(photoUrl);
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }

    // 8. COLOR PHOTOS - Unlimited photo upload for specific color
    if (field === 'color_photos' && session.data.activeColorForPhotos) {
      const colorName = session.data.activeColorForPhotos;
      let photoUrl = '';
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (/^https?:\/\/.+/i.test(text)) {
        photoUrl = text;
      }

      if (photoUrl) {
        if (!prod.color_images) prod.color_images = {};
        if (!prod.color_images[colorName]) {
          prod.color_images[colorName] = { main: photoUrl, gallery: [photoUrl] };
        } else {
          if (!prod.color_images[colorName].main) prod.color_images[colorName].main = photoUrl;
          if (!prod.color_images[colorName].gallery) prod.color_images[colorName].gallery = [];
          if (!prod.color_images[colorName].gallery.includes(photoUrl)) {
            prod.color_images[colorName].gallery.push(photoUrl);
          }
        }
        db.save();
        await this.handleEditProductFieldCallback(chatId, from, `edit_prod_cb:${prodId}:color_photo_select:${colorName}`, cardId);
      }
      return;
    }

    // 9. TAG / BADGE
    if (field === 'tag') {
      if (text) {
        prod.tag = text.trim();
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }
  }

  // ----------------------------------------------------
  // Admin Inbox & Notifications Log
  // ----------------------------------------------------
  async sendAdminInbox(chatId, messageId = null) {
    const notifs = db.getNotifications() || [];

    let text = `📥 <b>ВХІДНІ ПОВІДОМЛЕННЯ ТА ЖУРНАЛ ПОДІЙ (${notifs.length})</b>\n\n`;

    if (notifs.length === 0) {
      text += `<i>Журнал сповіщень порожній. Тут автоматично фіксуються нові замовлення, оплати та зміни статусів.</i>`;
    } else {
      notifs.slice(0, 10).forEach((n, idx) => {
        const time = new Date(n.timestamp || Date.now()).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        let icon = '🔔';
        let desc = '';
        if (n.type === 'ORDER_CREATED') {
          icon = '🆕';
          desc = `Нове замовлення #${n.order_id} (${n.total} ₴) від ${n.customer || 'клієнта'}`;
        } else if (n.type === 'PAYMENT_SUCCESS') {
          icon = '💳';
          desc = `Оплата замовлення #${n.order_id} (${n.total} ₴) успішна!`;
        } else if (n.type === 'STATUS_CHANGED') {
          icon = '📦';
          desc = `Статус замовлення #${n.order_id} змінено на «${n.status_name || n.status}»`;
        } else {
          desc = n.message || n.text || JSON.stringify(n);
        }

        text += `${idx + 1}. ${icon} <b>[${time}]</b> ${desc}\n`;
      });
    }

    const buttons = [];
    if (notifs.length > 0) {
      buttons.push([{ text: '🗑 Очистити журнал сповіщень', callback_data: 'admin_inbox_clear' }]);
    }
    buttons.push([
      { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
    ]);

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
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
