import fs from 'fs';
import path from 'path';
import { db, ORDER_STATUSES } from './db.js';

process.env.TZ = 'Europe/Kyiv';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const ADMIN_IDS = (process.env.ADMIN_IDS || '1929165295,1248134309,invinciblee,wincher,Invinciblee,Wincher').split(',').map(s => s.trim()).filter(Boolean);
export const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export function getStoreWebUrl() {
  // Never use internal Google Cloud Run / AI Studio preview URLs for Telegram Web App,
  // as they require Google account authentication and cause 403 error.
  if (process.env.PUBLIC_APP_URL && !process.env.PUBLIC_APP_URL.includes('run.app') && !process.env.PUBLIC_APP_URL.includes('localhost')) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL && !process.env.APP_URL.includes('run.app') && !process.env.APP_URL.includes('localhost')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  // Default to public GitHub Pages repository hosting - never triggers Google OAuth login
  return 'https://wincher1202.github.io/M1lipStore-/';
}

export function getPublicAssetBaseUrl() {
  if (process.env.PUBLIC_API_URL && !process.env.PUBLIC_API_URL.includes('run.app') && !process.env.PUBLIC_API_URL.includes('localhost')) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL && !process.env.APP_URL.includes('run.app') && !process.env.APP_URL.includes('localhost')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return 'https://m1lipstore.onrender.com';
}

