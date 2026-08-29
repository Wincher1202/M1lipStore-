import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data/store.json');

// Canonical Statuses
export const ORDER_STATUSES = {
  PENDING_PAYMENT: { id: 'PENDING_PAYMENT', name: 'Очікує оплати', color: '#f59e0b', step: 0 },
  NEW: { id: 'NEW', name: 'Нові', color: '#3b82f6', step: 1 },
  CONFIRMED: { id: 'CONFIRMED', name: 'Підтверджені', color: '#6366f1', step: 2 },
  PACKING_PREP: { id: 'PACKING_PREP', name: 'Готується до пакування', color: '#8b5cf6', step: 3 },
  PACKED: { id: 'PACKED', name: 'Упаковано', color: '#a855f7', step: 4 },
  DISPATCH_PREP: { id: 'DISPATCH_PREP', name: 'Готується до відправки', color: '#ec4899', step: 5 },
  SHIPPED: { id: 'SHIPPED', name: 'Відправлено', color: '#10b981', step: 6 },
  DELIVERED: { id: 'DELIVERED', name: 'Доставлено', color: '#059669', step: 7 },
  COMPLETED: { id: 'COMPLETED', name: 'Виконано', color: '#16a34a', step: 8 },
  CANCELLED: { id: 'CANCELLED', name: 'Скасовано', color: '#ef4444', step: -1 }
};

