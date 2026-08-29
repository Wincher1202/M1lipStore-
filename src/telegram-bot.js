import fetch from 'node-fetch';
import { db } from './db.js';

export const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || 'TEST:PAYMENT_PROVIDER_TOKEN_M1LIPSTORE';

class TelegramBotService {
  constructor() {
    this.token = process.env.BOT_TOKEN || '8993086388:AAGQiOpnHz53o9C2N0MVg39hTPZsXaRA1kA';
    this.botInfo = { first_name: 'M1lipStore Bot' };
    this.username = process.env.BOT_USERNAME || 'm1lipstore_bot';
    // Store wizard sessions in memory or db
    this.wizardSessions = {};
  }

  getBotUsername() {
    return this.username;
  }

  async handleUpdate(body) {
    if (!body) return true;

    if (body.message) {
      await this.handleMessage(body.message);
    } else if (body.callback_query) {
      await this.handleCallbackQuery(body.callback_query);
    }
    return true;
  }

  async callApi(method, payload) {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) return data.result;
    } catch (e) {
      console.warn(`[TelegramBot] API ${method} error:`, e.message);
    }
    return null;
  }

  async deleteMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    await this.callApi('deleteMessage', { chat_id: chatId, message_id: messageId });
  }

  async sendMessage(chatId, text, replyMarkup = null, parseMode = 'HTML') {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: parseMode
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await this.callApi('sendMessage', payload);
    return res?.message_id;
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const userId = msg.from?.id;

    // Check if user is admin
    const admins = db.data.admin_ids || [];
    const isAdmin = admins.includes(String(userId)) || admins.includes(Number(userId));

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const param = parts[1];
        if (param.startsWith('order_') || param.startsWith('pay_')) {
          const orderId = param.replace(/^(order_|pay_)/, '');
          const order = db.getOrderById(orderId);
          if (order) {
            await this.sendMessage(chatId, `📦 <b>Замовлення #${order.order_id}</b>\nСума: <b>${order.total} грн</b>\nСтатус: ${order.status_name}`);
          }
        }
      } else {
        await this.sendMessage(chatId, `👋 Вітаємо в <b>M1lipStore Bot</b>!\nВикористовуйте веб-додаток магазину для покупок.`);
      }
      return;
    }

    // Handle wizard input if active
    const session = this.wizardSessions[userId];
    if (session && session.step === 8) {
      // Step 8: color quantity input
      const qty = parseInt(text, 10);
      if (!isNaN(qty) && qty >= 0) {
        const currentColor = session.currentColor || 'Default';
        if (!session.colorQuantities) session.colorQuantities = {};
        session.colorQuantities[currentColor] = qty;

        // Clean up user message if possible
        await this.deleteMessage(chatId, msg.message_id);
        if (session.lastBotMessageId) {
          await this.deleteMessage(chatId, session.lastBotMessageId);
        }

        // Render step 8 again or proceed
        await this.renderStep8(chatId, userId, session);
      } else {
        await this.sendMessage(chatId, `⚠️ Будь ласка, введіть коректне число для кількості.`);
      }
    }
  }

  async handleCallbackQuery(cq) {
    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;
    const data = cq.data;
    const userId = cq.from.id;

    await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });

    // Clean up current message to avoid clutter
    await this.deleteMessage(chatId, messageId);

    const session = this.wizardSessions[userId] || { step: 8, colors: ['Black', 'Red'], colorQuantities: { 'Black': 5, 'Red': 0 } };

    if (data === 'wizard_confirm') {
      delete this.wizardSessions[userId];
      await this.sendMessage(chatId, `✅ <b>Товар успішно створено та додано до каталогу M1lipStore!</b>`);
      return;
    }

    if (data === 'wizard_skip') {
      delete this.wizardSessions[userId];
      await this.sendMessage(chatId, `⏩ Створення товару пропущено.`);
      return;
    }

    if (data === 'wizard_cancel') {
      delete this.wizardSessions[userId];
      await this.sendMessage(chatId, `❌ Створення товару скасовано.`);
      return;
    }

    if (data.startsWith('color_select_')) {
      const color = data.replace('color_select_', '');
      session.currentColor = color;
      this.wizardSessions[userId] = session;
      await this.renderStep8(chatId, userId, session);
      return;
    }
  }

  async renderStep8(chatId, userId, session) {
    const colors = session.colors || ['Black', 'Red'];
    const quantities = session.colorQuantities || {};
    const currentColor = session.currentColor || colors[0];

    let text = `📦 <b>Крок 8/8: Склад та наявність для кольорів</b>\n\n` +
      `Поточний колір: <b>${currentColor}</b> (Кількість: <b>${quantities[currentColor] || 0} шт.</b>)\n\n` +
      `Введіть кількість товарів для обраного кольору в чат або оберіть колір нижче:`;

    const inlineKeyboard = [];

    const colorRow = colors.map(c => {
      const q = quantities[c] || 0;
      const isSelected = c === currentColor;
      const label = `${isSelected ? '🔘 ' : '⚪ '}${c} (${q})`;
      return { text: label, callback_data: `color_select_${c}` };
    });
    for (let i = 0; i < colorRow.length; i += 2) {
      inlineKeyboard.push(colorRow.slice(i, i + 2));
    }

    inlineKeyboard.push([
      { text: '⏩ Пропустити...', callback_data: 'wizard_skip' },
      { text: '✅ Підтвердити...', callback_data: 'wizard_confirm' }
    ]);
    inlineKeyboard.push([
      { text: '❌ Скасувати...', callback_data: 'wizard_cancel' }
    ]);

    const msgId = await this.sendMessage(chatId, text, { inline_keyboard: inlineKeyboard });
    if (msgId) {
      session.lastBotMessageId = msgId;
      session.step = 8;
      this.wizardSessions[userId] = session;
    }
  }

  async createInvoiceLink(order) {
    if (!this.token) {
      return `https://t.me/${this.username}?start=pay_${order.order_id}`;
    }
    try {
      const res = await this.callApi('createInvoiceLink', {
        title: `Замовлення #${order.order_id}`,
        description: `Оплата замовлення в M1lipStore (${order.items.length} товарів)`,
        payload: `order_${order.order_id}`,
        provider_token: PAYMENT_PROVIDER_TOKEN,
        currency: 'UAH',
        prices: [
          { label: 'Товари', amount: Math.round(order.subtotal * 100) },
          ...(order.cod_fee ? [{ label: 'Комісія / Доставка', amount: Math.round(order.cod_fee * 100) }] : [])
        ]
      });
      if (res) return res;
    } catch (e) {
      console.warn('[TelegramBot] createInvoiceLink error:', e.message);
    }
    return `https://t.me/${this.username}?start=pay_${order.order_id}`;
  }

  async sendOrderCreatedNotifications(order) {
    if (order.customer?.telegram_id) {
      const text = `🛍 <b>Ваше замовлення #${order.order_id} успішно створено!</b>\n\n` +
        `Сума до сплати: <b>${order.total} грн</b>\n` +
        `Статус: ${order.payment.method === 'online' ? 'Очікує онлайн-оплати' : 'Накладений платіж'}`;
      await this.sendMessage(order.customer.telegram_id, text);
    }
  }

  async sendCustomerPaymentSuccess(order) {
    if (order.customer?.telegram_id) {
      const text = `✅ <b>Оплата за замовлення #${order.order_id} успішно отримана!</b>\nДякуємо за покупку в M1lipStore!`;
      await this.sendMessage(order.customer.telegram_id, text);
    }
  }

  async sendAdminPaymentSuccess(order) {
    // Admin notifications
  }

  async notifyCustomerStatusChange(order, status, ttn) {
    if (order.customer?.telegram_id) {
      let text = `📦 <b>Статус замовлення #${order.order_id} змінено!</b>\nНовий статус: <b>${status}</b>`;
      if (ttn) {
        text += `\n\nНомер ТТН (Нова Пошта): <code>${ttn}</code>`;
      }
      await this.sendMessage(order.customer.telegram_id, text);
    }
  }
}

export const botService = new TelegramBotService();