export function formatKyivDateTime(dateInput) {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('uk-UA', {
      timeZone: 'Europe/Kyiv',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return new Date(dateInput).toLocaleString('uk-UA');
  }
}

export function formatKyivTime(dateInput = new Date()) {
  try {
    const d = new Date(dateInput);
    return d.toLocaleTimeString('uk-UA', {
      timeZone: 'Europe/Kyiv',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return new Date().toLocaleTimeString('uk-UA');
  }
}

export function getKyivGreeting() {
  try {
    const formatter = new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv',
      hour: 'numeric',
      hour12: false
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    if (hour >= 5 && hour < 12) {
      return 'Добрий ранок! 👋';
    } else if (hour >= 12 && hour < 18) {
      return 'Добрий день! 👋';
    } else {
      return 'Добрий вечір! 👋';
    }
  } catch (e) {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const kyivHour = (utcHour + 3) % 24;
    if (kyivHour >= 5 && kyivHour < 12) return 'Добрий ранок! 👋';
    if (kyivHour >= 12 && kyivHour < 18) return 'Добрий день! 👋';
    return 'Добрий вечір! 👋';
  }
}

export function buildCustomerManagerMessage(order) {
  if (!order) {
    const greeting = getKyivGreeting();
    return `${greeting}\n\nХочу уточнити деталі щодо замовлення. Дякую! 😊`;
  }

  const greeting = getKyivGreeting();
  const rawId = String(order.order_id || order.id || '').trim();
  const cleanId = rawId.replace(/^#/, '');
  const orderNum = cleanId ? `#${cleanId}` : '#Замовлення';

  const customer = order.customer || {};
  const delivery = order.delivery || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number(order.total || 0);

  let msg = `${greeting}\n\n`;
  msg += `Хочу уточнити деталі щодо замовлення **${orderNum}**.\n\n`;

  // 🛍 Товар / Товари
  if (items.length === 1) {
    const it = items[0] || {};
    const title = (it.title || it.name || 'Товар').trim();
    const color = it.color ? String(it.color).trim() : '';
    const qty = Number(it.qty || it.quantity || 1);
    const price = Number(it.price || 0);

    msg += `🛍 **Товар:**\n`;
    msg += `• **${title}**\n`;
    if (color && color !== 'Стандартний' && color !== 'default' && color !== '—') {
      msg += `• Колір: **${color}**\n`;
    }
    msg += `• Кількість: **${qty} шт.**\n`;
    if (price > 0) {
      if (qty > 1) {
        msg += `• Ціна: **${qty} шт. × ${price} ₴ = ${qty * price} ₴**\n`;
      } else {
        msg += `• Ціна: **${price} ₴**\n`;
      }
    }
  } else if (items.length > 1) {
    msg += `🛍 **Товари:**\n\n`;
    items.forEach((it, idx) => {
      const title = (it.title || it.name || 'Товар').trim();
      const color = it.color && it.color !== 'Стандартний' && it.color !== 'default' && it.color !== '—' ? ` — **${it.color}**` : '';
      const qty = Number(it.qty || it.quantity || 1);
      const price = Number(it.price || 0);
      const itemTotal = price * qty;

      msg += `${idx + 1}. **${title}**${color}\n`;
      if (price > 0) {
        msg += `   ${qty} шт. × ${price} ₴ = **${itemTotal} ₴**\n\n`;
      } else {
        msg += `   ${qty} шт.\n\n`;
      }
    });
    msg = msg.trimEnd() + '\n';
  } else {
    msg += `🛍 **Товар:** **Ігрові девайси MILIPSTORE**\n`;
  }

  // 💰 Сума замовлення
  if (total > 0) {
    msg += `\n💰 **Сума замовлення:** ${total} ₴\n\n`;
  } else {
    msg += `\n`;
  }

  // 👤 Отримувач & 📞 Телефон
  const surname = customer.last_name || customer.surname || '';
  const name = customer.first_name || customer.name || '';
  const patronymic = customer.middle_name || customer.patronymic || '';
  const pib = [surname, name, patronymic].filter(Boolean).join(' ') || customer.fullName || customer.name || '';
  const phone = customer.phone ? String(customer.phone).trim() : '';

  if (pib || phone) {
    if (pib) msg += `👤 **Отримувач:** ${pib}\n`;
    if (phone) msg += `📞 **Телефон:** ${phone}\n`;
    msg += `\n`;
  }

  // 📦 Доставка
  let providerName = 'Нова Пошта';
  if (delivery.provider === 'ukrposhta' || String(delivery.provider_name || '').toLowerCase().includes('укрпошта')) {
    providerName = 'Укрпошта';
  } else if (delivery.provider === 'meest' || String(delivery.provider_name || '').toLowerCase().includes('meest')) {
    providerName = 'Meest Пошта';
  } else if (delivery.provider_name) {
    providerName = delivery.provider_name;
  }

  const city = delivery.city ? String(delivery.city).trim() : '';
  const delivPointRaw = delivery.department || delivery.address || delivery.warehouse_number || '';
  const delivPoint = String(delivPointRaw).trim();

  const isPoshtomat = delivPoint.toLowerCase().includes('поштомат') || delivPoint.toLowerCase().includes('poshtomat') || delivery.method === 'poshtomat';
  const isCourier = delivPoint.toLowerCase().includes('кур') || delivPoint.toLowerCase().includes('адрес') || delivery.method === 'courier';

  let hasDeliv = false;
  if (providerName) {
    msg += `📦 **Доставка:** ${providerName}\n`;
    hasDeliv = true;
  }
  if (city) {
    msg += `📍 **Місто:** ${city}\n`;
    hasDeliv = true;
  }
  if (delivPoint) {
    if (isPoshtomat) {
      msg += `📫 **Поштомат:** ${delivPoint}\n`;
    } else if (isCourier) {
      msg += `🚪 **Адреса:** ${delivPoint}\n`;
    } else {
      msg += `🏢 **Відділення:** ${delivPoint}\n`;
    }
    hasDeliv = true;
  }

  if (hasDeliv) {
    msg += `\n`;
  }

  // Final mandatory phrase
  msg += `Хочу уточнити деталі щодо цього замовлення. Дякую! 😊`;

  return msg;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const localTelegramPhotoMap = {
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

export class TelegramBotService {
  constructor() {
    this.pollingActive = false;
    this.lastUpdateId = 0;
    this.botInfo = null;
    this.adminSessions = {}; // chatId -> { action: 'awaiting_ttn', orderId: '...' }
    this.chatHistory = {}; // chatId -> Set of message IDs for clean chat management
  }

  // Safe normalization of product colors whether stored as Array ['Black', 'White'] or String 'Black, White'
  normalizeColorsList(colors) {
    if (Array.isArray(colors)) {
      return colors.map(c => String(c).trim()).filter(Boolean);
    }
    if (typeof colors === 'string') {
      return colors.split(',').map(s => s.trim()).filter(Boolean);
    }
    return ['Black'];
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
    if (!chatId) return null;

    if (photoUrl && typeof photoUrl === 'string') {
      try {
        let cleanPath = photoUrl.replace(/^\//, '');
        if (cleanPath.startsWith('api/tg-file/')) {
          const subKey = cleanPath.replace('api/tg-file/', '');
          if (localTelegramPhotoMap[subKey]) {
            cleanPath = localTelegramPhotoMap[subKey];
          }
        }
        let localPath = path.join(process.cwd(), cleanPath);
        if (!fs.existsSync(localPath) && localTelegramPhotoMap[cleanPath]) {
          localPath = path.join(process.cwd(), localTelegramPhotoMap[cleanPath]);
        }
        // Ensure caption does not exceed Telegram's 1024-character limit
        const safeCaption = (text && text.length > 1020) ? (text.slice(0, 1016) + '...') : text;

        // 1. Check if it exists as a local file on disk
        if (!photoUrl.startsWith('http') && fs.existsSync(localPath)) {
          const fileBuffer = fs.readFileSync(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');

          const formData = new FormData();
          formData.append('chat_id', String(chatId));
          formData.append('photo', new Blob([fileBuffer], { type: mimeType }), path.basename(localPath));
          if (safeCaption) {
            formData.append('caption', safeCaption);
            formData.append('parse_mode', extra.parse_mode || 'HTML');
          }
          if (extra.reply_markup) {
            formData.append('reply_markup', JSON.stringify(extra.reply_markup));
          }

          const photoRes = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
          });
          const resJson = await photoRes.json();
          if (resJson.ok && resJson.result?.message_id) {
            this.trackMessage(chatId, resJson.result.message_id);
            return resJson.result;
          }
          console.warn('[TelegramBot] Local sendPhoto multipart failed:', resJson.description);
        }

        // 2. If it's a web URL (Telegram CDN, external server, etc.)
        let fullPhoto = photoUrl;
        if (!photoUrl.startsWith('http')) {
          const baseUrl = getPublicAssetBaseUrl();
          fullPhoto = `${baseUrl}/${encodeURI(cleanPath)}`;
        }

        const photoRes = await this.callApi('sendPhoto', {
          chat_id: chatId,
          photo: fullPhoto,
          caption: safeCaption,
          parse_mode: extra.parse_mode || 'HTML',
          reply_markup: extra.reply_markup
        });

        if (photoRes.ok && photoRes.result?.message_id) {
          this.trackMessage(chatId, photoRes.result.message_id);
          return photoRes.result;
        }

        // 3. If direct URL failed (e.g. Telegram CDN requiring bot access), attempt to fetch buffer and send via FormData
        if (fullPhoto.startsWith('http')) {
          try {
            const imgFetch = await fetch(fullPhoto);
            if (imgFetch.ok) {
              const arrayBuf = await imgFetch.arrayBuffer();
              const cType = imgFetch.headers.get('content-type') || 'image/jpeg';
              const formData = new FormData();
              formData.append('chat_id', String(chatId));
              formData.append('photo', new Blob([Buffer.from(arrayBuf)], { type: cType }), 'product.jpg');
              if (safeCaption) {
                formData.append('caption', safeCaption);
                formData.append('parse_mode', extra.parse_mode || 'HTML');
              }
              if (extra.reply_markup) {
                formData.append('reply_markup', JSON.stringify(extra.reply_markup));
              }
              const uploadRes = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
              });
              const uploadJson = await uploadRes.json();
              if (uploadJson.ok && uploadJson.result?.message_id) {
                this.trackMessage(chatId, uploadJson.result.message_id);
                return uploadJson.result;
              }
            }
          } catch (fetchErr) {
            console.warn('[TelegramBot] Buffer fetch fallback failed:', fetchErr.message);
          }
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

  // Specification string parser supporting "Key (Value)", "Key: Value", "Key - Value", "Key Status"
  parseSpecLine(line) {
    let clean = (line || '').trim();
    if (!clean) return null;

    // Strip optional list prefix (e.g., "1. ", "2) ", "3 - ")
    clean = clean.replace(/^\d+[\.\)\-]\s*/, '').trim();
    if (!clean) return null;

    // Pattern 1: Key (Value) e.g., Сенсор (Paw3395), Вага (49г), Перемикачі (Huano)
    const parenMatch = clean.match(/^([^()]+)\((.+)\)$/);
    if (parenMatch) {
      const key = parenMatch[1].trim();
      const value = parenMatch[2].trim();
      if (key && value) return { key, value };
    }

    // Pattern 2: Key: Value e.g., Сенсор: Paw3395 or Підключення: Type-C
    const colonIdx = clean.indexOf(':');
    if (colonIdx !== -1) {
      const key = clean.slice(0, colonIdx).trim();
      const value = clean.slice(colonIdx + 1).trim();
      if (key && value) return { key, value };
    }

    // Pattern 3: Key — Value or Key - Value (dash with spaces around it)
    const dashMatch = clean.match(/^(.+?)\s+[—\–\-]\s+(.+)$/);
    if (dashMatch) {
      const key = dashMatch[1].trim();
      const value = dashMatch[2].trim();
      if (key && value) return { key, value };
    }

    // Pattern 4: Key ends with status word (e.g. "RGB-панель Є", "Gasket Mount Так")
    const statusMatch = clean.match(/^(.+?)\s+(є|так|ні|присутня|присутнє|в наявності|есть|да|нет)$/i);
    if (statusMatch) {
      return { key: statusMatch[1].trim(), value: statusMatch[2].trim() };
    }

    // Pattern 5: Single custom specification name (e.g., "RGB-панель", "Hot-Swap", "OLED-екран")
    return { key: clean, value: 'Є' };
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

        // Remove custom web_app menu button to free up space in the mobile text input area
        try {
          await this.callApi('setChatMenuButton', {
            menu_button: {
              type: 'default'
            }
          });
        } catch (menuErr) {
          console.warn('[TelegramBot] setChatMenuButton error:', menuErr.message);
        }

        // Set standard bot commands
        try {
          await this.callApi('setMyCommands', {
            commands: [
              { command: 'start', description: 'Головне меню та оновлення інтерфейсу' },
              { command: 'shop', description: 'Відкрити магазин девайсів' },
              { command: 'orders', description: 'Мої замовлення' },
              { command: 'manager', description: "Зв'язок з менеджером" }
            ]
          });
        } catch (cmdErr) {
          console.warn('[TelegramBot] setMyCommands error:', cmdErr.message);
        }

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
    const storeUrl = getStoreWebUrl();
    const keyboard = [];

    if (isAdminUser) {
      keyboard.push([
        { text: '👑 Панель адміністратора' },
        { text: '📦 Каталог товарів' }
      ]);
    } else {
      keyboard.push([
        { text: '🎮 Відкрити магазин', web_app: { url: storeUrl } }
      ]);
      keyboard.push([
        { text: "💬 Зв'язок з менеджером" },
        { text: '🛍 Мої замовлення' }
      ]);
    }

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
      if (msg.message_id) {
        // Automatically delete Telegram's default service message "Ви успішно передали дані боту..."
        await this.safeDeleteMessage(chatId, msg.message_id);
      }
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
        } else {
          if (!order.customer) order.customer = {};
          order.customer.telegram_id = from.id;
          if (from.username) order.customer.telegram_username = from.username;
          db.save();
        }
        db.linkOrderToTelegramUser(from.id, order.order_id, order.customer);

        await this.sendOrderCreatedNotifications(order);
        return;
      } catch (err) {
        console.error('[TelegramBot] Failed to parse web_app_data:', err);
      }
    }

    // START / WELCOME / DEEP LINK - Clean Single Message & Always resets sessions
    if (text.startsWith('/start')) {
      delete this.adminSessions[chatId];

      const parts = text.split(' ');
      const startParam = parts[1] || '';

      // Check if deep link for order payment or tracking: /start order_MLP-XXXXXX
      if (startParam.startsWith('order_')) {
        const orderId = startParam.replace('order_', '').trim();
        let order = db.getOrderById(orderId);

        if (!order) {
          try {
            await db.syncWithCloud();
            order = db.getOrderById(orderId);
          } catch (e) {
            console.warn('[TelegramBot] Cloud sync fallback on deep link error:', e);
          }
        }

        if (order) {
          // Link customer telegram id to order
          order.customer.telegram_id = from.id;
          if (from.username) order.customer.telegram_username = from.username;
          db.linkOrderToTelegramUser(from.id, order.order_id, order.customer);
          db.save();

          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: `👋 Вітаємо, <b>${escapeHtml(from.first_name || 'клієнт')}</b>!\nВаше замовлення <b>#${order.order_id}</b> знайдено в системі.`,
            parse_mode: 'HTML',
            reply_markup: this.getReplyKeyboard(from)
          });

          // Present order card and payment prompt
          await this.sendCustomerOrderWithPayment(chatId, order);
          return;
        } else {
          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: `👋 Вітаємо, <b>${escapeHtml(from.first_name || 'клієнт')}</b>!\nЗамовлення <b>#${escapeHtml(orderId)}</b> реєструється в системі. Якщо картка замовлення не зʼявилася, натисніть кнопку «🛍 Мої замовлення» в меню.`,
            parse_mode: 'HTML',
            reply_markup: this.getReplyKeyboard(from)
          });
          return;
        }
      }

      const welcomeText = `👋 <b>Вітаємо в офіційному боті MILIPSTORE!</b>\n\n` +
        `🎮 <b>MILIPSTORE</b> — преміальні ігрові девайси та техніка для сетапу:\n` +
        `• Ультралегкі бездротові мишки\n` +
        `• Кастомні механічні клавіатури з Gasket Mount\n` +
        `• Професійні ігрові поверхні Cordura Control\n\n` +
        `У цьому боті ви можете:\n` +
        `🛍 Переглядати девайси та оформлювати замовлення\n` +
        `📦 Слідкувати за статусом замовлень та ТТН\n` +
        `💬 Консультуватися з менеджером\n\n` +
        `👇 <i>Оберіть потрібну дію на панелі кнопок внизу:</i>`;

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

    // Check if admin is currently in Brand Management session
    if (this.adminSessions[chatId]?.action === 'brand_edit_photo' || 
        this.adminSessions[chatId]?.action === 'brand_edit_name' ||
        this.adminSessions[chatId]?.action === 'brand_add') {
      await this.handleBrandMessage(chatId, from, msg);
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
      text === '🎮 Відкрити магазин' ||
      text === 'Відкрити магазин' ||
      text === '🎮 Магазин' ||
      text === 'Магазин' ||
      text === '🛍 Магазин' ||
      text === '🛍 До асортименту' ||
      text === 'До асортименту' ||
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

      const appUrl = getStoreWebUrl();
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🛒 <b>Асортимент MILIPSTORE</b>\n\nОбирайте найкращі ігрові девайси зі швидкою доставкою по всій Україні:\n👉 <a href="${appUrl}">${appUrl}</a>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍 До асортименту на сайт', web_app: { url: appUrl } }],
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
    if (text === '🛍 Мої замовлення' || text === 'Мої замовлення' || text === '/orders' || text === '/myorders') {
      if (this.isAdmin(from) && text === '/orders') {
        await this.sendAdminOrdersList(chatId, 'ALL');
      } else {
        await this.sendCustomerOrdersList(chatId, from.id);
      }
      return;
    }

    // SUPPORT & MANAGER CONTACT
    if (
      text === "💬 Зв'язок з менеджером" ||
      text === "Зв'язок з менеджером" ||
      text === '💬 Підтримка' ||
      text === '/help' ||
      text === '💬 Менеджер (@milipmanager)' ||
      text === '💬 Менеджер' ||
      text === 'Менеджер' ||
      text === '/manager'
    ) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💬 <b>Менеджер та підтримка MILIPSTORE</b>\n\n` +
          `• Telegram менеджера: <b>@milipmanager</b>\n` +
          `• Графік роботи: Щодня 09:00 — 21:00\n` +
          `• Канал магазину: @m1lipstore\n\n` +
          `Ви можете написати менеджеру напряму для швидкого оформлення замовлення, консультації, уточнення наявності чи оплати.\n\n` +
          `👇 <i>Натисніть кнопку нижче для переходу в особистий чат:</i>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Написати менеджеру', url: 'https://t.me/milipmanager' }],
            [{ text: '📢 Канал магазину', url: 'https://t.me/m1lipstore' }]
          ]
        }
      });
      return;
    }

    // ORDER TRACKING / VIEW ORDERS
    if (text === '📦 Відстежити замовлення' || text === '/track') {
      await this.sendCustomerOrdersList(chatId, from.id);
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
          old_price: null,
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

        const appUrl = getStoreWebUrl();
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

    // ADMIN COMMAND: /cloudsync, /pullcloud, /backup
    if (text === '/cloudsync' || text === '/pullcloud' || text === '/backup') {
      if (!this.isAdmin(from)) {
        await this.callApi('sendMessage', { chat_id: chatId, text: '⛔ У вас немає прав адміністратора.' });
        return;
      }
      const statusMsg = await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '🔄 <i>Виконується зʼєднання та синхронізація з хмарою MILIPSTORE...</i>',
        parse_mode: 'HTML'
      });
      const res = await db.syncWithCloud('https://m1lipstore.onrender.com');
      const timeStr = formatKyivTime();
      let resText = `☁️ <b>Синхронізація з хмарою MILIPSTORE</b>\n\n`;
      if (res.ok) {
        resText += `✅ <b>Статус: Успішно збережено та синхронізовано</b>\n`;
      } else {
        resText += `⚠️ <b>Статус: Локальна база актуальна</b> (${res.reason || 'використано локальний кеш'})\n`;
      }
      resText += `📦 Товарів у каталозі: <b>${db.data.products.length}</b>\n` +
        `📋 Замовлень у базі: <b>${db.data.orders.length}</b>\n` +
        `🏷 Брендів: <b>${db.data.brands.length}</b>\n` +
        `🗂 Категорій: <b>${db.data.categories.length}</b>\n` +
        `🕒 Час перевірки: <b>${timeStr}</b>\n` +
        `🌐 Вузол хмари: <code>https://m1lipstore.onrender.com</code>`;

      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.result?.message_id,
        text: resText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Синхронізувати ще раз', callback_data: 'admin_cloud_sync' }],
            [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
          ]
        }
      });
      return;
    }

    // ORDER ID LOOKUP BY NUMBER (e.g. #MLP-120009 or MLP-120009)
    if (/^(#?MLP-?\d{5,8})$/i.test(text)) {
      const order = db.getOrderById(text);
      if (order) {
        if (this.isAdmin(from)) {
          await this.sendAdminOrderDetails(chatId, order);
        } else {
          await this.sendCustomerOrderDetails(chatId, order);
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
        await this.sendCustomerOrderDetails(chatId, order, msgId);
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

    // CUSTOMER: Prompt delete order (check if confirmed)
    if (data.startsWith('customer_delete_prompt:')) {
      const orderId = data.replace('customer_delete_prompt:', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} не знайдено або вже видалено.`);
        return;
      }

      const isDeletable = order.status === 'NEW' || order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_MANAGER';
      if (!isDeletable) {
        const statusName = ORDER_STATUSES[order.status]?.name || order.status;
        const managerMsg = buildCustomerManagerMessage(order);
        const managerUrl = `https://t.me/milipmanager?text=${encodeURIComponent(managerMsg)}`;

        await this.safeEditOrSend(chatId, msgId, `❌ <b>Замовлення #${orderId} не може бути видалене</b>\n\nАдміністратор уже змінив статус замовлення на <b>«${statusName}»</b> і воно передане на склад для комплектації.\n\nЯкщо вам необхідно змінити дані або скасувати доставку, будь ласка, зверніться напряму до нашого менеджера.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Написати менеджеру', url: managerUrl }],
              [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }],
              [{ text: '📋 До моїх замовлень', callback_data: `orders_list:${chatId}` }]
            ]
          }
        });
        return;
      }

      await this.safeEditOrSend(chatId, msgId, `⚠️ <b>Ви впевнені, що хочете видалити замовлення #${orderId}?</b>\n\nЗамовлення буде повністю видалено з бази даних магазину. Цю дію не можна скасувати.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑 Так, видалити замовлення', callback_data: `customer_delete_confirm:${orderId}` }],
            [{ text: '↩️ Скасувати', callback_data: `view_order:${orderId}` }]
          ]
        }
      });
      return;
    }

    // CUSTOMER: Confirm delete order
    if (data.startsWith('customer_delete_confirm:')) {
      const orderId = data.replace('customer_delete_confirm:', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} вже видалено або не існує.`);
        return;
      }

      const isDeletable = order.status === 'NEW' || order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_MANAGER';
      if (!isDeletable) {
        const statusName = ORDER_STATUSES[order.status]?.name || order.status;
        await this.safeEditOrSend(chatId, msgId, `❌ Замовлення #${orderId} уже підтверджено адміністратором (${statusName}) та не може бути видалене.`);
        return;
      }

      db.deleteOrder(orderId);
      const appUrl = getStoreWebUrl();

      await this.safeEditOrSend(chatId, msgId, `🗑 <b>Замовлення #${orderId} успішно видалено!</b>\n\nВи завжди можете обрати інші девайси та створити нове замовлення у нашому магазині.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Каталог товарів', web_app: { url: appUrl } }],
            [{ text: '📋 До моїх замовлень', callback_data: `orders_list:${chatId}` }]
          ]
        }
      });
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

    // Admin Cloud Sync & Backup Trigger
    if (data === 'admin_cloud_sync') {
      await this.safeEditOrSend(chatId, msgId, '🔄 <i>Виконується зʼєднання та синхронізація з хмарою...</i>');
      const res = await db.syncWithCloud('https://m1lipstore.onrender.com');
      const timeStr = formatKyivTime();
      let resText = `☁️ <b>Синхронізація з хмарою MILIPSTORE</b>\n\n`;
      if (res.ok) {
        resText += `✅ <b>Статус: База синхронізована та збережена</b>\n`;
      } else {
        resText += `⚠️ <b>Статус: Локальна база актуальна</b> (${res.reason || 'використано локальний стан'})\n`;
      }
      resText += `📦 Товарів у каталозі: <b>${db.data.products.length}</b>\n` +
        `📋 Замовлень: <b>${db.data.orders.length}</b>\n` +
        `🏷 Брендів: <b>${db.data.brands.length}</b>\n` +
        `🗂 Категорій: <b>${db.data.categories.length}</b>\n` +
        `🕒 Час перевірки: <b>${timeStr}</b>\n` +
        `🌐 Вузол хмари: <code>https://m1lipstore.onrender.com</code>`;

      await this.safeEditOrSend(chatId, msgId, resText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Оновити синхронізацію', callback_data: 'admin_cloud_sync' }],
            [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
          ]
        }
      });
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

    // Admin Cancel Order - Confirmation Prompt (Double confirmation)
    if (data.startsWith('admin_cancel_prompt:')) {
      const orderId = data.replace('admin_cancel_prompt:', '').trim();
      await this.sendAdminCancelConfirmPrompt(chatId, orderId, msgId);
      return;
    }

    // Admin Cancel Order - Execution
    if (data.startsWith('admin_confirm_cancel:')) {
      const orderId = data.replace('admin_confirm_cancel:', '').trim();
      await this.processAdminStatusChange(chatId, orderId, 'CANCELLED', msgId);
      return;
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

    // Admin Popular Brands Management
    if (data === 'admin_brands') {
      await this.sendAdminBrands(chatId, msgId);
      return;
    }

    if (data.startsWith('admin_brand_view:')) {
      const brandId = data.replace('admin_brand_view:', '').trim();
      await this.sendAdminBrandView(chatId, brandId, msgId);
      return;
    }

    if (data.startsWith('admin_brand_toggle:')) {
      const brandId = data.replace('admin_brand_toggle:', '').trim();
      const brand = db.getBrandById(brandId);
      if (brand) {
        db.updateBrand(brand.id, { hidden: !brand.hidden });
      }
      await this.sendAdminBrandView(chatId, brandId, msgId);
      return;
    }

    if (data.startsWith('admin_brand_edit_photo:')) {
      const brandId = data.replace('admin_brand_edit_photo:', '').trim();
      await this.startBrandPhotoEdit(chatId, brandId, msgId);
      return;
    }

    if (data.startsWith('admin_brand_edit_name:')) {
      const brandId = data.replace('admin_brand_edit_name:', '').trim();
      await this.startBrandNameEdit(chatId, brandId, msgId);
      return;
    }

    if (data.startsWith('admin_brand_delete_prompt:')) {
      const brandId = data.replace('admin_brand_delete_prompt:', '').trim();
      const brand = db.getBrandById(brandId);
      if (!brand) {
        await this.safeEditOrSend(chatId, msgId, '❌ Бренд не знайдено.');
        return;
      }
      await this.safeEditOrSend(chatId, msgId, `⚠️ <b>Підтвердження видалення бренду</b>\n\n` +
        `🌟 Бренд: <b>${brand.name}</b>\n\n` +
        `Ви дійсно бажаєте видалити цей бренд з панелі та вітрини магазину?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑 Так, видалити бренд', callback_data: `admin_brand_delete_confirm:${brand.id}` }],
            [{ text: '❌ Скасувати (Повернутися)', callback_data: `admin_brand_view:${brand.id}` }]
          ]
        }
      });
      return;
    }

    if (data.startsWith('admin_brand_delete_confirm:')) {
      const brandId = data.replace('admin_brand_delete_confirm:', '').trim();
      db.deleteBrand(brandId);
      await this.safeEditOrSend(chatId, msgId, '🗑 <b>Бренд успішно видалено.</b>', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌟 До списку брендів', callback_data: 'admin_brands' }],
            [{ text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }]
          ]
        }
      });
      return;
    }

    if (data === 'admin_brand_add') {
      await this.startBrandAdd(chatId, msgId);
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
  // Get main product photo matching the specific color chosen in the order
  getOrderColorPhoto(order) {
    if (!order || !order.items || order.items.length === 0) return null;
    const firstItem = order.items[0] || {};
    const orderedColor = (firstItem.color || '').trim();

    // 1. Check firstItem's own color_images
    if (orderedColor && firstItem.color_images) {
      if (firstItem.color_images[orderedColor]?.main) {
        return firstItem.color_images[orderedColor].main;
      }
      const matchKey = Object.keys(firstItem.color_images).find(k => k.trim().toLowerCase() === orderedColor.toLowerCase());
      if (matchKey && firstItem.color_images[matchKey]?.main) {
        return firstItem.color_images[matchKey].main;
      }
    }

    // 2. Fetch full product from DB to access complete color_images map
    const prod = db.getProductById(firstItem.product_id || firstItem.id);
    if (prod) {
      if (orderedColor && prod.color_images) {
        if (prod.color_images[orderedColor]?.main) {
          return prod.color_images[orderedColor].main;
        }
        const matchKey = Object.keys(prod.color_images).find(k => k.trim().toLowerCase() === orderedColor.toLowerCase());
        if (matchKey && prod.color_images[matchKey]?.main) {
          return prod.color_images[matchKey].main;
        }
      }
      if (prod.img) return prod.img;
      if (Array.isArray(prod.gallery) && prod.gallery.length > 0) return prod.gallery[0];
    }

    // 3. Fallbacks to item image
    if (firstItem.img) return firstItem.img;

    return null;
  }

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

    const items = order.items || [];
    let itemsBlock = '';
    if (items.length === 1) {
      const it = items[0];
      itemsBlock = `• <b>Товари:</b> 🕹 <b>${it.title}</b>\n` +
        (it.color ? `• <b>Колір:</b> <b>${it.color}</b>\n` : '') +
        `• <b>Кількість:</b> ${it.qty} шт. × ${it.price} ₴ = <b>${it.price * it.qty} ₴</b>\n`;
    } else if (items.length > 1) {
      const list = items.map((it, idx) => {
        const col = it.color ? ` (${it.color})` : '';
        return `  ${idx + 1}. 🕹 <b>${it.title}${col}</b>: ${it.qty} шт. × ${it.price} ₴ = <b>${it.price * it.qty} ₴</b>`;
      }).join('\n');
      itemsBlock = `• <b>Товари:</b>\n${list}\n`;
    } else {
      itemsBlock = `• <b>Товари:</b> <i>Товари не вказані</i>\n`;
    }

    const fullName = this.formatCustomerFullName(customer);
    const provName = delivery.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова Пошта';
    const delivPoint = delivery.department || delivery.address || delivery.city || 'Відділення';
    const cleanTg = (customer.telegram_username || '').replace(/^@+/, '');

    // Find photo of the 1st ordered item and exact color
    const colorPhoto = this.getOrderColorPhoto(order);

    let text = `🎉 <b>Дякуємо за замовлення в MILIPSTORE!</b>\n\n` +
      `Ваше замовлення <b>#${order.order_id}</b> успішно зареєстровано!\n\n` +
      `💬 <b>Оформлення через менеджера:</b>\n` +
      `Для підтвердження наявності товару та узгодження оплати напишіть менеджеру за кнопкою нижче.\n\n` +
      `📦 <b>Інформація про замовлення:</b>\n` +
      `${itemsBlock}` +
      `• <b>Сума:</b> <b>${order.total} ₴</b>\n` +
      `• <b>Отримувач:</b> ${fullName} (<code>${customer.phone || 'не вказано'}</code>)\n` +
      (cleanTg ? `• <b>Telegram:</b> @${cleanTg}\n` : '') +
      `• <b>Доставка:</b> ${provName} (${delivPoint})\n` +
      `• <b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n` +
      `• <b>Спосіб:</b> 💬 <b>Через менеджера</b>`;

    if (order.tracking_number) {
      text += `\n• <b>ТТН:</b> <code>${order.tracking_number}</code>`;
    }

    const buttons = [];

    const managerText = buildCustomerManagerMessage(order);
    const managerUrl = `https://t.me/milipmanager?text=${encodeURIComponent(managerText)}`;

    // Primary action: Direct chat with manager with prefilled text!
    buttons.push([
      { text: '💬 Написати менеджеру', url: managerUrl }
    ]);

    // Details view
    buttons.push([
      { text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }
    ]);

    // Delete order button
    buttons.push([
      { text: '🗑 Видалити замовлення', callback_data: `customer_delete_prompt:${order.order_id}` }
    ]);

    if (messageId) {
      await this.safeDeleteMessage(chatId, messageId);
    }

    await this.sendPhotoOrMessage(chatId, colorPhoto, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // View full order details with product photo matching chosen color
  async sendCustomerOrderDetails(chatId, order, messageId = null) {
    if (!order) return;

    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const payment = order.payment || {};
    const isOnline = payment.method === 'online';
    const isPaid = payment.status === 'PAID';
    const isUnpaid = isOnline && !isPaid;
    const statusName = order.status_name || ORDER_STATUSES[order.status]?.name || order.status;

    let statusEmoji = '📦';
    if (order.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
    else if (order.status === 'NEW') statusEmoji = '🆕';
    else if (order.status === 'CONFIRMED') statusEmoji = '✅';
    else if (order.status === 'PACKING_PREP' || order.status === 'PACKED') statusEmoji = '📦';
    else if (order.status === 'DISPATCH_PREP') statusEmoji = '🚚';
    else if (order.status === 'SHIPPED') statusEmoji = '🚚';
    else if (order.status === 'DELIVERED') statusEmoji = '🏢';
    else if (order.status === 'COMPLETED') statusEmoji = '🎉';
    else if (order.status === 'CANCELLED') statusEmoji = '❌';

    const items = order.items || [];
    const firstItem = items[0] || {};
    const orderedColor = (firstItem.color || '').trim();
    const colorPhoto = this.getOrderColorPhoto(order);

    const fullName = this.formatCustomerFullName(customer);
    const provName = delivery.provider === 'ukrposhta' ? 'Укрпошта' : (delivery.provider_name || 'Нова Пошта');
    const delivPoint = delivery.department || delivery.address || delivery.city || 'Відділення';

    let detailsText = `🔍 <b>Деталі замовлення #${order.order_id}</b>\n\n`;

    detailsText += `🕹 <b>Головний товар:</b>\n`;
    detailsText += `• Назва: <b>${firstItem.title || 'Товар'}</b>\n`;
    detailsText += `• Обраний колір: 🎨 <b>${orderedColor || 'Стандартний'}</b>\n`;
    detailsText += `• Кількість: ${firstItem.qty || 1} шт. × ${firstItem.price || order.total} ₴ = <b>${(firstItem.price || order.total) * (firstItem.qty || 1)} ₴</b>\n`;

    if (items.length > 1) {
      detailsText += `\n📦 <b>Інші товари в замовленні:</b>\n`;
      for (let i = 1; i < items.length; i++) {
        const it = items[i];
        detailsText += `${i + 1}. <b>${it.title}</b>${it.color ? ` (колір: ${it.color})` : ''} — ${it.qty} шт. × ${it.price} ₴\n`;
      }
    }

    const isManagerOrder = payment.method === 'manager' || !payment.method;
    const paymentLabel = isManagerOrder
      ? 'Через менеджера 💬'
      : (isPaid ? 'Оплачено ✅' : (isUnpaid ? 'Очікує оплати ⏳' : 'При отриманні (накладений платіж) 📦'));

    detailsText += `\n📊 <b>Стан замовлення:</b>\n`;
    detailsText += `• Статус: ${statusEmoji} <b>${statusName}</b>\n`;
    detailsText += `• Сума: <b>${order.total} ₴</b>\n`;
    detailsText += `• Оформлення: <b>${paymentLabel}</b>\n`;
    if (order.tracking_number) {
      detailsText += `• Номер ТТН: <code>${order.tracking_number}</code> 🚚\n`;
    } else {
      detailsText += `• Номер ТТН: <i>буде надано після відправки зі складу</i>\n`;
    }

    detailsText += `\n👤 <b>Дані отримувача:</b>\n`;
    detailsText += `• Отримувач: <b>${fullName}</b>\n`;
    detailsText += `• Телефон: <code>${customer.phone || 'не вказано'}</code>\n`;
    if (customer.email) {
      detailsText += `• Email: ${customer.email}\n`;
    }

    detailsText += `\n🏢 <b>Доставка:</b>\n`;
    detailsText += `• Служба: <b>${provName}</b>\n`;
    if (delivery.city) {
      detailsText += `• Місто: <b>${delivery.city}</b>\n`;
    }
    detailsText += `• Адреса / пункт: ${delivPoint}\n`;

    detailsText += `\n📅 <b>Дата оформлення:</b> ${formatKyivDateTime(order.created_at || Date.now())}`;

    const buttons = [];

    const managerDetailMsg = buildCustomerManagerMessage(order);
    const managerDetailUrl = `https://t.me/milipmanager?text=${encodeURIComponent(managerDetailMsg)}`;

    buttons.push([
      { text: '💬 Написати менеджеру', url: managerDetailUrl }
    ]);

    buttons.push([
      { text: '📋 До моїх замовлень', callback_data: `orders_list:${chatId}` }
    ]);

    buttons.push([
      { text: '🗑 Видалити замовлення', callback_data: `customer_delete_prompt:${order.order_id}` }
    ]);

    if (messageId) {
      await this.safeDeleteMessage(chatId, messageId);
    }

    await this.sendPhotoOrMessage(chatId, colorPhoto, detailsText, {
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

  async sendCustomerOrdersList(chatId, telegramUserId, messageId = null) {
    const orders = db.getOrdersByTelegramId(telegramUserId || chatId);

    if (!orders || orders.length === 0) {
      const appUrl = getStoreWebUrl();
      await this.safeEditOrSend(chatId, messageId, `🛍 <b>Мої замовлення</b>\n\nУ вас поки немає оформлених замовлень.\nОберіть девайси в нашому магазині та оформлюйте замовлення!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍 До асортименту на сайт', web_app: { url: appUrl } }]
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

      // Find exact color photo
      const colorPhoto = this.getOrderColorPhoto(o);

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

      // [ПРИХОВАНО на майбутнє - для активації онлайн-оплати/ФОП]
      // if (isUnpaid) {
      //   buttons.push([
      //     { text: `💳 Оплатити #${o.order_id} (${o.total} ₴)`, callback_data: `send_invoice:${o.order_id}` },
      //     { text: `⚡ Сплатити (Test)`, callback_data: `pay_test:${o.order_id}` }
      //   ]);
      // }

      const oManagerMsg = buildCustomerManagerMessage(o);
      const oManagerUrl = `https://t.me/milipmanager?text=${encodeURIComponent(oManagerMsg)}`;

      buttons.push([
        { text: '💬 Написати менеджеру', url: oManagerUrl }
      ]);
      buttons.push([
        { text: '🔍 Деталі замовлення', callback_data: `view_order:${o.order_id}` }
      ]);
      buttons.push([
        { text: '🗑 Видалити замовлення', callback_data: `customer_delete_prompt:${o.order_id}` }
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

    // Only orders that are paid or cash on delivery or manager appear for admin processing
    const isReadyForAdmin = o => (o.payment?.status === 'PAID' || o.payment?.is_cod || o.payment?.method === 'cod' || o.payment?.method === 'manager' || !o.payment?.method) && o.status !== 'PENDING_PAYMENT';
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
        { text: '🌟 Популярні бренди', callback_data: 'admin_brands' },
        { text: '📥 Вхідні повідомлення', callback_data: 'admin_inbox' }
      ],
      [
        { text: '☁️ Хмара та збереження', callback_data: 'admin_cloud_sync' }
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

    const isReadyForAdmin = o => (o.payment?.status === 'PAID' || o.payment?.is_cod || o.payment?.method === 'cod' || o.payment?.method === 'manager' || !o.payment?.method) && o.status !== 'PENDING_PAYMENT';
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
    text += `📅 <b>Дата створення:</b> ${formatKyivDateTime(order.created_at || Date.now())} (Київ)\n`;
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
    const isArchived = ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status);

    if (!isArchived) {
      // Row 1: Quick Actions (Підтвердити / Скасувати)
      const actionRow = [];
      if (order.status !== 'CONFIRMED') {
        actionRow.push({ text: '✅ Підтвердити замовлення', callback_data: `admin_confirm:${order.order_id}` });
        actionRow.push({ text: '❌ Скасувати', callback_data: `admin_cancel_prompt:${order.order_id}` });
      } else {
        actionRow.push({ text: '❌ Скасувати замовлення', callback_data: `admin_cancel_prompt:${order.order_id}` });
      }
      buttons.push(actionRow);

      // Row 2: Status Menu
      buttons.push([
        { text: '🔄 Змінити статус замовлення', callback_data: `admin_status_menu:${order.order_id}` }
      ]);

      // Row 3: TTN
      buttons.push([
        { text: order.tracking_number ? '🚚 Змінити номер ТТН' : '🚚 Вказати номер ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
      ]);

      // Row 4: Delete
      buttons.push([
        { text: '🗑 Видалити замовлення', callback_data: `admin_delete_prompt:${order.order_id}` }
      ]);

      // Row 5: Navigation
      buttons.push([
        { text: '⚡ До активних', callback_data: 'admin_list:ACTIVE' },
        { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
      ]);
    } else {
      // For archived/cancelled orders
      buttons.push([
        { text: '🔄 Змінити статус замовлення', callback_data: `admin_status_menu:${order.order_id}` }
      ]);
      buttons.push([
        { text: order.tracking_number ? '🚚 Змінити номер ТТН' : '🚚 Вказати номер ТТН', callback_data: `admin_ttn_prompt:${order.order_id}` }
      ]);
      buttons.push([
        { text: '🗑 Видалити замовлення', callback_data: `admin_delete_prompt:${order.order_id}` }
      ]);
      buttons.push([
        { text: '🗄 До архіву', callback_data: 'admin_list:ARCHIVE' },
        { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
      ]);
    }

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminCancelConfirmPrompt(chatId, orderId, messageId = null) {
    const order = db.getOrderById(orderId);
    if (!order) {
      await this.safeEditOrSend(chatId, messageId, `❌ Замовлення #${orderId} не знайдено.`);
      return;
    }
    const custName = this.formatCustomerFullName(order.customer);
    const text = `⚠️ <b>Підтвердження скасування замовлення #${orderId}</b>\n\n` +
      `👤 Покупець: <b>${custName}</b>\n` +
      `💰 Сума: <b>${order.total} ₴</b>\n` +
      `📊 Поточний статус: <b>${ORDER_STATUSES[order.status]?.name || order.status}</b>\n\n` +
      `Ви дійсно бажаєте скасувати це замовлення?\n\n` +
      `• Статус буде змінено на <b>«Скасовано»</b>\n` +
      `• Замовлення перейде в <b>Архів</b>\n` +
      `• Покупцю надійде сповіщення про скасування\n\n` +
      `<i>Підтвердіть скасування або поверніться назад:</i>`;

    const buttons = [
      [
        { text: '❌ Так, точно скасувати', callback_data: `admin_confirm_cancel:${orderId}` }
      ],
      [
        { text: '↩️ Ні, повернутися до замовлення', callback_data: `admin_view:${orderId}` }
      ]
    ];

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
        { text: '❌ Скасувати замовлення (В архів)', callback_data: `admin_cancel_prompt:${orderId}` }
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
    const deliv = order.delivery || {};
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : (deliv.provider_name || 'Нова Пошта');

    const items = order.items || [];
    let itemsSummary = '';
    if (items.length > 0) {
      itemsSummary = items.map(it => `• <b>${escapeHtml(it.title || 'Товар')}</b>${it.color ? ` (${escapeHtml(it.color)})` : ''}${it.qty > 1 ? ` — ${it.qty} шт.` : ''}`).join('\n');
    } else {
      itemsSummary = '• <b>Ігрові девайси MILIPSTORE</b>';
    }

    const rawDelivStr = `${deliv.department || ''} ${deliv.address || ''} ${deliv.method || ''}`.toLowerCase();
    const isPoshtomat = rawDelivStr.includes('поштомат') || rawDelivStr.includes('poshtomat');
    const isCourier = rawDelivStr.includes('кур') || rawDelivStr.includes('адрес') || deliv.method === 'courier';

    let delivLocationName = '';
    let delivPointType = 'у відділення';
    let delivPointEmoji = '🏢';

    if (isPoshtomat) {
      delivPointType = 'у поштомат';
      delivPointEmoji = '📫';
      delivLocationName = `${provName} (Поштомат): ${deliv.city || ''}${deliv.department ? `, ${deliv.department}` : ''}`;
    } else if (isCourier) {
      delivPointType = "кур'єром за вашою адресою";
      delivPointEmoji = '🚪';
      delivLocationName = `${provName} (Кур'єрська доставка): ${deliv.city || ''}${deliv.address ? `, ${deliv.address}` : ''}`;
    } else {
      delivPointType = 'у відділення';
      delivPointEmoji = '🏢';
      delivLocationName = `${provName}: ${deliv.city || ''}${deliv.department ? `, ${deliv.department}` : ''}`;
    }

    switch (newStatus) {
      case 'CONFIRMED':
        messageText = `✅ <b>Ваше замовлення ${orderNum} підтверджено менеджером!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nМи вже прийняли замовлення в роботу та передали на комплектацію нашому складу.`;
        if (order.payment?.method === 'online' && order.payment?.status !== 'PAID') {
          messageText += `\n\n💳 <b>Очікується онлайн-оплата:</b> ${order.total} ₴`;
        }
        break;
      case 'PAID':
        messageText = `💳 <b>Оплату за замовлення ${orderNum} успішно зараховано!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nСума: <b>${order.total} ₴</b>.\nДякуємо! Ваше замовлення передано на склад для пакування.`;
        break;
      case 'PACKING_PREP':
      case 'PACKED':
        messageText = `📦 <b>Ваше замовлення ${orderNum} зараз упаковується на складі!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nМи дбайливо перевіряємо комплектацію та надійно пакуємо ваші девайси перед відправкою.`;
        break;
      case 'DISPATCH_PREP':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} зібрано та готується до відправки!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nНевдовзі посилка буде передана поштовій службі.`;
        break;
      case 'SHIPPED':
        messageText = `🚚 <b>Ваше замовлення ${orderNum} вже відправлено!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\n`;
        if (track) {
          messageText += `📦 <b>Номер ТТН:</b> <code>${track}</code>\n`;
        }
        messageText += `🏢 <b>Служба доставки:</b> <b>${provName}</b>\n📍 <b>Пункт призначення:</b> ${delivLocationName}\n\nВи можете відстежувати рух посилки за номером ТТН у додатку перевізника або на сайті.`;
        break;
      case 'DELIVERED':
        messageText = `${delivPointEmoji} <b>Ваше замовлення ${orderNum} вже прибуло ${delivPointType}!</b>\n\n` +
          `🛍 <b>Товари:</b>\n${itemsSummary}\n\n` +
          `📍 <b>Місце отримання:</b> ${delivLocationName}\n` +
          (track ? `📦 <b>Номер ТТН:</b> <code>${track}</code>\n\n` : '\n') +
          `✨ <b>Посилка вже очікує на вас!</b>\n` +
          `Щиро дякуємо, що обрали <b>MILIPSTORE</b> для оновлення свого сетапу. Будь ласка, заберіть посилку у зручний для вас час та обов'язково перевірте комплектацію при отриманні.\n\n` +
          `Бажаємо яскравих перемог, максимального комфорту та суцільного задоволення від користування вашими новими девайсами! 🔥🎮`;
        break;
      case 'COMPLETED':
        messageText = `🎉 <b>Ваше замовлення ${orderNum} успішно виконано!</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nЩиро дякуємо за покупку в MILIPSTORE! Будемо раді бачити вас знову серед наших клієнтів. Приємного користування девайсами! ✨`;
        break;
      case 'CANCELLED':
        messageText = `❌ <b>Ваше замовлення ${orderNum} було скасовано.</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}\n\nЯкщо у вас виникли будь-які запитання або бажаєте оформити замовлення знову, наш менеджер завжди на зв'язку.`;
        break;
      default:
        messageText = `📦 <b>Оновлено статус вашого замовлення ${orderNum}:</b> <b>${ORDER_STATUSES[newStatus]?.name || newStatus}</b>\n\n🛍 <b>Товари:</b>\n${itemsSummary}`;
        break;
    }

    const custButtons = [
      [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
    ];

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

    // 2. Admin Notification: Send immediate notification to all admins for every new order
    if (!order._admin_notified) {
      await this.notifyAdminsNewOrder(order);
    }
  }

  async notifyAdminsNewOrder(order) {
    if (order._admin_notified) return;
    order._admin_notified = true;
    order._admin_paid_notified = true;
    db.save();

    const cust = order.customer || {};
    const deliv = order.delivery || {};
    const items = order.items || [];
    const itemsList = items.map(i => `• ${i.title}${i.color ? ` (${i.color})` : ''}\n  ${i.qty} шт. × ${i.price} ₴ = ${i.price * i.qty} ₴`).join('\n');
    
    const surname = cust.last_name || cust.surname || '';
    const name = cust.first_name || cust.name || '';
    const patronymic = cust.middle_name || cust.patronymic || '';
    const pib = [surname, name, patronymic].filter(Boolean).join(' ') || [name, surname].filter(Boolean).join(' ') || 'Покупець';

    const cleanTg = (cust.telegram_username || '').replace(/^@+/, '');
    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова Пошта';
    const dateStr = formatKyivDateTime(order.created_at || Date.now());

    const adminMsg = `👑 <b>ЗАМОВЛЕННЯ #${order.order_id}</b>\n\n` +
      `📊 <b>Статус:</b> 🆕 <b>Нові</b>\n` +
      `📅 <b>Дата створення:</b> ${dateStr} (Київ)\n\n` +
      `👤 <b>Покупець:</b>\n` +
      `• ПІБ: <b>${pib}</b>\n` +
      `• Прізвище: ${surname || '—'}\n` +
      `• Ім'я: ${name || '—'}\n` +
      `• По батькові: ${patronymic || '—'}\n` +
      `• Телефон: <code>${cust.phone || 'не вказано'}</code>\n` +
      `• Telegram: ${cleanTg ? `@${cleanTg}` : '—'}\n\n` +
      `🏢 <b>Доставка:</b>\n` +
      `• Перевізник: <b>${provName}</b>\n` +
      `• Місто: <b>${deliv.city || '—'}</b>\n` +
      `• Відділення / адреса: ${deliv.department || deliv.address || '—'}\n\n` +
      `💳 <b>Оплата:</b>\n` +
      `• Спосіб: <b>Оформлення через менеджера (@milipmanager)</b>\n\n` +
      `🛍 <b>Товари в замовленні:</b>\n${itemsList}\n` +
      (order.payment?.comment || order.admin_comment ? `\n💬 <b>Коментар:</b> ${order.payment?.comment || order.admin_comment}\n` : '') +
      `\n💰 <b>ЗАГАЛЬНА СУМА: ${order.total} ₴</b>`;

    const adminButtons = [
      [
        { text: '🔍 Переглянути замовлення', callback_data: `admin_view:${order.order_id}` }
      ]
    ];

    if (cust.telegram_username) {
      const cleanUsername = cust.telegram_username.replace(/^@/, '');
      adminButtons.push([
        { text: `💬 Написати покупцю (@${cleanUsername})`, url: `https://t.me/${cleanUsername}` }
      ]);
    } else if (cust.telegram_id) {
      adminButtons.push([
        { text: `💬 Написати покупцю в Telegram`, url: `tg://user?id=${cust.telegram_id}` }
      ]);
    }

    if (cust.phone) {
      const cleanPhone = cust.phone.replace(/[^\d+]/g, '');
      adminButtons.push([
        { text: `📞 Зателефонувати (${cust.phone})`, url: `tel:${cleanPhone}` }
      ]);
    }

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
    const deliv = order.delivery || {};
    const fullName = this.formatCustomerFullName(cust);
    const targetChatId = order.customer?.telegram_id || cust.telegram_id;

    if (!targetChatId) return;

    const items = order.items || [];
    const firstItem = items[0] || {};
    const orderedColor = (firstItem.color || '').trim();
    const colorPhoto = this.getOrderColorPhoto(order);

    const provName = deliv.provider === 'ukrposhta' ? 'Укрпошта' : (deliv.provider_name || 'Нова Пошта');
    const delivPoint = deliv.department || deliv.address || deliv.city || 'Відділення';

    let text = `🎉 <b>ЩИРО ДЯКУЄМО ЗА ОПЛАТУ!</b>\n\n` +
      `Кошти за замовлення <b>#${order.order_id}</b> успішно зараховано.\n` +
      `Ми щиро вдячні за ваш вибір магазину <b>M1lipStore</b> та високу довіру! 💙💛\n\n` +
      `📦 <b>Інформація про замовлення:</b>\n` +
      `• <b>Головний товар:</b> 🕹 <b>${firstItem.title || 'Товар'}</b>\n` +
      (orderedColor ? `• <b>Обраний колір:</b> 🎨 <b>${orderedColor}</b>\n` : '') +
      `• <b>Кількість:</b> ${firstItem.qty || 1} шт.\n` +
      `• <b>Сума до сплати:</b> <b>${order.total} ₴</b> (Сплачено ✅)\n` +
      `• <b>Спосіб оплати:</b> ${order.payment?.provider || 'Онлайн-оплата'}\n` +
      `• <b>Статус замовлення:</b> 🟡 <b>Передано на комплектацію</b>\n` +
      `• <b>Отримувач:</b> ${fullName} (${cust.phone || 'не вказано'})\n` +
      `• <b>Доставка:</b> ${provName} (${delivPoint})\n\n` +
      `🚚 <b>Очікуйте на відправку:</b>\n` +
      `Наші фахівці вже комплектують ваше замовлення та проводять ретельну перевірку девайсу перед пакуванням.\n` +
      `Щойно посилку буде передано перевізнику, ви <b>одразу отримаєте номер ТТН</b> та зможете відстежувати рух відправлення прямо тут, у нашому боті.\n\n` +
      `Бажаємо приємного користування девайсом та яскравих перемог! ✨\n` +
      `<i>Якщо у вас виникнуть будь-які запитання — наша підтримка завжди рада допомогти.</i>`;

    const orderIdPaidStr = (order.order_id || '').replace(/^#/, '');
    const paidSupportMsg = `Добрий день! Щодо оплаченого замовлення #${orderIdPaidStr} (Сума: ${order.total} ₴, Отримувач: ${fullName}): хочу уточнити деталі відправки.`;
    const paidSupportUrl = `https://t.me/milipmanager?text=${encodeURIComponent(paidSupportMsg)}`;

    const buttons = [
      [{ text: '💬 Написати менеджеру', url: paidSupportUrl }],
      [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }],
      [{ text: '📋 До моїх замовлень', callback_data: `orders_list:${targetChatId}` }]
    ];

    if (messageId) {
      await this.safeDeleteMessage(targetChatId, messageId);
    }

    await this.sendPhotoOrMessage(targetChatId, colorPhoto, text, {
      reply_markup: { inline_keyboard: buttons }
    });
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
        { text: '🔍 Переглянути замовлення', callback_data: `admin_view:${order.order_id}` }
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
      await this.sendAdminDashboard(chatId, from || { first_name: 'Адміністратор' }, cardId);
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
      await this.promptWizardWarranty(chatId);
      return;
    }

    if (data === 'wiz_specs_skip') {
      session.data.specs = this.getDefaultSpecs(session.data.category || 'мишки');
      await this.promptWizardWarranty(chatId);
      return;
    }

    if (data === 'wiz_specs_clear') {
      session.data.specs = [];
      await this.promptWizardSpecs(chatId);
      return;
    }

    // STEP 5: WARRANTY ACTIONS
    if (data.startsWith('wiz_warranty:')) {
      const wVal = data.replace('wiz_warranty:', '').trim();
      session.data.warranty = wVal || '1 місяць';
      await this.promptWizardPrice(chatId);
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

    if (data.startsWith('wiz_main_color:')) {
      const colVal = data.replace('wiz_main_color:', '').trim();
      if (colVal !== 'SKIP' && colVal) {
        session.data.main_color = colVal;
        if (!session.data.color_images) session.data.color_images = {};
        if (!session.data.color_images[colVal]) {
          session.data.color_images[colVal] = { main: session.data.img, gallery: [session.data.img] };
        } else {
          session.data.color_images[colVal].main = session.data.img;
          if (!session.data.color_images[colVal].gallery) session.data.color_images[colVal].gallery = [];
          if (!session.data.color_images[colVal].gallery.includes(session.data.img)) {
            session.data.color_images[colVal].gallery.unshift(session.data.img);
          }
        }
      }
      session.data.currentColorIndex = 0;
      await this.promptWizardColorPhotos(chatId);
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

    // STEP 10: QUANTITIES (Interactive warehouse panel, quick buttons, Skip, and Confirm)
    if (data === 'wiz_qty_skip' || data === 'wiz_qty_skip_all') {
      if (!session.data.color_quantities) session.data.color_quantities = {};
      colors.forEach(c => {
        if (session.data.color_quantities[c] === undefined) {
          session.data.color_quantities[c] = 25;
        }
      });
      await this.showWizardConfirm(chatId);
      return;
    }

    if (data === 'wiz_qty_confirm_done') {
      if (!session.data.color_quantities) session.data.color_quantities = {};
      colors.forEach(c => {
        if (session.data.color_quantities[c] === undefined) {
          session.data.color_quantities[c] = 25;
        }
      });
      await this.showWizardConfirm(chatId);
      return;
    }

    if (data.startsWith('wiz_qty_sel:')) {
      const selectedColor = data.replace('wiz_qty_sel:', '').trim();
      session.data.activeQtyColor = selectedColor;
      await this.promptWizardColorQuantity(chatId);
      return;
    }

    if (data.startsWith('wiz_qty_set:') || data.startsWith('wiz_qty:')) {
      const qtyVal = parseInt(data.replace(/wiz_qty_set:|wiz_qty:/, '').trim(), 10) || 10;
      const targetColor = session.data.activeQtyColor || colors[0] || 'Black';
      if (!session.data.color_quantities) session.data.color_quantities = {};
      session.data.color_quantities[targetColor] = qtyVal;

      const curIdx = colors.indexOf(targetColor);
      if (curIdx !== -1 && curIdx + 1 < colors.length) {
        session.data.activeQtyColor = colors[curIdx + 1];
      }
      await this.promptWizardColorQuantity(chatId);
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

    const text = (msg.text || '').trim();

    // If command or cancel text, cancel wizard session gracefully
    if (text.startsWith('/') || text === '❌ Скасувати' || text === 'Скасувати') {
      delete this.adminSessions[chatId];
      return;
    }

    // Delete user's incoming message to keep the chat clean
    if (msg.message_id) {
      await this.safeDeleteMessage(chatId, msg.message_id);
    }

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
        await this.promptWizardWarranty(chatId);
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

      // If reached 10 specs, automatically advance to warranty
      if (session.data.specs.length >= 10) {
        await this.promptWizardWarranty(chatId);
      } else {
        await this.promptWizardSpecs(chatId);
      }
      return;
    }

    // 5. Warranty Input
    if (session.step === 'warranty') {
      let wVal = text;
      if (text === '1' || text.toLowerCase().includes('1') || text.toLowerCase().includes('один')) {
        wVal = '1 місяць';
      } else if (text === '3' || text.toLowerCase().includes('3') || text.toLowerCase().includes('три')) {
        wVal = '3 місяці';
      }
      session.data.warranty = wVal || '1 місяць';
      await this.promptWizardPrice(chatId);
      return;
    }

    // 6. Price Input (Manual Only)
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
        const colors = session.data.colors || ['Black'];
        if (colors.length > 0) {
          await this.promptWizardMainPhotoColor(chatId);
        } else {
          session.data.currentColorIndex = 0;
          await this.promptWizardColorPhotos(chatId);
        }
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

    // 10. Quantity Input (Unified warehouse input)
    if (session.step === 'color_quantities') {
      const colors = (session.data.colors && session.data.colors.length) ? session.data.colors : ['Black'];
      if (!session.data.color_quantities) session.data.color_quantities = {};

      if (text.toLowerCase() === '/done' || text.toLowerCase() === 'готово' || text.toLowerCase() === 'далі') {
        colors.forEach(c => {
          if (session.data.color_quantities[c] === undefined) {
            session.data.color_quantities[c] = 25;
          }
        });
        await this.showWizardConfirm(chatId);
        return;
      }

      // Check if user sent multiple numbers separated by space or comma (e.g. "10 20 15")
      const nums = text.split(/[\s,]+/).map(n => parseInt(n.replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 0);

      if (nums.length > 1) {
        nums.forEach((val, idx) => {
          if (idx < colors.length) {
            session.data.color_quantities[colors[idx]] = val;
          }
        });
        await this.promptWizardColorQuantity(chatId);
        return;
      } else if (nums.length === 1) {
        const val = nums[0];
        const targetColor = session.data.activeQtyColor || colors[0] || 'Black';
        session.data.color_quantities[targetColor] = val;

        const curIdx = colors.indexOf(targetColor);
        if (curIdx !== -1 && curIdx + 1 < colors.length) {
          session.data.activeQtyColor = colors[curIdx + 1];
        }
        await this.promptWizardColorQuantity(chatId);
        return;
      }

      await this.safeEditOrSend(chatId, session.cardMsgId, '⚠️ Будь ласка, введіть число залишку (наприклад: <code>15</code> або <code>10 20</code>):');
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
      `<b>Крок 4/9: Характеристики та переваги товару (до 10 шт.):</b>\n\n` +
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

  async promptWizardWarranty(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'warranty';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    const currentWarranty = session.data.warranty || '1 місяць';

    const buttons = [
      [
        { text: currentWarranty === '1 місяць' ? '🛡 1 місяць (Стандарт)' : '🛡 1 місяць', callback_data: 'wiz_warranty:1 місяць' },
        { text: currentWarranty === '3 місяці' ? '🛡 3 місяці (Розширена)' : '🛡 3 місяці', callback_data: 'wiz_warranty:3 місяці' }
      ],
      [
        { text: '❌ Скасувати', callback_data: 'wiz_cancel' }
      ]
    ];

    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `🛡 <b>Крок 5/9: Оберіть термін гарантії на товар:</b>\n\n` +
      `• <b>1 місяць</b> — стандартна гарантія для більшості товарів.\n` +
      `• <b>3 місяці</b> — розширена гарантія для дорогих / преміальних девайсів.\n\n` +
      `<i>Оберіть потрібний варіант кнопкою:</i>`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async promptWizardPrice(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'price';

    const fullTitle = `${session.data.brand} ${session.data.title}`.trim();
    await this.safeEditOrSend(chatId, session.cardMsgId, `🏷 <b>Товар:</b> ${fullTitle}\n\n` +
      `<b>Крок 6/9: Вкажіть ціну товару (у гривнях):</b>\n\n` +
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
      `<b>Крок 7/9: Оберіть категорію товару:</b>\n` +
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
      `<b>Крок 8/9: Оберіть або введіть позначку / бейдж товару:</b>\n\n` +
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
      `<b>Крок 9/9: Оберіть кольори товару (однією плашкою з галочками):</b>\n\n` +
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

  async promptWizardMainPhotoColor(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'catalog_photo_color';

    const colors = session.data.colors || ['Black'];
    const buttons = [];
    colors.forEach(c => {
      buttons.push([{ text: `🎨 ${c}`, callback_data: `wiz_main_color:${c}` }]);
    });
    buttons.push([{ text: '⏩ Без прив\'язки до кольору', callback_data: 'wiz_main_color:SKIP' }]);
    buttons.push([{ text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }]);

    await this.safeEditOrSend(chatId, session.cardMsgId, `📸 <b>Головне фото успішно завантажено!</b>\n\n` +
      `🎨 <b>Оберіть колір, який зображений на цьому головному фото:</b>\n\n` +
      `<i>Це фото стане першим у галереї цього кольору, а в каталозі при перегляді товару буде автоматично вибрано цей колір.</i>`, {
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

    const colors = (session.data.colors && session.data.colors.length) ? session.data.colors : ['Black'];
    if (!session.data.color_quantities) session.data.color_quantities = {};

    if (!session.data.activeQtyColor || !colors.includes(session.data.activeQtyColor)) {
      session.data.activeQtyColor = colors[0];
    }
    const curColor = session.data.activeQtyColor;

    let colorListFormatted = '';
    colors.forEach((c, idx) => {
      const qVal = session.data.color_quantities[c];
      const isSelected = c === curColor;
      const statusStr = (qVal !== undefined && qVal !== null) ? `<b>${qVal} шт.</b>` : '<i>В наявності</i>';
      const pointer = isSelected ? '👉 ' : '   ';
      colorListFormatted += `${pointer}${idx + 1}. <b>${c}</b>: ${statusStr}\n`;
    });

    const buttons = [];

    // Color selector buttons if > 1 color
    if (colors.length > 1) {
      const colRow = [];
      colors.forEach(c => {
        const isSel = c === curColor;
        const qVal = session.data.color_quantities[c];
        const qBadge = qVal !== undefined ? ` (${qVal} шт.)` : '';
        colRow.push({
          text: isSel ? `🔘 ${c}${qBadge}` : `${c}${qBadge}`,
          callback_data: `wiz_qty_sel:${c}`
        });
      });
      buttons.push(colRow);
    }

    // Direct actions
    buttons.push([
      { text: '⏩ Пропустити (Всі кольори в наявності)', callback_data: 'wiz_qty_skip_all' }
    ]);
    buttons.push([
      { text: '✅ Підтвердити склад та перейти далі ➡️', callback_data: 'wiz_qty_confirm_done' }
    ]);
    buttons.push([
      { text: '❌ Скасувати створення', callback_data: 'wiz_cancel' }
    ]);

    const text = `📦 <b>Крок 8/8: Склад та наявність для кольорів</b>\n\n` +
      `📋 <b>Поточна наявність за кольорами:</b>\n${colorListFormatted}\n` +
      `🎯 Зараз обрано для введення: <b>«${curColor}»</b>\n\n` +
      `💡 <b>Як вказати залишок:</b>\n` +
      `• Надішліть число текстом у чат (наприклад: <code>15</code> або <code>10 20 15</code> для всіх кольорів одразу).\n` +
      `• Або натисніть <b>«⏩ Пропустити (Всі кольори в наявності)»</b> — всі кольори будуть увімкнені та активні на сайті зі статусом «В наявності»!\n` +
      `• Після завершення натисніть <b>«✅ Підтвердити склад та перейти далі ➡️»</b>:`;

    await this.safeEditOrSend(chatId, session.cardMsgId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async showWizardConfirm(chatId) {
    const session = this.adminSessions[chatId];
    if (!session) return;
    session.step = 'confirm';

    const d = session.data;
    const colorsList = (d.colors && d.colors.length) ? d.colors : ['Black'];
    let hasCustomQty = false;
    let totalQty = 0;
    
    let colorSummary = '';
    colorsList.forEach(c => {
      const rawQ = d.color_quantities?.[c];
      if (rawQ !== undefined && rawQ !== null) {
        hasCustomQty = true;
        totalQty += Number(rawQ);
      } else {
        totalQty += 25;
      }
      const qDisplay = (rawQ !== undefined && rawQ !== null) ? `${rawQ} шт.` : 'В наявності';
      const photoCount = (d.color_images?.[c]?.gallery || []).length || (d.color_images?.[c]?.main ? 1 : 0);
      const photoInfo = photoCount > 0 ? `📷 ${photoCount} фото` : '⚙️ Авто-фото';
      colorSummary += `  • <b>${c}</b>: <b>${qDisplay}</b> (${photoInfo})\n`;
    });

    let specsSummary = '';
    if (d.specs && d.specs.length > 0) {
      specsSummary = `\n📋 <b>Характеристики (${d.specs.length}):</b>\n` +
        d.specs.map(s => `  • <b>${s.key}:</b> ${s.value}`).join('\n') + `\n`;
    }

    const stockSummaryLine = hasCustomQty 
      ? `📦 <b>Загальний залишок:</b> <b>${totalQty} шт.</b>\n\n`
      : `📦 <b>Статус наявності:</b> <b>В наявності (активно на сайті)</b>\n\n`;

    const text = `✨ <b>ПЕРЕВІРКА НОВОГО ТОВАРУ</b> ✨\n\n` +
      `🏷 <b>Бренд:</b> ${d.brand}\n` +
      `🎮 <b>Назва:</b> <b>${d.title}</b>\n` +
      `💰 <b>Ціна:</b> <b>${d.price} ₴</b>\n` +
      `🛡 <b>Гарантія:</b> <b>${d.warranty || '1 місяць'}</b>\n` +
      `🗂 <b>Категорія:</b> ${d.category}\n` +
      `🏷 <b>Позначка / Бейдж:</b> <b>${d.tag || 'Без бейджа'}</b>\n` +
      `📝 <b>Опис:</b> <i>${(d.description || '').slice(0, 100)}${(d.description || '').length > 100 ? '...' : ''}</i>\n` +
      `${specsSummary}` +
      `🎨 <b>Варіанти кольорів, фото та склад:</b>\n${colorSummary}\n` +
      `${stockSummaryLine}` +
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
    
    // Fill color quantities ensuring none are 0 when unspecified/skipped
    const color_quantities = {};
    let totalQuantity = 0;
    colors.forEach(c => {
      const rawQ = d.color_quantities?.[c];
      const q = (rawQ !== undefined && rawQ !== null && rawQ !== '') ? Number(rawQ) : 25;
      const finalQ = q > 0 ? q : 25;
      color_quantities[c] = finalQ;
      totalQuantity += finalQ;
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
    const shortRand = Math.random().toString(36).slice(2, 6);
    const shortTime = Date.now().toString(36).slice(-4);
    const brandPrefix = (brand || 'p').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3) || 'p';
    const slugId = `p_${brandPrefix}_${shortTime}_${shortRand}`;

    const newProduct = {
      id: slugId,
      brand,
      title: fullTitle,
      price,
      old_price: d.old_price !== undefined ? d.old_price : null,
      warranty: d.warranty || '1 місяць',
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
      main_color: d.main_color || null,
      sku: `${brand.toUpperCase().slice(0, 3)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      featured: false,
      popular: true,
      hidden: false,
      created_at: new Date().toISOString()
    };

    db.addProduct(newProduct);
    db.addCategory(category);
    db.addBrand(brand);

    const appUrl = getStoreWebUrl();

    await this.safeEditOrSend(chatId, cardId, `🎉 <b>Товар успішно створено та опубліковано!</b>\n\n` +
      `🏷 <b>${newProduct.title}</b>\n` +
      `💰 Ціна: <b>${newProduct.price} ₴</b>\n` +
      `🗂 Категорія: <b>${newProduct.category}</b>\n` +
      `📦 Залишок: <b>${newProduct.quantity} шт.</b> (${colors.join(', ')})\n` +
      `🆔 Артикул: <code>${newProduct.sku}</code>\n\n` +
      `Товар уже доступний у каталозі магазину та готовий до замовлень!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Відкрити картку товару в боті', callback_data: `admin_prod_view:${newProduct.id}` }],
          [{ text: '🚀 Відкрити вітрину магазину', web_app: { url: appUrl } }],
          [{ text: '➕ Додати ще один товар', callback_data: 'add_new_product' }],
          [{ text: '📦 До каталогу товарів', callback_data: 'admin_catalog' }],
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
      { key: 'Матеріали', value: 'Преміальні зносостійкі матеріали' }
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
      const colorsList = this.normalizeColorsList(p.colors);
      const colorCount = colorsList.length;
      const specCount = Array.isArray(p.specs) ? p.specs.length : 0;
      const brandStr = escapeHtml(p.brand || 'MILIPSTORE');
      const titleStr = escapeHtml(p.title || 'Товар');
      const totalQty = (typeof p.quantity === 'number' && p.quantity > 0)
        ? p.quantity
        : (p.color_quantities ? Object.values(p.color_quantities).reduce((a, b) => a + Number(b || 0), 0) : 0);
      text += `🏷 <b>${brandStr} ${titleStr}</b>\n`;
      text += `• Ціна: <b>${p.price} ₴</b> | Залишок: <b>${totalQty} шт.</b> | Кольорів: ${colorCount} | Хар-к: ${specCount}\n\n`;

      buttons.push([
        { text: `✏️ ${p.brand || ''} ${p.title || ''} (${p.price} ₴)`.trim(), callback_data: `admin_prod_view:${p.id}` }
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

    const colorsList = this.normalizeColorsList(prod.colors);
    const specsList = Array.isArray(prod.specs) ? prod.specs : [];

    let specsFormatted = '<i>Не вказано</i>';
    if (specsList.length > 0) {
      specsFormatted = specsList.map((s, idx) => `  ${idx + 1}. <b>${escapeHtml(s.key)}:</b> ${escapeHtml(s.value)}`).join('\n');
    }

    let colorsFormatted = '';
    colorsList.forEach(c => {
      const q = prod.color_quantities?.[c] ?? Math.round((prod.quantity || 10) / (colorsList.length || 1));
      const photos = prod.color_images?.[c]?.gallery?.length || (prod.color_images?.[c]?.main ? 1 : 0);
      colorsFormatted += `  • <b>${escapeHtml(c)}</b>: ${q} шт. (📷 ${photos} фото)\n`;
    });

    const brandSafe = escapeHtml(prod.brand || '—');
    const titleSafe = escapeHtml(prod.title || '—');
    const descSafe = escapeHtml((prod.description || '').slice(0, 120)) + ((prod.description || '').length > 120 ? '...' : '');
    const catSafe = escapeHtml(prod.category || '—');
    const skuSafe = escapeHtml(prod.sku || '—');
    const tagSafe = escapeHtml(prod.tag || 'Без бейджа');

    const prodTotalQty = (typeof prod.quantity === 'number' && prod.quantity > 0)
      ? prod.quantity
      : (prod.color_quantities ? Object.values(prod.color_quantities).reduce((a, b) => a + Number(b || 0), 0) : 0);

    const oldPriceNum = (prod.old_price && Number(prod.old_price) > Number(prod.price)) ? Number(prod.old_price) : 0;
    const discountPct = oldPriceNum ? Math.round(((oldPriceNum - Number(prod.price)) / oldPriceNum) * 100) : 0;
    const priceDisplay = oldPriceNum
      ? `<b>${prod.price} ₴</b> <s>${oldPriceNum} ₴</s> (🔥 Знижка: <b>-${discountPct}%</b>)`
      : `<b>${prod.price} ₴</b>`;

    let text = `🎮 <b>КЕРУВАННЯ ТОВАРОМ</b>\n\n`;
    text += `🏷 <b>1. Бренд:</b> <b>${brandSafe}</b>\n`;
    text += `🎮 <b>2. Назва / модель:</b> <b>${titleSafe}</b>\n`;
    text += `📝 <b>3. Опис:</b> <i>${descSafe || 'Не вказано'}</i>\n`;
    text += `💰 <b>4. Ціна:</b> ${priceDisplay}\n`;
    text += `🛡 <b>5. Гарантія:</b> <b>${escapeHtml(prod.warranty || '1 місяць')}</b>\n`;
    text += `🗂 <b>Категорія:</b> <b>${catSafe}</b> | Артикул: <code>${skuSafe}</code>\n`;
    text += `🏷 <b>Позначка / Бейдж:</b> <b>${tagSafe}</b>\n\n`;
    text += `🎨 <b>6. Кольори та склад (${colorsList.length}):</b>\n${colorsFormatted || '  • Black'}\n`;
    text += `📦 <b>Загальний залишок:</b> <b>${prodTotalQty} шт.</b>\n\n`;
    text += `📋 <b>7. Характеристики (${specsList.length}/10):</b>\n${specsFormatted}\n\n`;
    const mainColStr = prod.main_color ? ` (Колір: <b>${escapeHtml(prod.main_color)}</b>)` : '';
    text += `📸 <b>8. Головне фото каталогу:</b> ${prod.img ? '✅ Встановлено' : '⚙️ Стандартне'}${mainColStr}\n`;
    text += `🖼 <b>9. Фото кольорів:</b> Налаштовано окремо для кожного кольору\n\n`;
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
        { text: '🛡 5. Гарантія', callback_data: `edit_prod_field:${prod.id}:warranty` },
        { text: '🏷 6. Позначка / Бейдж', callback_data: `edit_prod_field:${prod.id}:tag` }
      ],
      [
        { text: '🎨 7. Кольори', callback_data: `edit_prod_field:${prod.id}:colors` },
        { text: '📋 8. Характеристики', callback_data: `edit_prod_field:${prod.id}:specs` }
      ],
      [
        { text: '📸 9. Головне фото', callback_data: `edit_prod_field:${prod.id}:main_photo` },
        { text: '🖼 10. Фото кольорів', callback_data: `edit_prod_field:${prod.id}:color_photos` }
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
        tempColors: this.normalizeColorsList(prod.colors),
        tempSpecs: Array.isArray(prod.specs) ? JSON.parse(JSON.stringify(prod.specs)) : [],
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
        `Поточний бренд: <b>${escapeHtml(prod.brand)}</b>\n\n` +
        `<i>Оберіть бренд кнопкою або надішліть назву текстом у чат:</i>`, {
        reply_markup: { inline_keyboard: brandButtons }
      });
      return;
    }

    // 2. TITLE
    if (field === 'title') {
      await this.safeEditOrSend(chatId, cardId, `🎮 <b>Редагування назви / моделі товару:</b>\n` +
        `Поточна назва: <b>${escapeHtml(prod.title)}</b>\n\n` +
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
        `Поточний опис:\n<i>${escapeHtml(prod.description || 'Не вказано')}</i>\n\n` +
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

    // 4. PRICE & DISCOUNTS
    if (field === 'price') {
      const curOldPrice = (prod.old_price && Number(prod.old_price) > Number(prod.price)) ? Number(prod.old_price) : null;
      const discountPct = curOldPrice ? Math.round(((curOldPrice - Number(prod.price)) / curOldPrice) * 100) : 0;
      
      const priceStatusText = curOldPrice
        ? `🔥 <b>Активна акційна ціна:</b> <b>${prod.price} ₴</b>\n` +
          `🏷 <b>Стара базова ціна:</b> <s>${curOldPrice} ₴</s> (Знижка: <b>-${discountPct}%</b>)`
        : `💰 <b>Поточна ціна:</b> <b>${prod.price} ₴</b> (без знижки)`;

      const inlineKeyboard = [
        [
          { text: '🏷 Знижка -10%', callback_data: `edit_prod_cb:${prodId}:price_discount:10` },
          { text: '🏷 Знижка -15%', callback_data: `edit_prod_cb:${prodId}:price_discount:15` },
          { text: '🏷 Знижка -20%', callback_data: `edit_prod_cb:${prodId}:price_discount:20` }
        ],
        [
          { text: '🏷 Знижка -25%', callback_data: `edit_prod_cb:${prodId}:price_discount:25` },
          { text: '🎯 Вказати акційну ціну', callback_data: `edit_prod_cb:${prodId}:price_discount:custom_promo` }
        ]
      ];

      if (curOldPrice) {
        inlineKeyboard.push([
          { text: '❌ Прибрати знижку (скинути стару ціну)', callback_data: `edit_prod_cb:${prodId}:price_discount:clear` }
        ]);
      }

      inlineKeyboard.push([
        { text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }
      ]);

      await this.safeEditOrSend(chatId, cardId, `💰 <b>Редагування ціни та акцій товару:</b>\n\n` +
        `🏷 Товар: <b>${escapeHtml(prod.brand)} ${escapeHtml(prod.title)}</b>\n` +
        `${priceStatusText}\n\n` +
        `<i>Щоб встановити чисту базову ціну, надішліть число у чат (наприклад: <code>1899</code>).\nАбо скористайтеся кнопками швидкої знижки / акції нижче:</i>`, {
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
      return;
    }

    // 5. WARRANTY
    if (field === 'warranty') {
      const curW = prod.warranty || '1 місяць';
      const warrantyButtons = [
        [
          { text: curW === '1 місяць' ? '🛡 ✅ 1 місяць (Поточна)' : '🛡 1 місяць', callback_data: `edit_prod_cb:${prodId}:warranty:1 місяць` },
          { text: curW === '3 місяці' ? '🛡 ✅ 3 місяці (Поточна)' : '🛡 3 місяці', callback_data: `edit_prod_cb:${prodId}:warranty:3 місяці` }
        ],
        [{ text: '🔙 Назад до товару', callback_data: `admin_prod_view:${prodId}` }]
      ];

      await this.safeEditOrSend(chatId, cardId, `🛡 <b>Редагування гарантії для товару:</b>\n\n` +
        `Товар: <b>${escapeHtml(prod.brand)} ${escapeHtml(prod.title)}</b>\n` +
        `Поточна гарантія: <b>${escapeHtml(curW)}</b>\n\n` +
        `<i>Оберіть термін гарантії кнопкою:</i>`, {
        reply_markup: { inline_keyboard: warrantyButtons }
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
      const colorsList = this.normalizeColorsList(prod.colors);
      const colorBtns = [];
      colorsList.forEach(c => {
        const isSelected = prod.main_color === c;
        colorBtns.push([{
          text: `🎨 Прив'язати до кольору: ${c} ${isSelected ? '✅' : ''}`,
          callback_data: `edit_prod_cb:${prodId}:main_photo_color:${c}`
        }]);
      });

      if (prod.main_color) {
        colorBtns.push([{
          text: '❌ Зняти прив\'язку до кольору',
          callback_data: `edit_prod_cb:${prodId}:main_photo_color:CLEAR`
        }]);
      }

      colorBtns.push([{ text: '🔙 Скасувати та повернутися', callback_data: `admin_prod_view:${prodId}` }]);

      const mainColText = prod.main_color ? `<b>${escapeHtml(prod.main_color)}</b>` : '<i>Не прив\'язано</i>';

      await this.safeEditOrSend(chatId, cardId, `📸 <b>Головне фото каталогу та його колір:</b>\n\n` +
        `• Поточне фото: <code>${escapeHtml(prod.img || 'немає')}</code>\n` +
        `• Прив'язаний колір: ${mainColText}\n\n` +
        `<i>Оберіть кнопкою нижче колір, який зображений на цьому головному фото (щоб при відкритті товару з каталогу автоматично відкривався саме цей колір):\nАбо надішліть нове фото файлом чи посиланням у цей чат:</i>`, {
        reply_markup: {
          inline_keyboard: colorBtns
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
        `Поточний бейдж: <b>${escapeHtml(prod.tag || 'Не встановлено')}</b>\n\n` +
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
      `Обрані кольори: <b>${escapeHtml(selected.join(', ') || 'не обрано')}</b>\n\n` +
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
      specsListFormatted = specs.map((s, idx) => `  ${idx + 1}. <b>${escapeHtml(s.key)}:</b> ${escapeHtml(s.value)}`).join('\n') + '\n';
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

    const colors = this.normalizeColorsList(prod.colors);
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

    // 4. Price discounts & promo presets
    if (action === 'price_discount') {
      if (param === 'clear') {
        if (prod.old_price && Number(prod.old_price) > Number(prod.price)) {
          prod.price = Number(prod.old_price);
        }
        prod.old_price = null;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, messageId);
        return;
      }

      if (param === 'custom_promo') {
        session.isCustomPromo = true;
        await this.safeEditOrSend(chatId, messageId, `🎯 <b>Встановлення акційної ціни:</b>\n\n` +
          `Товар: <b>${escapeHtml(prod.brand)} ${escapeHtml(prod.title)}</b>\n` +
          `Поточна базова ціна: <b>${prod.price} ₴</b>\n\n` +
          `<i>Введіть нову знижену ціну (лише число, наприклад: <code>1499</code>):</i>\n\n` +
          `• Поточна ціна (${prod.price} ₴) стане закресленою старою ціною.\n` +
          `• Відсоток знижки буде вирахувано автоматично!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Скасувати та повернутися', callback_data: `edit_prod_field:${prodId}:price` }]
            ]
          }
        });
        return;
      }

      const percent = parseInt(param, 10);
      if (!isNaN(percent) && percent > 0) {
        const basePrice = (prod.old_price && Number(prod.old_price) > Number(prod.price))
          ? Number(prod.old_price)
          : Number(prod.price);
        const discountedPrice = Math.round((basePrice * (100 - percent) / 100) / 10) * 10;
        prod.old_price = basePrice;
        prod.price = discountedPrice;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, messageId);
        return;
      }
    }

    // 5. Warranty preset chosen
    if (action === 'warranty') {
      prod.warranty = param || '1 місяць';
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

    // 7. Main Photo Auto & Main Photo Color Binding
    if (action === 'main_photo_color') {
      const selectedColor = param;
      if (selectedColor === 'CLEAR') {
        prod.main_color = null;
      } else {
        prod.main_color = selectedColor;
        if (!prod.color_images) prod.color_images = {};
        if (!prod.color_images[selectedColor]) {
          prod.color_images[selectedColor] = { main: prod.img, gallery: [prod.img] };
        } else {
          if (prod.img) {
            prod.color_images[selectedColor].main = prod.img;
            if (!prod.color_images[selectedColor].gallery) prod.color_images[selectedColor].gallery = [];
            const filteredGal = prod.color_images[selectedColor].gallery.filter(g => g !== prod.img);
            prod.color_images[selectedColor].gallery = [prod.img, ...filteredGal];
          }
        }
      }
      db.save();
      await this.startEditProductField(chatId, prodId, 'main_photo', messageId);
      return;
    }

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

    const text = (msg.text || '').trim();

    // If command or cancel text, cancel field edit session gracefully
    if (text.startsWith('/') || text === '❌ Скасувати' || text === 'Скасувати') {
      delete this.adminSessions[chatId];
      return;
    }

    const prodId = session.prodId;
    const field = session.field;
    const cardId = session.cardMsgId;

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
        if (session.isCustomPromo) {
          const basePrice = (prod.old_price && Number(prod.old_price) > Number(prod.price))
            ? Number(prod.old_price)
            : Number(prod.price);
          if (num < basePrice) {
            prod.old_price = basePrice;
            prod.price = num;
          } else {
            prod.price = num;
            prod.old_price = null;
          }
        } else {
          // Standard clean base price setting
          prod.price = num;
          prod.old_price = null;
        }
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      } else {
        await this.safeEditOrSend(chatId, cardId, `⚠️ Введіть коректну ціну числом (наприклад: <code>1899</code>):`);
      }
      return;
    }

    // 5. WARRANTY
    if (field === 'warranty') {
      if (text) {
        let wVal = text;
        if (text === '1' || text.toLowerCase().includes('1') || text.toLowerCase().includes('один')) {
          wVal = '1 місяць';
        } else if (text === '3' || text.toLowerCase().includes('3') || text.toLowerCase().includes('три')) {
          wVal = '3 місяці';
        }
        prod.warranty = wVal;
        db.save();
        delete this.adminSessions[chatId];
        await this.sendAdminProductView(chatId, prodId, cardId);
      }
      return;
    }

    // 6. COLORS - Custom text input
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

        if (prod.main_color) {
          if (!prod.color_images) prod.color_images = {};
          if (!prod.color_images[prod.main_color]) {
            prod.color_images[prod.main_color] = { main: photoUrl, gallery: [photoUrl] };
          } else {
            prod.color_images[prod.main_color].main = photoUrl;
            if (!prod.color_images[prod.main_color].gallery) prod.color_images[prod.main_color].gallery = [];
            const filteredGal = prod.color_images[prod.main_color].gallery.filter(g => g !== photoUrl);
            prod.color_images[prod.main_color].gallery = [photoUrl, ...filteredGal];
          }
        }

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

  // ----------------------------------------------------
  // Popular Brands Admin Management
  // ----------------------------------------------------
  async sendAdminBrands(chatId, messageId = null) {
    const brands = db.getBrands(true); // include hidden

    let text = `🌟 <b>Керування популярними брендами</b>\n\n`;
    text += `Ці бренди відображаються у рухомому рядку (каруселі) на головній сторінці сайту.\n`;
    text += `Усього брендів: <b>${brands.length}</b>\n\n`;

    if (brands.length === 0) {
      text += `<i>Список брендів порожній. Натисніть «➕ Додати новий бренд», щоб додати перший бренд.</i>`;
    } else {
      brands.forEach((b, idx) => {
        const status = b.hidden ? '🙈 Приховано' : '✅ Активний';
        const hasLogo = b.logo ? '🖼 Є фото' : '❌ Без фото';
        text += `${idx + 1}. <b>${b.name}</b> — ${status} (${hasLogo})\n`;
      });
    }

    const buttons = [];
    // Brand buttons
    for (let i = 0; i < brands.length; i += 2) {
      const row = [];
      const b1 = brands[i];
      row.push({ text: `🌟 ${b1.name}`, callback_data: `admin_brand_view:${b1.id}` });
      if (i + 1 < brands.length) {
        const b2 = brands[i + 1];
        row.push({ text: `🌟 ${b2.name}`, callback_data: `admin_brand_view:${b2.id}` });
      }
      buttons.push(row);
    }

    buttons.push([
      { text: '➕ Додати новий бренд', callback_data: 'admin_brand_add' }
    ]);
    buttons.push([
      { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
    ]);

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async sendAdminBrandView(chatId, brandId, messageId = null) {
    const brand = db.getBrandById(brandId);
    if (!brand) {
      await this.safeEditOrSend(chatId, messageId, '❌ Бренд не знайдено.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🌟 До списку брендів', callback_data: 'admin_brands' }]]
        }
      });
      return;
    }

    const status = brand.hidden ? '🙈 Прихований (не показується на сайті)' : '✅ Активний (відображається в рядку брендів)';
    let text = `🌟 <b>Налаштування бренду</b>\n\n` +
      `🏷 Назва: <b>${brand.name}</b>\n` +
      `👁 Стан: <b>${status}</b>\n` +
      `🖼 Фото / логотип: <code>${brand.logo || 'не вказано'}</code>\n\n` +
      `<i>Оберіть дію нижче:</i>`;

    const buttons = [
      [
        { text: '🖼 Змінити фото / логотип', callback_data: `admin_brand_edit_photo:${brand.id}` },
        { text: '✏️ Змінити назву', callback_data: `admin_brand_edit_name:${brand.id}` }
      ],
      [
        { text: brand.hidden ? '👁 Показати на сайті' : '🙈 Приховати на сайті', callback_data: `admin_brand_toggle:${brand.id}` },
        { text: '🗑 Видалити бренд', callback_data: `admin_brand_delete_prompt:${brand.id}` }
      ],
      [
        { text: '🔙 До списку брендів', callback_data: 'admin_brands' },
        { text: '👑 До адмін-панелі', callback_data: 'admin_dashboard' }
      ]
    ];

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async startBrandPhotoEdit(chatId, brandId, messageId = null) {
    const brand = db.getBrandById(brandId);
    if (!brand) return;

    this.adminSessions[chatId] = {
      action: 'brand_edit_photo',
      brandId: brand.id,
      msgId: messageId
    };

    const text = `🖼 <b>Оновлення фото для бренду «${brand.name}»</b>\n\n` +
      `Поточне фото: <code>${brand.logo || 'відсутнє'}</code>\n\n` +
      `📷 <b>Надішліть нове фото файлом/картинкою в чат</b> або надішліть посилання / імʼя файлу (наприклад: <code>/shark.jpg</code>, <code>/aula.png</code>):\n\n` +
      `<i>Або натисніть «❌ Скасувати»:</i>`;

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: `admin_brand_view:${brand.id}` }]]
      }
    });
  }

  async startBrandNameEdit(chatId, brandId, messageId = null) {
    const brand = db.getBrandById(brandId);
    if (!brand) return;

    this.adminSessions[chatId] = {
      action: 'brand_edit_name',
      brandId: brand.id,
      msgId: messageId
    };

    const text = `✏️ <b>Редагування назви бренду</b>\n\n` +
      `Поточна назва: <b>${brand.name}</b>\n\n` +
      `Надішліть нову назву бренду повідомленням у чат:`;

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: `admin_brand_view:${brand.id}` }]]
      }
    });
  }

  async startBrandAdd(chatId, messageId = null) {
    this.adminSessions[chatId] = {
      action: 'brand_add',
      step: 'brand_name',
      msgId: messageId,
      data: {}
    };

    const text = `➕ <b>Додавання нового бренду</b>\n\n` +
      `Введіть назву бренду текстом у чат (наприклад: <i>Attack Shark, Darmoshark, Lamzu, Ninjutso</i>):`;

    await this.safeEditOrSend(chatId, messageId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'admin_brands' }]]
      }
    });
  }

  async handleBrandMessage(chatId, from, msg) {
    const session = this.adminSessions[chatId];
    if (!session) return;

    const text = (msg.text || '').trim();

    // If command or cancel text, cancel brand edit session gracefully
    if (text.startsWith('/') || text === '❌ Скасувати' || text === 'Скасувати') {
      delete this.adminSessions[chatId];
      return;
    }

    if (msg.message_id) {
      await this.safeDeleteMessage(chatId, msg.message_id);
    }

    // 1. Edit brand photo
    if (session.action === 'brand_edit_photo') {
      const brandId = session.brandId;
      let photoUrl = '';
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
        if (fileRes.ok && fileRes.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
        }
      } else if (text) {
        photoUrl = text;
      }

      if (photoUrl) {
        db.updateBrand(brandId, { logo: photoUrl });
        delete this.adminSessions[chatId];
        await this.sendAdminBrandView(chatId, brandId, session.msgId);
        return;
      }

      await this.safeEditOrSend(chatId, session.msgId, '⚠️ Будь ласка, надішліть фото або посилання на зображення:');
      return;
    }

    // 2. Edit brand name
    if (session.action === 'brand_edit_name') {
      const brandId = session.brandId;
      if (!text) {
        await this.safeEditOrSend(chatId, session.msgId, '⚠️ Введіть коректну назву бренду:');
        return;
      }

      db.updateBrand(brandId, { name: text });
      delete this.adminSessions[chatId];
      await this.sendAdminBrandView(chatId, brandId, session.msgId);
      return;
    }

    // 3. Add brand flow
    if (session.action === 'brand_add') {
      if (session.step === 'brand_name') {
        if (!text) {
          await this.safeEditOrSend(chatId, session.msgId, '⚠️ Введіть коректну назву бренду:');
          return;
        }

        session.data.name = text;
        session.step = 'brand_photo';

        const promptText = `🖼 <b>Фото / логотип для бренду «${text}»</b>\n\n` +
          `Надішліть фото файлом/картинкою у чат, або пряме посилання/імʼя файлу (наприклад: <code>/shark.jpg</code>):\n\n` +
          `<i>Або надішліть «-» чи «пропустити», щоб створити без фото:</i>`;

        await this.safeEditOrSend(chatId, session.msgId, promptText, {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'admin_brands' }]]
          }
        });
        return;
      }

      if (session.step === 'brand_photo') {
        let photoUrl = '';
        if (msg.photo && msg.photo.length > 0) {
          const largest = msg.photo[msg.photo.length - 1];
          const fileRes = await this.callApi('getFile', { file_id: largest.file_id });
          if (fileRes.ok && fileRes.result?.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
          }
        } else if (text && text !== '-' && text.toLowerCase() !== 'пропустити') {
          photoUrl = text;
        }

        const newBrand = db.addBrand({
          name: session.data.name,
          logo: photoUrl || ''
        });

        delete this.adminSessions[chatId];
        await this.sendAdminBrands(chatId, session.msgId);
        return;
      }
    }
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