export const INITIAL_PRODUCTS = [
  {
    id: 'prod-as-r5-ultra',
    brand: 'Attack Shark',
    title: 'Attack Shark R5 Ultra Magnesium Wireless',
    price: 3299,
    old_price: 3899,
    tag: 'ТОП ПРОДАЖІВ',
    category: 'Мишки',
    quantity: 18,
    colors: 'Black, White, Red',
    description: 'Ультралегка бездротова мишка з магнієвого сплаву з підтримкою 8000Hz опитування, сенсором PAW3395 та вагою лише 39 грамів.',
    img: '/attack-shark-r5-ultra-top-angle.jpg',
    gallery: [
      '/attack-shark-r5-ultra-top-angle.jpg',
      '/attack-shark-r5-ultra-back-grip.jpg',
      '/attack-shark-r5-ultra-colors-price.jpg',
      '/attack-shark-r5-ultra-in-hand-setup.jpg',
      '/attack-shark-r5-ultra-box-bundle-contents.jpg'
    ],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (до 26 000 DPI)' },
      { key: 'Вага', value: '39 грам' },
      { key: 'Частота опитування', value: 'До 8000 Hz' },
      { key: 'Перемикачі', value: 'TTC Dustproof Gold (80M натискань)' },
      { key: 'Підключення', value: '2.4GHz Wireless / Bluetooth / Type-C' },
      { key: 'Автономність', value: 'До 60 годин роботи' }
    ],
    color_images: {
      Black: { main: '/attack-shark-r5-ultra-top-angle.jpg', gallery: ['/attack-shark-r5-ultra-top-angle.jpg'] },
      White: { main: '/attack-shark-r5-ultra-back-grip.jpg', gallery: ['/attack-shark-r5-ultra-back-grip.jpg'] },
      Red: { main: '/attack-shark-r5-ultra-colors-price.jpg', gallery: ['/attack-shark-r5-ultra-colors-price.jpg'] }
    },
    color_quantities: {
      Black: 8,
      White: 6,
      Red: 4
    },
    sku: 'AS-R5-MAG',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-as-x3-pro',
    brand: 'Attack Shark',
    title: 'Attack Shark X3 Wireless Gaming Mouse',
    price: 1599,
    old_price: 1999,
    tag: 'ХІТ',
    category: 'Мишки',
    quantity: 25,
    colors: 'Black, White',
    description: 'Надзвичайно популярна бюджетна бездротова мишка на флагманському сенсорі PAW3395 вагою 49 грамів.',
    img: '/attack-shark-x3-black.jpg',
    gallery: [
      '/attack-shark-x3-black.jpg',
      '/attack-shark-x3-white.jpg',
      '/attack-shark-x3-box.jpg'
    ],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (26 000 DPI)' },
      { key: 'Вага', value: '49 грам' },
      { key: 'Підключення', value: 'Tri-Mode: 2.4G, BT5.2, Type-C' },
      { key: 'Свічі', value: 'Kailh GM8.0 Black Mamba' },
      { key: 'Акумулятор', value: '300 mAh (до 200 годин BT)' }
    ],
    color_images: {
      Black: { main: '/attack-shark-x3-black.jpg', gallery: ['/attack-shark-x3-box.jpg'] },
      White: { main: '/attack-shark-x3-white.jpg', gallery: ['/attack-shark-x3-white.jpg'] }
    },
    color_quantities: {
      Black: 15,
      White: 10
    },
    sku: 'AS-X3-BLK',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-ajazz-ak820-pro',
    brand: 'Ajazz',
    title: 'Ajazz AK820 Pro Wireless Gasket Keyboard (TFT Screen)',
    price: 2799,
    old_price: 3299,
    tag: 'ТОП ПРОДАЖІВ',
    category: 'Клавіатури',
    quantity: 16,
    colors: 'Grey, Purple, White',
    description: '75% механічна клавіатура з повноколірним TFT-дисплеєм, металевим енкодером, структурою Gasket Mount та бездротовим підключенням 2.4G/BT5.1.',
    img: '/photo_2026-08-25_15-31-22.jpg',
    gallery: [
      '/photo_2026-08-25_15-31-22.jpg',
      '/photo_2026-08-25_15-31-28.jpg',
      '/aula копия.png'
    ],
    specs: [
      { key: 'Формат', value: '75% (81 клавіша + 0.85" TFT екран)' },
      { key: 'Свічі', value: 'Ajazz Flying Fish Linear (Hot-swap 5-pin)' },
      { key: 'Шумоізоляція', value: '5 шарів (Poron, IXPE, PET, силікон)' },
      { key: 'Підключення', value: 'Tri-Mode: 2.4GHz / Bluetooth 5.1 / Type-C' },
      { key: 'Акумулятор', value: '4000 mAh' }
    ],
    color_images: {
      Grey: { main: '/photo_2026-08-25_15-31-22.jpg', gallery: [] },
      Purple: { main: '/photo_2026-08-25_15-31-28.jpg', gallery: [] },
      White: { main: '/aula копия.png', gallery: [] }
    },
    color_quantities: {
      Grey: 8,
      Purple: 5,
      White: 3
    },
    sku: 'AJAZZ-AK820-PRO',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-ajazz-aj199',
    brand: 'Ajazz',
    title: 'Ajazz AJ199 4K Wireless Gaming Mouse',
    price: 1799,
    old_price: 2199,
    tag: 'ХІТ',
    category: 'Мишки',
    quantity: 20,
    colors: 'Black, White',
    description: 'Надлегка бездротова симетрична мишка вагою 59г на топовому сенсорі PAW3395 та підтримкою високої частоти опитування.',
    img: '/attack-shark-x3-black.jpg',
    gallery: [
      '/attack-shark-x3-black.jpg',
      '/attack-shark-x3-white.jpg'
    ],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (до 26 000 DPI)' },
      { key: 'Вага', value: '59 грамів' },
      { key: 'Мікрики', value: 'Huano Blue Shell Pink Dot (80M)' },
      { key: 'Підключення', value: '2.4GHz Wireless / Type-C' }
    ],
    color_images: {
      Black: { main: '/attack-shark-x3-black.jpg', gallery: [] },
      White: { main: '/attack-shark-x3-white.jpg', gallery: [] }
    },
    color_quantities: {
      Black: 12,
      White: 8
    },
    sku: 'AJAZZ-AJ199-4K',
    featured: false,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-aula-f75',
    brand: 'AULA',
    title: 'AULA F75 Wireless Mechanical Keyboard',
    price: 2899,
    old_price: 3299,
    tag: 'НОВИНКА',
    category: 'Клавіатури',
    quantity: 12,
    colors: 'White, Black, Green',
    description: '75% механічна клавіатура з Gasket Mount, попередньо змащеними свічами LEOBOG Reaper та гарячою заміною Hot-swap.',
    img: '/aula копия.png',
    gallery: [
      '/aula копия.png',
      '/photo_2026-08-25_15-31-22.jpg',
      '/photo_2026-08-25_15-31-28.jpg'
    ],
    specs: [
      { key: 'Формат', value: '75% (80 клавіш + металевий регулятор)' },
      { key: 'Конструкція', value: 'Gasket Mount з 5-шаровою шумоізоляцією' },
      { key: 'Свічі', value: 'LEOBOG Reaper Linear (pre-lubed)' },
      { key: 'Підключення', value: 'Bluetooth 5.0 / 2.4GHz / Type-C' },
      { key: 'Акумулятор', value: '4000 mAh' }
    ],
    color_images: {
      White: { main: '/aula копия.png', gallery: ['/photo_2026-08-25_15-31-22.jpg'] },
      Black: { main: '/photo_2026-08-25_15-31-28.jpg', gallery: [] },
      Green: { main: '/aula копия.png', gallery: [] }
    },
    color_quantities: {
      White: 6,
      Black: 4,
      Green: 2
    },
    sku: 'AULA-F75-WHT',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-mchose-ax5',
    brand: 'Mchose',
    title: 'Mchose AX5 Magnesium 8K Wireless Mouse',
    price: 3499,
    old_price: 3999,
    tag: 'ФЛАГМАН',
    category: 'Мишки',
    quantity: 14,
    colors: 'Silver, Black',
    description: 'Флагманська мишка з алюмінієво-магнієвого сплаву з ЧПК-обробкою, 8KHz Dongle у комплекті та сенсором PAW3395.',
    img: '/attack-shark-r5-ultra-top-angle.jpg',
    gallery: [
      '/attack-shark-r5-ultra-top-angle.jpg',
      '/attack-shark-r5-ultra-back-grip.jpg',
      '/attack-shark-r5-ultra-colors-price.jpg'
    ],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (26 000 DPI)' },
      { key: 'Корпус', value: 'Магнієвий сплав Exoskeleton' },
      { key: 'Вага', value: '49 грамів' },
      { key: 'Частота опитування', value: 'До 8000 Hz Wireless' },
      { key: 'Свічі', value: 'TTC Optical Switches (100M натискань)' }
    ],
    color_images: {
      Silver: { main: '/attack-shark-r5-ultra-top-angle.jpg', gallery: [] },
      Black: { main: '/attack-shark-r5-ultra-back-grip.jpg', gallery: [] }
    },
    color_quantities: {
      Silver: 8,
      Black: 6
    },
    sku: 'MCHOSE-AX5-MAG',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-vgn-f1-promax',
    brand: 'VGN',
    title: 'VGN Dragonfly F1 Pro Max Wireless Mouse',
    price: 2199,
    old_price: 2599,
    tag: 'ТОП ПРОДАЖІВ',
    category: 'Мишки',
    quantity: 22,
    colors: 'Black, White',
    description: 'Еталонна ультралегка кіберспортивна мишка вагою 55 грамів на чіпі Nordic 52840 та сенсорі PAW3395 з ресурсом батареї до 130 годин.',
    img: '/attack-shark-x3-white.jpg',
    gallery: [
      '/attack-shark-x3-white.jpg',
      '/attack-shark-x3-black.jpg',
      '/attack-shark-x3-box.jpg'
    ],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (26 000 DPI)' },
      { key: 'Чіпсет', value: 'Nordic 52840 Flagship MCU' },
      { key: 'Вага', value: '55 грам' },
      { key: 'Свічі', value: 'Kailh Golden Black Mamba (90M)' },
      { key: 'Акумулятор', value: '500 mAh (до 130 годин безперервної гри)' }
    ],
    color_images: {
      Black: { main: '/attack-shark-x3-black.jpg', gallery: [] },
      White: { main: '/attack-shark-x3-white.jpg', gallery: [] }
    },
    color_quantities: {
      Black: 12,
      White: 10
    },
    sku: 'VGN-F1-PROMAX',
    featured: true,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-m1lip-custom-pad',
    brand: 'M1LIP Custom',
    title: 'M1lipStore Pro Cordura Control Mousepad (900x400)',
    price: 899,
    old_price: 1199,
    tag: 'АКСЕСУАР',
    category: 'Аксесуари',
    quantity: 30,
    colors: 'Black',
    description: 'Преміальний ігровий килим з тканини Cordura з мікрострочкою нижче рівня поверхні та нековзною основою.',
    img: '/images.png',
    gallery: [
      '/images.png',
      '/logo-milipstore.png'
    ],
    specs: [
      { key: 'Розмір', value: '900 x 400 x 4 мм' },
      { key: 'Матеріал', value: 'Cordura Water-Resistant Fabric' },
      { key: 'Основа', value: 'Non-slip Natural Rubber' },
      { key: 'Прошивка', value: 'Low-profile Micro-stitched Edge' }
    ],
    color_images: {
      Black: { main: '/images.png', gallery: [] }
    },
    color_quantities: {
      Black: 30
    },
    sku: 'M1LIP-PAD-9040',
    featured: false,
    popular: true,
    hidden: false,
    created_at: new Date().toISOString()
  }
];

