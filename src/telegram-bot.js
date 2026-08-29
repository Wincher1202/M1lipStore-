import { db, ORDER_STATUSES } from './db.js';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
export const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '1877036958:TEST:3ee3e1f439bade2f14881b4f9a87c61392fa6ec6';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

class TelegramBotService {
  constructor() {
    this.pollingActive = false;
    this.lastUpdateId = 0;
    this.botInfo = null;
  }

  async callApi(method, body = {}) {
    if (!BOT_TOKEN) {
      // Mock logging when no token configured yet
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
        // Sleep briefly on connection error
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

    if (text.startsWith('/start') || text === '🌐 Відкрити магазин') {
      const appUrl = process.env.PUBLIC_APP_URL || 'https://m1lipstore.ua';
      const welcomeText = `👋 <b>Вітаємо в офіційному боті MILIPSTORE!</b>\n\n🎮 <b>MILIPSTORE</b> — преміальні ігрові девайси та техніка для сетапу:\n• Ультралегкі мишки (Attack Shark, Ajazz, Mchose, VGN)\n• Кастомні механічні клавіатури з Gasket Mount\n• Професійні ігрові поверхні Cordura Control\n\nОформлюйте замовлення зручно та відстежуйте їхній статус просто тут!`;

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '🛍 Мої замовлення' }, { text: '🌐 Відкрити магазин' }],
            [{ text: '📦 Відстежити замовлення' }, { text: '💬 Підтримка' }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    if (text === '🛍 Мої замовлення' || text === '/orders') {
      await this.sendCustomerOrdersList(chatId, from.id);
      return;
    }

    if (text === '📦 Відстежити замовлення') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `🔍 <b>Відстеження замовлення</b>\n\nВведіть номер вашого замовлення (наприклад, <code>MLP-120009</code>):`,
        parse_mode: 'HTML'
      });
      return;
    }

    if (text === '💬 Підтримка') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💬 <b>Служба турботи MILIPSTORE</b>\n\nГрафік роботи: Щодня з 09:00 до 21:00.\nТелеграм менеджера: @milip_support\nТелефон: +38 (067) 000-00-00\n\nМи з радістю відповімо на будь-які ваші запитання!`,
        parse_mode: 'HTML'
      });
      return;
    }

    // If message is order ID format
    if (/^(#?MLP-?\d{5,8})$/i.test(text)) {
      const order = db.getOrderById(text);
      if (order) {
        await this.sendSingleOrderCard(chatId, order);
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ Замовлення з номером <b>${text}</b> не знайдено. Перевірте правильність номера та спробуйте ще раз.`,
          parse_mode: 'HTML'
        });
      }
      return;
    }
  }

  async handleCallbackQuery(cb) {
    const data = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const msgId = cb.message?.message_id;

    await this.callApi('answerCallbackQuery', { callback_query_id: cb.id });

    if (data.startsWith('view_order:')) {
      const orderId = data.replace('view_order:', '').trim();
      const order = db.getOrderById(orderId);
      if (order) {
        await this.sendSingleOrderCard(chatId, order);
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ Замовлення #${orderId} не знайдено.`,
          parse_mode: 'HTML'
        });
      }
    } else if (data.startsWith('orders_list:')) {
      const userId = data.replace('orders_list:', '').trim();
      await this.sendCustomerOrdersList(chatId, userId);
    }
  }

  async handlePreCheckoutQuery(pcq) {
    // Telegram Payments pre-checkout verification
    console.log(`[TelegramBot] Pre-checkout query received for ${pcq.invoice_payload}`);
    await this.callApi('answerPreCheckoutQuery', {
      pre_checkout_query_id: pcq.id,
      ok: true
    });
  }

  // Formatting & Sending
  formatOrderSummary(order) {
    const itemsList = order.items.map(i => {
      const colorStr = i.color ? ` (${i.color})` : '';
      return `• <b>${i.title}</b>${colorStr}\n  Кількість: ${i.qty} шт. × ${i.price} ₴ = <b>${i.price * i.qty} ₴</b>`;
    }).join('\n');

    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const payment = order.payment || {};
    const statusName = order.status_name || ORDER_STATUSES[order.status]?.name || order.status;

    let statusEmoji = '📦';
    if (order.status === 'PENDING_PAYMENT') statusEmoji = '⏳';
    if (order.status === 'NEW' || order.status === 'CONFIRMED') statusEmoji = '✅';
    if (order.status === 'SHIPPED') statusEmoji = '🚚';
    if (order.status === 'DELIVERED') statusEmoji = '🏢';
    if (order.status === 'COMPLETED') statusEmoji = '🎉';
    if (order.status === 'CANCELLED') statusEmoji = '❌';

    const payStatus = payment.status === 'PAID' ? '✅ Оплачено онлайн' : (payment.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');

    let text = `🛍 <b>Замовлення #${order.order_id}</b>\n\n`;
    text += `<b>Статус:</b> ${statusEmoji} <b>${statusName}</b>\n`;
    if (order.tracking_number) {
      text += `<b>Номер ТТН:</b> <code>${order.tracking_number}</code>\n`;
    }
    text += `\n<b>Товари:</b>\n${itemsList}\n\n`;
    text += `<b>Покупець:</b>\n`;
    text += `• Ім'я: ${customer.first_name} ${customer.last_name || ''}\n`;
    text += `• Телефон: <code>${customer.phone || 'не вказано'}</code>\n`;
    if (customer.email) text += `• Email: ${customer.email}\n`;

    text += `\n<b>Доставка:</b>\n`;
    text += `• Служба: ${delivery.provider_name || (delivery.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова Пошта')}\n`;
    text += `• Місто: ${delivery.city}\n`;
    text += `• Пункт: ${delivery.department || delivery.address}\n`;

    text += `\n<b>Оплата:</b>\n`;
    text += `• Спосіб: ${payment.provider || (payment.method === 'online' ? 'Smart Glocal' : 'Накладений платіж')}\n`;
    text += `• Статус: ${payStatus}\n`;
    text += `\n💰 <b>Разом до сплати: ${order.total} ₴</b>\n`;
    text += `📅 <i>Дата: ${new Date(order.created_at).toLocaleString('uk-UA')}</i>`;

    return text;
  }

  async sendSingleOrderCard(chatId, order) {
    const text = this.formatOrderSummary(order);
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '🔄 Оновити статус', callback_data: `view_order:${order.order_id}` }],
        [{ text: '🛍 До списку всіх замовлень', callback_data: `orders_list:${chatId}` }]
      ]
    };

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });
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

    let text = `🛍 <b>Мої замовлення (${orders.length}):</b>\n\n`;
    const buttons = [];

    orders.slice(0, 5).forEach((o, idx) => {
      let emoji = '📦';
      if (o.status === 'PENDING_PAYMENT') emoji = '⏳';
      if (o.status === 'SHIPPED') emoji = '🚚';
      if (o.status === 'COMPLETED') emoji = '🎉';
      if (o.status === 'CANCELLED') emoji = '❌';

      const itemsSummary = o.items.map(i => `${i.qty} × ${i.title}${i.color ? ' (' + i.color + ')' : ''}`).join(', ');

      text += `<b>#${o.order_id}</b>\n`;
      text += `• ${itemsSummary}\n`;
      text += `• Сума: <b>${o.total} ₴</b> • ${o.delivery?.provider_name || 'Нова Пошта'}\n`;
      text += `• Статус: ${emoji} <b>${o.status_name || o.status}</b>\n`;
      if (o.tracking_number) text += `• ТТН: <code>${o.tracking_number}</code>\n`;
      text += `\n`;

      buttons.push([{
        text: `🔍 Замовлення #${o.order_id} (${o.total} ₴)`,
        callback_data: `view_order:${o.order_id}`
      }]);
    });

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // Trigger Notifications: New Order
  async sendOrderCreatedNotifications(order) {
    db.addNotification({
      type: 'ORDER_CREATED',
      order_id: order.order_id,
      total: order.total,
      customer: `${order.customer?.first_name} ${order.customer?.last_name || ''}`,
      status: order.status
    });

    // Notify Customer in Telegram if customer has telegram_id
    if (order.customer?.telegram_id) {
      const isOnline = order.payment?.method === 'online';
      let custText = `🛍 <b>Замовлення #${order.order_id} успішно прийнято!</b>\n\n`;
      custText += `Дякуємо за покупку в <b>MILIPSTORE</b>.\n`;
      custText += `Сума замовлення: <b>${order.total} ₴</b>\n`;
      custText += `Доставка: ${order.delivery?.provider_name || 'Нова Пошта'}, ${order.delivery?.city}, ${order.delivery?.department}\n`;

      if (isOnline && order.payment?.status !== 'PAID') {
        custText += `\n⏳ <b>Очікує оплати:</b> Будь ласка, завершіть оплату для передачі на склад.`;
      } else {
        custText += `\n📦 <b>Статус:</b> Замовлення передано в обробку. Відправлення протягом 1-2 робочих днів.`;
      }

      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text: custText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Переглянути замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }

    // Notify Admins
    await this.notifyAdminsNewOrder(order);
  }

  async notifyAdminsNewOrder(order) {
    const itemsList = (order.items || []).map(i => `${i.title} (${i.qty} шт.)`).join(', ');
    const payStatus = order.payment?.status === 'PAID' ? '✅ Оплачено' : (order.payment?.is_cod ? '📦 Накладений платіж' : '⏳ Очікує оплати');

    const adminMsg = `🔔 <b>НОВИЙ ЗАКАЗ</b>\n\n` +
      `<b>Замовлення:</b> #${order.order_id}\n` +
      `<b>Товарів:</b> ${order.items?.length || 0} (${itemsList})\n` +
      `<b>Сума:</b> <b>${order.total} грн</b>\n` +
      `<b>Покупець:</b> ${order.customer?.first_name} ${order.customer?.last_name || ''} (${order.customer?.phone})\n` +
      `<b>Доставка:</b> ${order.delivery?.provider_name || 'Нова Пошта'}, ${order.delivery?.city}, ${order.delivery?.department}\n` +
      `<b>Оплата:</b> ${order.payment?.provider || 'Картка'} • ${payStatus}`;

    for (const adminId of ADMIN_IDS) {
      await this.callApi('sendMessage', {
        chat_id: adminId,
        text: adminMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Переглянути замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
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
      const text = `✅ <b>Оплату замовлення #${order.order_id} успішно підтверджено!</b>\n\n` +
        `Сума: <b>${order.total} ₴</b>\n` +
        `Провайдер: <b>${order.payment?.provider || 'Smart Glocal Test'}</b>\n` +
        `Транзакція: <code>${order.payment?.transaction_id || 'SG-OK'}</code>\n\n` +
        `Ми вже готуємо ваші девайси до комплектації та пакування. Сповістимо вас про кожен крок доставки!`;

      await this.callApi('sendMessage', {
        chat_id: order.customer.telegram_id,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Деталі замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }

    // Notify admins of payment
    for (const adminId of ADMIN_IDS) {
      await this.callApi('sendMessage', {
        chat_id: adminId,
        text: `💰 <b>ОПЛАТА ОТРИМАНА!</b>\n\nЗамовлення: #${order.order_id}\nСума: <b>${order.total} ₴</b>\nПокупець: ${order.customer?.first_name} ${order.customer?.last_name || ''}\nСтатус: ✅ Успішно сплачено через ${order.payment?.provider || 'Smart Glocal Test'}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Відкрити замовлення', callback_data: `view_order:${order.order_id}` }]
          ]
        }
      });
    }
  }

  // Trigger Notifications: Status Change by Admin
  async notifyCustomerStatusChange(order, newStatus, ttn = null) {
    db.addNotification({
      type: 'STATUS_CHANGED',
      order_id: order.order_id,
      status: newStatus,
      status_name: ORDER_STATUSES[newStatus]?.name || newStatus,
      ttn: ttn || order.tracking_number
    });

    if (!order.customer?.telegram_id) {
      console.log(`[TelegramBot] Order #${order.order_id} has no telegram_id to notify.`);
      return;
    }

    const orderNum = `#${order.order_id}`;
    let messageText = '';

    switch (newStatus) {
      case 'CONFIRMED':
        messageText = `📦 Ваше замовлення ${orderNum} підтверджено!\n\nМи вже почали його обробку.`;
        break;
      case 'PACKING_PREP':
        messageText = `📦 Ваше замовлення ${orderNum} готується до пакування.`;
        break;
      case 'PACKED':
        messageText = `✅ Ваше замовлення ${orderNum} упаковано.`;
        break;
      case 'DISPATCH_PREP':
        messageText = `🚚 Ваше замовлення ${orderNum} готується до відправки.`;
        break;
      case 'SHIPPED': {
        const track = ttn || order.tracking_number;
        messageText = `🚚 Ваше замовлення ${orderNum} вже відправлено!`;
        if (track) {
          messageText += `\n\nНомер ТТН: <code>${track}</code>\nВи можете відстежити посилку в додатку перевізника.`;
        }
        break;
      }
      case 'DELIVERED':
        messageText = `📦 Ваше замовлення ${orderNum} вже прибуло до відділення.`;
        break;
      case 'COMPLETED':
        messageText = `🎉 Ваше замовлення ${orderNum} успішно виконано. Дякуємо за покупку в MILIPSTORE!`;
        break;
      case 'CANCELLED':
        messageText = `❌ Ваше замовлення ${orderNum} було скасовано. Якщо у вас виникли запитання, напишіть у службу підтримки.`;
        break;
      default:
        messageText = `📦 Оновлено статус вашого замовлення ${orderNum}: <b>${ORDER_STATUSES[newStatus]?.name || newStatus}</b>`;
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

  // Telegram Payment Invoices
  async createInvoiceLink(order) {
    if (!BOT_TOKEN) {
      return null;
    }

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
    console.warn('[TelegramBot] createInvoiceLink response:', res);
    return null;
  }
}

export const botService = new TelegramBotService();
botService.init();
