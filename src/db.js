import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data/store.json');
const BACKUP_FILE = path.join(__dirname, '../data/store_backup.json');

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
    id: 'prod-shark-x3',
    brand: 'Attack Shark',
    title: 'Attack Shark X3 Wireless',
    price: 1599,
    old_price: 1899,
    sku: 'SHARK-X3-W',
    popular: true,
    tag: '🔥 ТОП ПРОДАЖІВ',
    category: 'Мишки',
    description: 'Флагманська ультралегка бездротова ігрова мишка вагою всього 49 грамів з топовим оптичним сенсором PixArt PAW3395 (до 26 000 DPI), надійними мікроперемикачами TTC Gold та потрійним режимом підключення (2.4G, Bluetooth 5.2, Type-C).',
    img: '/attack-shark-x3-black.jpg',
    gallery: ['/attack-shark-x3-black.jpg', '/attack-shark-x3-white.jpg', '/attack-shark-x3-box.jpg'],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395 (26 000 DPI)' },
      { key: 'Вага', value: '49 грамів' },
      { key: 'Підключення', value: '2.4GHz / Bluetooth 5.2 / USB-C' },
      { key: 'Автономність', value: 'до 65 годин' }
    ],
    colors: ['Black', 'White', 'Pink'],
    color_quantities: { Black: 25, White: 25, Pink: 15 },
    color_images: {
      Black: { main: '/attack-shark-x3-black.jpg', gallery: ['/attack-shark-x3-black.jpg', '/attack-shark-x3-box.jpg'] },
      White: { main: '/attack-shark-x3-white.jpg', gallery: ['/attack-shark-x3-white.jpg', '/attack-shark-x3-box.jpg'] },
      Pink: { main: '/attack-shark-x3-black.jpg', gallery: ['/attack-shark-x3-black.jpg'] }
    },
    hidden: false
  },
  {
    id: 'prod-vgn-f1',
    brand: 'VGN',
    title: 'VGN Dragonfly F1 Pro Max',
    price: 1999,
    old_price: 2399,
    sku: 'VGN-F1-PRO',
    popular: true,
    tag: '⚡ ХІТ СЕЗОНУ',
    category: 'Мишки',
    description: 'Кіберспортивна бездротова мишка вагою 55г з топовим сенсором PAW3395, чіпом Nordic 52840 та підтримкою частоти опитування до 4000Hz (при використанні 4K Dongle).',
    img: '/photo_2026-08-25_15-32-13.jpg',
    gallery: ['/photo_2026-08-25_15-32-13.jpg', '/photo_2026-08-25_15-32-17.jpg', '/photo_2026-08-25_15-32-36.jpg'],
    specs: [
      { key: 'Сенсор', value: 'PAW3395 (до 26 000 DPI)' },
      { key: 'Контролер', value: 'Nordic 52840 (4K Ready)' },
      { key: 'Вага', value: '55 грамів' },
      { key: 'Акумулятор', value: '500 mAh (до 130 год)' }
    ],
    colors: ['Black', 'White'],
    color_quantities: { Black: 25, White: 25 },
    color_images: {
      Black: { main: '/photo_2026-08-25_15-32-13.jpg', gallery: ['/photo_2026-08-25_15-32-13.jpg', '/photo_2026-08-25_15-32-17.jpg'] },
      White: { main: '/photo_2026-08-25_15-32-36.jpg', gallery: ['/photo_2026-08-25_15-32-36.jpg', '/photo_2026-08-25_15-32-38.jpg'] }
    },
    hidden: false
  },
  {
    id: 'prod-aula-f75',
    brand: 'AULA',
    title: 'AULA F75 Wireless Gasket',
    price: 2499,
    old_price: 2899,
    sku: 'AULA-F75',
    popular: true,
    tag: '⭐ ВИБІР ГРАВЦІВ',
    category: 'Клавіатури',
    description: 'Преміальна 75% бездротова механічна клавіатура з багатошаровою Gasket Mount шумоізоляцією (5 шарів поглинання звуку), металевим коліщатком гучності, фабрично змащеними перемикачами LEOBOG Reaper та RGB-підсвіткою.',
    img: '/photo_2026-08-25_15-32-57.jpg',
    gallery: ['/photo_2026-08-25_15-32-57.jpg', '/photo_2026-08-25_15-32-59.jpg', '/photo_2026-08-25_15-33-02.jpg'],
    specs: [
      { key: 'Конструкція', value: 'Gasket Mount (5 шарів шумоізоляції)' },
      { key: 'Форм-фактор', value: '75% (80 клавіш + Knob)' },
      { key: 'Перемикачі', value: 'LEOBOG Reaper Linear (змащені)' },
      { key: 'Підключення', value: '2.4G / BT 5.0 / Type-C' }
    ],
    colors: ['Black', 'White', 'Blue'],
    color_quantities: { Black: 20, White: 20, Blue: 15 },
    color_images: {
      Black: { main: '/photo_2026-08-25_15-32-57.jpg', gallery: ['/photo_2026-08-25_15-32-57.jpg'] },
      White: { main: '/photo_2026-08-25_15-32-59.jpg', gallery: ['/photo_2026-08-25_15-32-59.jpg'] },
      Blue: { main: '/photo_2026-08-25_15-33-02.jpg', gallery: ['/photo_2026-08-25_15-33-02.jpg'] }
    },
    hidden: false
  },
  {
    id: 'prod-ajazz-ak820',
    brand: 'Ajazz',
    title: 'Ajazz AK820 Pro TFT Screen',
    price: 2299,
    old_price: 2699,
    sku: 'AJAZZ-AK820',
    popular: true,
    tag: '✨ НОВИНКА',
    category: 'Клавіатури',
    description: 'Бездротова механічна клавіатура з вбудованим кольоровим TFT-дисплеєм для GIF-анімацій та статусу системи, зручним регулятором гучності та приємним глибоким звуком (creamy sound).',
    img: '/350954572_1917991488535350_2141770078765880809_n_2.webp',
    gallery: ['/350954572_1917991488535350_2141770078765880809_n_2.webp', '/photo_2026-08-25_15-33-42.jpg', '/photo_2026-08-25_15-33-43.jpg'],
    specs: [
      { key: 'Екран', value: '0.85" Color TFT Screen' },
      { key: 'Будова', value: 'Gasket Mount (PC Plate)' },
      { key: 'Світчі', value: 'Ajazz Flying Fish Switch' },
      { key: 'Батарея', value: '4000 mAh' }
    ],
    colors: ['Grey', 'White', 'Purple'],
    color_quantities: { Grey: 20, White: 20, Purple: 15 },
    color_images: {
      Grey: { main: '/350954572_1917991488535350_2141770078765880809_n_2.webp', gallery: ['/350954572_1917991488535350_2141770078765880809_n_2.webp', '/photo_2026-08-25_15-33-42.jpg'] },
      White: { main: '/photo_2026-08-25_15-33-43.jpg', gallery: ['/photo_2026-08-25_15-33-43.jpg'] },
      Purple: { main: '/photo_2026-08-25_15-33-49.jpg', gallery: ['/photo_2026-08-25_15-33-49.jpg'] }
    },
    hidden: false
  },
  {
    id: 'prod-mchose-a5',
    brand: 'Mchose',
    title: 'Mchose A5 Ultra Light Wireless',
    price: 1699,
    old_price: 1999,
    sku: 'MCHOSE-A5',
    popular: false,
    tag: '🎯 РЕКОМЕНДУЄМО',
    category: 'Мишки',
    description: 'Ультраергономічна мишка для геймерів та професіоналів. Сенсор PixArt 3395, вага 59г, перемикачі Huano Blue Pink Dot на 80 млн натискань та до 130 годин безперервної гри.',
    img: '/48c2868a-928a-46f4-8b76-9e4d4fd6a7dc.jpg',
    gallery: ['/48c2868a-928a-46f4-8b76-9e4d4fd6a7dc.jpg', '/photo_2026-08-25_15-31-22.jpg', '/photo_2026-08-25_15-31-28.jpg'],
    specs: [
      { key: 'Сенсор', value: 'PixArt PAW3395' },
      { key: 'Світчі', value: 'Huano Transparent Blue Shell Pink Dot (80M)' },
      { key: 'Вага', value: '59 грамів' },
      { key: 'Підключення', value: 'Tri-mode 2.4G / BT / USB' }
    ],
    colors: ['Black', 'White'],
    color_quantities: { Black: 25, White: 25 },
    color_images: {
      Black: { main: '/48c2868a-928a-46f4-8b76-9e4d4fd6a7dc.jpg', gallery: ['/48c2868a-928a-46f4-8b76-9e4d4fd6a7dc.jpg'] },
      White: { main: '/photo_2026-08-25_15-31-22.jpg', gallery: ['/photo_2026-08-25_15-31-22.jpg', '/photo_2026-08-25_15-31-28.jpg'] }
    },
    hidden: false
  }
];