export const INITIAL_CATEGORIES = [
  { id: 'mice', name: 'Мишки', image: '', position: 0, hidden: false },
  { id: 'keyboards', name: 'Клавіатури', image: '', position: 1, hidden: false },
  { id: 'accessories', name: 'Аксесуари', image: '', position: 2, hidden: false },
  { id: 'audio', name: 'Аудіо', image: '', position: 3, hidden: false }
];

export const INITIAL_BRANDS = [
  { id: 'attack-shark', name: 'Attack Shark', logo: '/brand-attack-shark.svg', position: 0, hidden: false },
  { id: 'aula', name: 'AULA', logo: '/brand-aula.svg', position: 1, hidden: false },
  { id: 'vxe', name: 'VXE', logo: '/brand-vgn.svg', position: 2, hidden: false },
  { id: 'ajazz', name: 'Ajazz', logo: '/brand-ajazz.svg', position: 3, hidden: false },
  { id: 'darmoshark', name: 'Darmoshark', logo: '', position: 4, hidden: false },
  { id: 'mchose', name: 'Mchose', logo: '/brand-mchose.svg', position: 5, hidden: false },
  { id: 'vgn', name: 'VGN', logo: '/brand-vgn.svg', position: 6, hidden: false },
  { id: 'm1lip', name: 'M1LIP Custom', logo: '/logo-milipstore.png', position: 7, hidden: false }
];

class Database {
  constructor() {
    this.data = {
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      brands: INITIAL_BRANDS,
      orders: [],
      telegram_users: {},
      admin_ids: ['1929165295', '1248134309'],
      notifications: []
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const rawAdmins = Array.isArray(parsed.admin_ids) && parsed.admin_ids.length ? parsed.admin_ids : [];
          const combinedAdmins = Array.from(new Set([...rawAdmins, '1929165295', '1248134309']));
          this.data = {
            ...this.data,
            ...parsed,
            products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
            categories: Array.isArray(parsed.categories) ? parsed.categories : INITIAL_CATEGORIES,
            brands: Array.isArray(parsed.brands) ? parsed.brands : INITIAL_BRANDS,
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            telegram_users: parsed.telegram_users || {},
            admin_ids: combinedAdmins,
            notifications: parsed.notifications || []
          };
        }
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[DB] Failed to load store.json, using default state:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Failed to save store.json:', err.message);
    }
  }

  // Products
  getProducts(filters = {}) {
    let list = [...this.data.products.filter(p => !p.hidden)];
    const { category, brand, search, min_price, max_price, in_stock, sort } = filters;

    if (category && category !== 'All') {
      list = list.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
    }
    if (brand && brand !== 'All') {
      list = list.filter(p => (p.brand || '').toLowerCase() === brand.toLowerCase());
    }
    if (search) {
      const q = search.toString().toLowerCase().trim();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    }
    if (min_price) {
      list = list.filter(p => p.price >= Number(min_price));
    }
    if (max_price) {
      list = list.filter(p => p.price <= Number(max_price));
    }
    if (in_stock === 'true') {
      list = list.filter(p => p.quantity > 0);
    }

    if (sort === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sort === 'popular') {
      list.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    }

    return list;
  }

  getProductById(id) {
    if (!id) return null;
    const strId = String(id).trim();
    // 1. Direct match
    let found = this.data.products.find(p => p.id === strId);
    if (found) return found;

    // 2. Case-insensitive or trimmed match
    found = this.data.products.find(p => p.id.toLowerCase() === strId.toLowerCase());
    if (found) return found;

    // 3. Prefix/suffix or SKU match
    found = this.data.products.find(p => 
      p.id.startsWith(strId) || 
      strId.startsWith(p.id) || 
      (p.sku && p.sku.toLowerCase() === strId.toLowerCase())
    );
    return found || null;
  }

  addProduct(product) {
    if (!product.id) {
      product.id = `prod-${Date.now()}`;
    }
    this.data.products.unshift(product);
    this.save();
    return product;
  }

  updateProduct(id, updates) {
    const prod = this.getProductById(id);
    if (!prod) return null;
    Object.assign(prod, updates);
    this.save();
    return prod;
  }

  deleteProduct(id) {
    const idx = this.data.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      const removed = this.data.products.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    return null;
  }

  getCategories() {
    return this.data.categories.filter(c => !c.hidden).sort((a, b) => a.position - b.position);
  }

  addCategory(category) {
    if (!category) return null;
    const name = (typeof category === 'string' ? category : category.name || '').trim();
    if (!name) return null;
    const existing = this.data.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const id = (typeof category === 'object' && category.id) ? category.id : name.toLowerCase().replace(/[^a-z0-9а-яіїє]/gi, '-');
    const newCat = {
      id: id || `cat-${Date.now()}`,
      name: name,
      image: (typeof category === 'object' && category.image) ? category.image : '',
      position: this.data.categories.length,
      hidden: false
    };
    this.data.categories.push(newCat);
    this.save();
    return newCat;
  }

  getBrands() {
    return this.data.brands.filter(b => !b.hidden).sort((a, b) => a.position - b.position);
  }

  addBrand(brand) {
    if (!brand) return null;
    const name = (typeof brand === 'string' ? brand : brand.name || '').trim();
    if (!name) return null;
    const existing = this.data.brands.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const id = (typeof brand === 'object' && brand.id) ? brand.id : name.toLowerCase().replace(/[^a-z0-9а-яіїє]/gi, '-');
    const newBrand = {
      id: id || `brand-${Date.now()}`,
      name: name,
      logo: (typeof brand === 'object' && brand.logo) ? brand.logo : '',
      position: this.data.brands.length,
      hidden: false
    };
    this.data.brands.push(newBrand);
    this.save();
    return newBrand;
  }

  // Orders
  getOrders(filters = {}) {
    let list = [...this.data.orders];
    const { status, search, payment_status, provider, limit } = filters;

    if (status && status !== 'all') {
      list = list.filter(o => o.status === status);
    }
    if (payment_status) {
      list = list.filter(o => o.payment && o.payment.status === payment_status);
    }
    if (provider) {
      list = list.filter(o => o.delivery && o.delivery.provider === provider);
    }
    if (search) {
      const q = search.toString().toLowerCase().trim();
      list = list.filter(o =>
        (o.order_id || '').toLowerCase().includes(q) ||
        ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).toLowerCase().includes(q) ||
        (o.customer?.phone || '').toLowerCase().includes(q) ||
        (o.customer?.email || '').toLowerCase().includes(q) ||
        (o.tracking_number || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    if (limit) {
      list = list.slice(0, Number(limit));
    }
    return list;
  }

  getOrderById(id) {
    if (!id) return null;
    const cleanId = id.toString().replace(/^#/, '').trim();
    return this.data.orders.find(o =>
      o.order_id === cleanId ||
      o.id === cleanId ||
      o.order_id === `#${cleanId}` ||
      o.order_id === id
    );
  }

  createOrder(orderData) {
    // Generate sequential or random format MLP-XXXXXX
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderId = orderData.order_id || `MLP-${randomNum}`;

    const now = new Date().toISOString();
    const initialStatus = orderData.status || (orderData.payment?.method === 'cod' ? 'NEW' : 'PENDING_PAYMENT');

    const history = [
      {
        status: initialStatus,
        status_name: ORDER_STATUSES[initialStatus]?.name || initialStatus,
        timestamp: now,
        note: initialStatus === 'PENDING_PAYMENT' ? 'Замовлення створено (очікує оплати)' : 'Замовлення оформлено (накладений платіж)',
        actor: 'Customer'
      }
    ];

    const order = {
      order_id: orderId,
      id: orderId,
      status: initialStatus,
      status_name: ORDER_STATUSES[initialStatus]?.name || initialStatus,
      tracking_number: null,
      subtotal: orderData.subtotal || 0,
      delivery_fee: orderData.delivery_fee || 0,
      cod_fee: orderData.cod_fee || 0,
      total: orderData.total || 0,
      dispatch_timeline: '1-2 дні',
      shipping_note: 'Відправлення замовлення протягом 1-2 робочих днів з моменту оформлення',
      created_at: now,
      updated_at: now,
      customer: {
        first_name: orderData.customer?.first_name || '',
        last_name: orderData.customer?.last_name || '',
        middle_name: orderData.customer?.middle_name || orderData.customer?.patronymic || '',
        phone: orderData.customer?.phone || '',
        email: orderData.customer?.email || '',
        telegram_id: orderData.customer?.telegram_id || null,
        telegram_username: orderData.customer?.telegram_username || null
      },
      delivery: {
        provider: orderData.delivery?.provider || 'nova_poshta', // nova_poshta | ukrposhta
        provider_name: orderData.delivery?.provider === 'ukrposhta' ? 'Укрпошта' : 'Нова Пошта',
        type: orderData.delivery?.type || orderData.delivery?.method || 'branch', // branch | postomat
        type_name: (orderData.delivery?.type === 'postomat' || orderData.delivery?.method === 'postomat') ? 'Поштомат' : 'Відділення',
        city: orderData.delivery?.city || '',
        city_ref: orderData.delivery?.cityRef || orderData.delivery?.city_ref || '',
        warehouse_ref: orderData.delivery?.warehouseRef || orderData.delivery?.warehouse_ref || '',
        warehouse_number: orderData.delivery?.warehouse_number || '',
        department: orderData.delivery?.department || '',
        address: orderData.delivery?.address || orderData.delivery?.department || ''
      },
      payment: {
        method: orderData.payment?.method || 'online', // 'online' | 'cod'
        provider: orderData.payment?.provider || (orderData.payment?.method === 'online' ? 'Smart Glocal Test' : 'Cash on Delivery'),
        status: orderData.payment?.status || (orderData.payment?.method === 'cod' ? 'PENDING_ON_DELIVERY' : 'PENDING'),
        transaction_id: orderData.payment?.transaction_id || null,
        paid_at: orderData.payment?.paid_at || null,
        is_cod: orderData.payment?.method === 'cod',
        cod_fee: orderData.cod_fee || 0,
        comment: orderData.payment?.comment || ''
      },
      items: orderData.items || [],
      history,
      admin_comment: ''
    };

    // Deduct stock
    for (const item of order.items) {
      const prod = this.getProductById(item.id);
      if (prod) {
        const qty = Number(item.qty) || 1;
        const color = item.color;
        if (color && prod.color_quantities && prod.color_quantities[color] !== undefined) {
          prod.color_quantities[color] = Math.max(0, prod.color_quantities[color] - qty);
          prod.quantity = Object.values(prod.color_quantities).reduce((a, b) => a + b, 0);
        } else {
          prod.quantity = Math.max(0, prod.quantity - qty);
        }
      }
    }

    this.data.orders.unshift(order);

    // Link telegram user if present
    if (order.customer.telegram_id) {
      this.linkOrderToTelegramUser(order.customer.telegram_id, orderId, order.customer);
    }
    if (order.customer.phone) {
      this.linkOrderToPhone(order.customer.phone, orderId);
    }

    this.save();
    return order;
  }

  updateOrderStatus(orderId, newStatus, actor = 'Admin', note = '') {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    if (!ORDER_STATUSES[newStatus]) {
      throw new Error(`Невідомий статус замовлення: ${newStatus}`);
    }

    const prevStatus = order.status;
    order.status = newStatus;
    order.status_name = ORDER_STATUSES[newStatus].name;
    order.updated_at = new Date().toISOString();

    const historyEntry = {
      status: newStatus,
      status_name: ORDER_STATUSES[newStatus].name,
      timestamp: order.updated_at,
      note: note || `Статус змінено з "${ORDER_STATUSES[prevStatus]?.name || prevStatus}" на "${ORDER_STATUSES[newStatus].name}"`,
      actor
    };

    if (!Array.isArray(order.history)) order.history = [];
    order.history.push(historyEntry);

    this.save();
    return { order, historyEntry, prevStatus };
  }

  updateOrderPayment(orderId, paymentData = {}) {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    order.payment = {
      ...order.payment,
      ...paymentData,
      status: paymentData.status || 'PAID',
      paid_at: paymentData.paid_at || new Date().toISOString()
    };

    // If order was PENDING_PAYMENT, promote to NEW
    if (order.status === 'PENDING_PAYMENT') {
      order.status = 'NEW';
      order.status_name = ORDER_STATUSES.NEW.name;
    }

    order.updated_at = new Date().toISOString();
    order.history.push({
      status: 'PAID',
      status_name: 'Оплата підтверджена',
      timestamp: order.updated_at,
      note: `Оплату успішно отримано (${order.payment.provider || 'Smart Glocal Test'}, сума: ${order.total} ₴)`,
      actor: 'PaymentSystem'
    });

    this.save();
    return order;
  }

  updateOrderTtn(orderId, ttn, actor = 'Admin') {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    order.tracking_number = ttn.toString().trim();
    order.updated_at = new Date().toISOString();

    // If status is not yet shipped, admin adding TTN can set to SHIPPED or keep note
    if (!order.history) order.history = [];
    order.history.push({
      status: order.status,
      status_name: order.status_name,
      timestamp: order.updated_at,
      note: `Додано номер ТТН: ${order.tracking_number}`,
      actor
    });

    this.save();
    return order;
  }

  updateOrderComment(orderId, comment) {
    const order = this.getOrderById(orderId);
    if (!order) return null;
    order.admin_comment = (comment || '').trim();
    order.updated_at = new Date().toISOString();
    this.save();
    return order;
  }

  deleteOrder(orderId) {
    if (!orderId) return false;
    const cleanId = orderId.toString().replace(/^#/, '').trim();
    const initLen = this.data.orders.length;
    this.data.orders = this.data.orders.filter(o => 
      o.order_id !== cleanId && 
      o.id !== cleanId && 
      o.order_id !== `#${cleanId}` &&
      o.order_id !== orderId
    );
    const deleted = this.data.orders.length < initLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // Telegram User Linkage
  linkOrderToTelegramUser(telegramId, orderId, customerData = {}) {
    const tid = String(telegramId);
    if (!this.data.telegram_users[tid]) {
      this.data.telegram_users[tid] = {
        telegram_id: tid,
        first_name: customerData.first_name || '',
        last_name: customerData.last_name || '',
        username: customerData.telegram_username || '',
        phone: customerData.phone || '',
        order_ids: []
      };
    }
    if (!this.data.telegram_users[tid].order_ids.includes(orderId)) {
      this.data.telegram_users[tid].order_ids.push(orderId);
    }
    if (customerData.phone && !this.data.telegram_users[tid].phone) {
      this.data.telegram_users[tid].phone = customerData.phone;
    }
    this.save();
  }

  linkOrderToPhone(phone, orderId) {
    const cleanPhone = phone.replace(/\D/g, '');
    for (const [tid, u] of Object.entries(this.data.telegram_users)) {
      const uPhone = (u.phone || '').replace(/\D/g, '');
      if (uPhone && (uPhone === cleanPhone || (cleanPhone.endsWith(uPhone.slice(-9))))) {
        if (!u.order_ids.includes(orderId)) {
          u.order_ids.push(orderId);
        }
      }
    }
    this.save();
  }

  getOrdersByTelegramId(telegramId) {
    const tid = String(telegramId);
    const u = this.data.telegram_users[tid];
    const orderIds = u ? u.order_ids : [];

    // Also match by direct customer.telegram_id
    const matched = this.data.orders.filter(o =>
      String(o.customer?.telegram_id) === tid ||
      orderIds.includes(o.order_id) ||
      orderIds.includes(o.id)
    );

    return matched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getOrdersByPhone(phone) {
    if (!phone) return [];
    const cleanDigits = phone.replace(/\D/g, '').slice(-9); // last 9 digits match
    return this.data.orders.filter(o => {
      const custDigits = (o.customer?.phone || '').replace(/\D/g, '').slice(-9);
      return custDigits && custDigits === cleanDigits;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getTelegramIdForOrder(order) {
    if (!order) return null;
    if (order.customer?.telegram_id) return String(order.customer.telegram_id);
    const orderId = order.order_id || order.id;

    // Search by linked telegram_users map
    for (const [tid, u] of Object.entries(this.data.telegram_users || {})) {
      if (u.order_ids && (u.order_ids.includes(orderId) || u.order_ids.includes(`#${orderId}`))) {
        return String(tid);
      }
      if (order.customer?.phone && u.phone) {
        const p1 = order.customer.phone.replace(/\D/g, '').slice(-9);
        const p2 = u.phone.replace(/\D/g, '').slice(-9);
        if (p1 && p2 && p1 === p2) return String(tid);
      }
    }
    return null;
  }

  // Analytics & Stats
  getStats() {
    const all = this.data.orders;
    const activeOrders = all.filter(o => o.status !== 'CANCELLED');
    const newOrders = all.filter(o => o.status === 'NEW' || o.status === 'PENDING_PAYMENT');
    const completedOrders = all.filter(o => o.status === 'COMPLETED');
    const shippedOrders = all.filter(o => o.status === 'SHIPPED');

    const totalSales = activeOrders.reduce((sum, o) => {
      const isPaid = o.payment && (o.payment.status === 'PAID' || o.status === 'COMPLETED' || o.status === 'SHIPPED');
      return isPaid ? sum + (Number(o.total) || 0) : sum;
    }, 0);

    const averageCheck = activeOrders.length ? Math.round(totalSales / (activeOrders.length || 1)) : 0;

    const statusCounts = {};
    for (const key of Object.keys(ORDER_STATUSES)) {
      statusCounts[key] = all.filter(o => o.status === key).length;
    }

    return {
      total_orders: all.length,
      new_orders: newOrders.length,
      shipped_orders: shippedOrders.length,
      completed_orders: completedOrders.length,
      total_sales: totalSales,
      average_check: averageCheck,
      status_counts: statusCounts
    };
  }

  addNotification(log) {
    this.data.notifications.unshift({
      id: `notif-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      timestamp: new Date().toISOString(),
      ...log
    });
    if (this.data.notifications.length > 100) {
      this.data.notifications = this.data.notifications.slice(0, 100);
    }
    this.save();
  }

  getNotifications() {
    return this.data.notifications.slice(0, 50);
  }

  clearNotifications() {
    this.data.notifications = [];
    this.save();
    return true;
  }

  // Admin Management
  addAdmin(idOrTag) {
    if (!idOrTag) return false;
    const clean = String(idOrTag).trim().toLowerCase().replace(/^@/, '');
    if (!this.data.admin_ids) this.data.admin_ids = [];
    if (!this.data.admin_ids.includes(clean)) {
      this.data.admin_ids.push(clean);
      this.save();
      return true;
    }
    return false;
  }

  removeAdmin(idOrTag) {
    if (!idOrTag || !this.data.admin_ids) return false;
    const clean = String(idOrTag).trim().toLowerCase().replace(/^@/, '');
    const idx = this.data.admin_ids.indexOf(clean);
    if (idx !== -1) {
      this.data.admin_ids.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  getAdminIds() {
    return this.data.admin_ids || [];
  }
}

export const db = new Database();