export const INITIAL_CATEGORIES = [
  { id: 'mice', name: 'Мишки', image: '', position: 0, hidden: false },
  { id: 'keyboards', name: 'Клавіатури', image: '', position: 1, hidden: false },
  { id: 'accessories', name: 'Аксесуари', image: '', position: 2, hidden: false },
  { id: 'audio', name: 'Аудіо', image: '', position: 3, hidden: false }
];

export const INITIAL_BRANDS = [
  { id: 'brand-attack-shark', name: 'Attack Shark', logo: '/attack-shark2.jpg', position: 0, hidden: false },
  { id: 'brand-ajazz', name: 'Ajazz', logo: '/ajazz1.jpg', position: 1, hidden: false },
  { id: 'brand-aula', name: 'AULA', logo: '/aula3.jpg', position: 2, hidden: false },
  { id: 'brand-mchose', name: 'Mchose', logo: '/mchose4.png', position: 3, hidden: false },
  { id: 'brand-vgn', name: 'VGN', logo: '/vgn5.jpg', position: 4, hidden: false }
];

class Database {
  constructor() {
    this.data = {
      products: [],
      categories: INITIAL_CATEGORIES,
      brands: INITIAL_BRANDS,
      orders: [],
      telegram_users: {},
      admin_ids: ['1929165295', '1248134309'],
      notifications: [],
      deleted_product_ids: [],
      deleted_brand_ids: [],
      deleted_category_ids: [],
      last_cloud_sync: null
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      }
      let loaded = false;
      let raw = null;
      if (fs.existsSync(DB_FILE)) {
        try {
          const content = fs.readFileSync(DB_FILE, 'utf8');
          if (content && content.trim()) {
            raw = content;
            loaded = true;
          }
        } catch(e) {}
      }
      if (!loaded && fs.existsSync(BACKUP_FILE)) {
        try {
          const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
          if (backupContent && backupContent.trim()) {
            raw = backupContent;
            loaded = true;
            console.log('[DB] Restored database state from store_backup.json');
          }
        } catch(e) {}
      }

      if (loaded && raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const rawAdmins = Array.isArray(parsed.admin_ids) && parsed.admin_ids.length ? parsed.admin_ids : [];
          const combinedAdmins = Array.from(new Set([...rawAdmins, '1929165295', '1248134309', 'invinciblee', 'wincher', 'Invinciblee', 'Wincher']));
          
          const deletedProdIds = Array.isArray(parsed.deleted_product_ids) ? parsed.deleted_product_ids : [];
          const deletedBrandIds = Array.isArray(parsed.deleted_brand_ids) ? parsed.deleted_brand_ids : [];
          const deletedCatIds = Array.isArray(parsed.deleted_category_ids) ? parsed.deleted_category_ids : [];

          // IMPORTANT: Filter out explicitly deleted items
          let existingProducts = Array.isArray(parsed.products) && parsed.products.length > 0
            ? parsed.products.filter(p => !deletedProdIds.includes(p.id))
            : INITIAL_PRODUCTS.filter(p => !deletedProdIds.includes(p.id));
          
          let existingCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories.filter(c => !deletedCatIds.includes(c.id))
            : INITIAL_CATEGORIES.filter(c => !deletedCatIds.includes(c.id));

          let existingBrands = Array.isArray(parsed.brands) && parsed.brands.length > 0
            ? parsed.brands.filter(b => !deletedBrandIds.includes(b.id))
            : INITIAL_BRANDS.filter(b => !deletedBrandIds.includes(b.id));

          this.data = {
            ...this.data,
            ...parsed,
            products: existingProducts,
            categories: existingCategories,
            brands: existingBrands,
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            telegram_users: parsed.telegram_users || {},
            admin_ids: combinedAdmins,
            notifications: parsed.notifications || [],
            deleted_product_ids: deletedProdIds,
            deleted_brand_ids: deletedBrandIds,
            deleted_category_ids: deletedCatIds,
            last_cloud_sync: parsed.last_cloud_sync || null
          };
          this.save();
        }
      } else {
        this.data.products = INITIAL_PRODUCTS;
        this.data.categories = INITIAL_CATEGORIES;
        this.data.brands = INITIAL_BRANDS;
        this.save();
      }
    } catch (err) {
      console.error('[DB] Failed to load store.json, using clean state:', err.message);
    }
  }

  save() {
    try {
      const serialized = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_FILE, serialized, 'utf8');
      try {
        fs.writeFileSync(BACKUP_FILE, serialized, 'utf8');
      } catch (e) {}
    } catch (err) {
      console.error('[DB] Failed to save store.json:', err.message);
    }
  }

  // Backup & Restore
  exportBackup() {
    return {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      store_data: JSON.parse(JSON.stringify(this.data))
    };
  }

  importBackup(backupObj) {
    if (!backupObj || typeof backupObj !== 'object') {
      throw new Error('Невалідний обʼєкт резервної копії');
    }
    const payload = backupObj.store_data || backupObj;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Не знайдено даних для відновлення');
    }

    const deletedProds = Array.isArray(payload.deleted_product_ids) ? payload.deleted_product_ids : (this.data.deleted_product_ids || []);
    this.data.deleted_product_ids = deletedProds;

    if (Array.isArray(payload.products)) {
      this.data.products = payload.products.filter(p => !deletedProds.includes(p.id));
    }
    if (Array.isArray(payload.categories)) {
      this.data.categories = payload.categories;
    }
    if (Array.isArray(payload.brands)) {
      this.data.brands = payload.brands;
    }
    if (Array.isArray(payload.orders)) {
      this.data.orders = payload.orders;
    }
    if (payload.telegram_users && typeof payload.telegram_users === 'object') {
      this.data.telegram_users = payload.telegram_users;
    }
    if (Array.isArray(payload.admin_ids) && payload.admin_ids.length > 0) {
      this.data.admin_ids = Array.from(new Set([...this.data.admin_ids, ...payload.admin_ids]));
    }
    this.data.last_cloud_sync = new Date().toISOString();
    this.save();
    return true;
  }

  async syncWithCloud(cloudBaseUrl = 'https://m1lipstore.onrender.com') {
    const cleanBase = (process.env.CLOUD_SYNC_URL || cloudBaseUrl || 'https://m1lipstore.onrender.com').replace(/\/$/, '');
    const currentHost = (process.env.APP_URL || '').toLowerCase();
    // Do not self-poll in an infinite loop if we are currently running on m1lipstore.onrender.com
    if (currentHost.includes('m1lipstore.onrender.com') && cleanBase.includes('m1lipstore.onrender.com')) {
      return { ok: true, skipped: true, reason: 'Running on primary production node' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const endpoints = [
        `${cleanBase}/api/sync/backup`,
        `${cleanBase}/api/products`
      ];

      let pulledData = null;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { signal: controller.signal });
          if (res.ok) {
            const json = await res.json();
            if (json && (json.store_data || Array.isArray(json))) {
              pulledData = json;
              break;
            }
          }
        } catch(e) {}
      }
      clearTimeout(timeoutId);

      if (!pulledData) {
        return { ok: false, reason: 'Could not fetch cloud data from ' + cleanBase };
      }

      if (pulledData.store_data) {
        const payload = pulledData.store_data;
        const deletedProds = new Set([...(this.data.deleted_product_ids || []), ...(payload.deleted_product_ids || [])]);
        this.data.deleted_product_ids = Array.from(deletedProds);

        if (Array.isArray(payload.products) && payload.products.length > 0) {
          // Merge products preserving local overrides and remote products
          const localMap = new Map((this.data.products || []).map(p => [p.id, p]));
          for (const remoteProd of payload.products) {
            if (!deletedProds.has(remoteProd.id)) {
              if (!localMap.has(remoteProd.id)) {
                localMap.set(remoteProd.id, remoteProd);
              }
            }
          }
          this.data.products = Array.from(localMap.values()).filter(p => !deletedProds.has(p.id));
        }

        if (Array.isArray(payload.categories) && payload.categories.length > 0) {
          const localCatMap = new Map((this.data.categories || []).map(c => [c.id || c.name, c]));
          for (const c of payload.categories) {
            if (!localCatMap.has(c.id || c.name)) localCatMap.set(c.id || c.name, c);
          }
          this.data.categories = Array.from(localCatMap.values());
        }

        if (Array.isArray(payload.brands) && payload.brands.length > 0) {
          const localBrandMap = new Map((this.data.brands || []).map(b => [b.id || b.name, b]));
          for (const b of payload.brands) {
            if (!localBrandMap.has(b.id || b.name)) localBrandMap.set(b.id || b.name, b);
          }
          this.data.brands = Array.from(localBrandMap.values());
        }

        if (Array.isArray(payload.orders) && payload.orders.length > 0) {
          const orderMap = new Map((this.data.orders || []).map(o => [o.order_id || o.id, o]));
          for (const o of payload.orders) {
            const key = o.order_id || o.id;
            if (!orderMap.has(key)) {
              orderMap.set(key, o);
            }
          }
          this.data.orders = Array.from(orderMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }

        this.data.last_cloud_sync = new Date().toISOString();
        this.save();
        return {
          ok: true,
          source: cleanBase,
          products_count: this.data.products.length,
          orders_count: this.data.orders.length,
          synced_at: this.data.last_cloud_sync
        };
      } else if (Array.isArray(pulledData) && pulledData.length > 0) {
        // Direct products array
        const deletedProds = new Set(this.data.deleted_product_ids || []);
        const localMap = new Map((this.data.products || []).map(p => [p.id, p]));
        for (const p of pulledData) {
          if (!deletedProds.has(p.id) && !localMap.has(p.id)) {
            localMap.set(p.id, p);
          }
        }
        this.data.products = Array.from(localMap.values()).filter(p => !deletedProds.has(p.id));
        this.data.last_cloud_sync = new Date().toISOString();
        this.save();
        return {
          ok: true,
          source: cleanBase,
          products_count: this.data.products.length,
          synced_at: this.data.last_cloud_sync
        };
      }
      return { ok: false, reason: 'Unrecognized cloud payload format' };
    } catch(err) {
      return { ok: false, reason: err.message };
    }
  }

  resetDemoData() {
    this.data.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.data.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.data.brands = JSON.parse(JSON.stringify(INITIAL_BRANDS));
    this.save();
    return true;
  }

  clearAllProducts() {
    this.data.products = [];
    this.save();
    return true;
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
    // If it was previously marked deleted, un-delete it
    if (this.data.deleted_product_ids) {
      this.data.deleted_product_ids = this.data.deleted_product_ids.filter(id => id !== product.id);
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
    const cleanId = String(id).trim();
    if (!this.data.deleted_product_ids) this.data.deleted_product_ids = [];
    if (!this.data.deleted_product_ids.includes(cleanId)) {
      this.data.deleted_product_ids.push(cleanId);
    }

    const idx = this.data.products.findIndex(p => p.id === cleanId || p.id.toLowerCase() === cleanId.toLowerCase());
    if (idx !== -1) {
      const removed = this.data.products.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    this.save();
    return { id: cleanId, deleted: true };
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

  getBrands(includeHidden = false) {
    if (includeHidden) {
      return [...this.data.brands].sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    return this.data.brands.filter(b => !b.hidden).sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  getBrandById(id) {
    if (!id) return null;
    const strId = String(id).trim().toLowerCase();
    return this.data.brands.find(b => 
      b.id.toLowerCase() === strId || 
      b.name.toLowerCase() === strId ||
      b.id.toLowerCase().replace(/^brand-/, '') === strId
    ) || null;
  }

  addBrand(brand) {
    if (!brand) return null;
    const name = (typeof brand === 'string' ? brand : brand.name || '').trim();
    if (!name) return null;
    const existing = this.data.brands.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (typeof brand === 'object' && brand.logo) {
        existing.logo = brand.logo;
        this.save();
      }
      return existing;
    }
    const id = (typeof brand === 'object' && brand.id) ? brand.id : `brand-${name.toLowerCase().replace(/[^a-z0-9а-яіїє]/gi, '-')}`;
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

  updateBrand(id, updates) {
    const brand = this.getBrandById(id);
    if (!brand) return null;
    Object.assign(brand, updates);
    this.save();
    return brand;
  }

  deleteBrand(id) {
    const brand = this.getBrandById(id);
    if (!brand) return null;
    const idx = this.data.brands.findIndex(b => b.id === brand.id);
    if (idx !== -1) {
      const removed = this.data.brands.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    return null;
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
