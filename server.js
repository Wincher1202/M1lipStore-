import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-Memory Data Store (mocked for Node.js runtime)
const categories = [
  { id: 'mice', name: 'Мишки', image: '', position: 0, hidden: false },
  { id: 'keyboards', name: 'Клавіатури', image: '', position: 1, hidden: false },
  { id: 'accessories', name: 'Аксесуари', image: '', position: 2, hidden: false },
  { id: 'audio', name: 'Аудіо', image: '', position: 3, hidden: false },
];

const brands = [
  { id: 'attack-shark', name: 'Attack Shark', logo: '', position: 0, hidden: false },
  { id: 'aula', name: 'AULA', logo: '', position: 1, hidden: false },
  { id: 'm1lip', name: 'M1LIP Custom', logo: '', position: 2, hidden: false },
  { id: 'vxe', name: 'VXE / VGN', logo: '', position: 3, hidden: false },
];

let products = [
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

let orders = [];
let userProfiles = new Map();

// Delivery mock data for realistic UX in Ukraine
const UKRAINE_CITIES = [
  { ref: 'city-kyiv', name: 'Київ', region: 'Київська' },
  { ref: 'city-kharkiv', name: 'Харків', region: 'Харківська' },
  { ref: 'city-odesa', name: 'Одеса', region: 'Одеська' },
  { ref: 'city-dnipro', name: 'Дніпро', region: 'Дніпропетровська' },
  { ref: 'city-lviv', name: 'Львів', region: 'Львівська' },
  { ref: 'city-zaporizhzhia', name: 'Запоріжжя', region: 'Запорізька' },
  { ref: 'city-vinnytsia', name: 'Вінниця', region: 'Вінницька' },
  { ref: 'city-poltava', name: 'Полтава', region: 'Полтавська' },
  { ref: 'city-chernihiv', name: 'Чернігів', region: 'Чернігівська' },
  { ref: 'city-cherkasy', name: 'Черкаси', region: 'Черкаська' },
  { ref: 'city-zhytomyr', name: 'Житомир', region: 'Житомирська' },
  { ref: 'city-sumy', name: 'Суми', region: 'Сумська' },
  { ref: 'city-khmelnytskyi', name: 'Хмельницький', region: 'Хмельницька' },
  { ref: 'city-chernivtsi', name: 'Чернівці', region: 'Чернівецька' },
  { ref: 'city-rivne', name: 'Рівне', region: 'Рівненська' },
  { ref: 'city-ivano-frankivsk', name: 'Івано-Франківськ', region: 'Івано-Франківська' },
  { ref: 'city-ternopil', name: 'Тернопіль', region: 'Тернопільська' },
  { ref: 'city-lutsk', name: 'Луцьк', region: 'Волинська' },
  { ref: 'city-uzhhorod', name: 'Ужгород', region: 'Закарпатська' }
];

function getMockWarehouses(cityName) {
  return [
    { ref: `wh-1-${cityName}`, name: `Відділення №1: вул. Центральна, 1`, address: `вул. Центральна, 1`, type: 'branch' },
    { ref: `wh-2-${cityName}`, name: `Відділення №2: просп. Перемоги, 15`, address: `просп. Перемоги, 15`, type: 'branch' },
    { ref: `wh-3-${cityName}`, name: `Відділення №3: вул. Соборна, 42`, address: `вул. Соборна, 42`, type: 'branch' },
    { ref: `pm-1-${cityName}`, name: `Поштомат №1050: вул. Шевченка, 20 (ТРЦ)`, address: `вул. Шевченка, 20`, type: 'postomat' },
    { ref: `pm-2-${cityName}`, name: `Поштомат №2140: просп. Миру, 8`, address: `просп. Миру, 8`, type: 'postomat' }
  ];
}

const RENDER_API_BASE = 'https://m1lipstore.onrender.com/api';

// Fetch live from Render if available, fallback to local data
app.get('/api/products', async (req, res) => {
  try {
    const r = await fetch(`${RENDER_API_BASE}/products`, { timeout: 3000 });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json(data);
      }
    }
  } catch (err) {
    // Render API is sleeping or down, use local data
  }

  let list = [...products.filter(p => !p.hidden)];
  const { category, brand, search, min_price, max_price, in_stock, sort } = req.query;

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

  res.json(list);
});

app.get('/api/categories', async (req, res) => {
  try {
    const r = await fetch(`${RENDER_API_BASE}/categories`, { timeout: 3000 });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json(data);
      }
    }
  } catch (err) {}
  res.json(categories.filter(c => !c.hidden).sort((a, b) => a.position - b.position));
});

app.get('/api/brands', async (req, res) => {
  try {
    const r = await fetch(`${RENDER_API_BASE}/brands`, { timeout: 3000 });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json(data);
      }
    }
  } catch (err) {}
  res.json(brands.filter(b => !b.hidden).sort((a, b) => a.position - b.position));
});

// ----------------------------------------------------
// Orders API
// ----------------------------------------------------

app.post('/api/orders', (req, res) => {
  const { customer, delivery, payment, comment, items } = req.body || {};
  if (!customer || !customer.firstName || !customer.phone) {
    return res.status(400).json({ detail: "Будь ласка, заповніть ім'я та телефон" });
  }
  if (!items || !items.length) {
    return res.status(400).json({ detail: 'Кошик порожній' });
  }

  let total = 0;
  const pricedItems = [];

  for (const item of items) {
    const p = products.find(prod => prod.id === item.id);
    if (!p) {
      return res.status(400).json({ detail: `Товар не знайдено` });
    }
    const qty = Number(item.qty) || 1;
    const color = item.color || '';
    const lineTotal = p.price * qty;
    total += lineTotal;

    // Deduct stock
    if (p.color_quantities && p.color_quantities[color] !== undefined) {
      p.color_quantities[color] = Math.max(0, p.color_quantities[color] - qty);
      p.quantity = Object.values(p.color_quantities).reduce((a, b) => a + b, 0);
    } else {
      p.quantity = Math.max(0, p.quantity - qty);
    }

    pricedItems.push({
      id: p.id,
      title: p.title,
      brand: p.brand,
      color,
      qty,
      price: p.price,
      lineTotal
    });
  }

  const orderId = `MLP-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderRecord = {
    order_id: orderId,
    status: 'NEW',
    tracking_number: null,
    total,
    created_at: new Date().toISOString(),
    customer,
    delivery,
    payment,
    comment: comment || '',
    items: pricedItems
  };

  orders.unshift(orderRecord);
  res.json({
    status: 'success',
    orderId,
    total,
    orderStatus: 'NEW'
  });
});

app.get('/api/orders/:order_id', (req, res) => {
  const order = orders.find(o => o.order_id === req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json(order);
});

// ----------------------------------------------------
// Delivery Service APIs
// ----------------------------------------------------

app.get('/api/delivery/providers', (req, res) => {
  res.json([
    { id: 'nova_poshta', name: 'Нова Пошта', configured: true },
    { id: 'ukrposhta', name: 'Укрпошта', configured: true },
    { id: 'mist', name: 'MIST', configured: true }
  ]);
});

app.get('/api/delivery/:provider_id/cities', (req, res) => {
  const q = (req.query.query || '').toString().trim().toLowerCase();
  if (q.length < 2) {
    return res.json([]);
  }
  const matched = UKRAINE_CITIES.filter(c =>
    c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
  );
  res.json(matched);
});

app.get('/api/delivery/:provider_id/warehouses', (req, res) => {
  const cityRef = (req.query.city_ref || '').toString();
  const q = (req.query.query || '').toString().trim().toLowerCase();

  const city = UKRAINE_CITIES.find(c => c.ref === cityRef) || { name: 'Місто' };
  let warehouses = getMockWarehouses(city.name);

  if (q) {
    warehouses = warehouses.filter(w =>
      w.name.toLowerCase().includes(q) || w.address.toLowerCase().includes(q)
    );
  }
  res.json(warehouses);
});

// ----------------------------------------------------
// User Profile & Addresses
// ----------------------------------------------------

app.get('/api/users/me/profile', (req, res) => {
  res.json({
    first_name: 'Гість',
    last_name: '',
    phone: '',
    saved_deliveries: []
  });
});

app.put('/api/users/me/profile', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/users/me/deliveries', (req, res) => {
  res.json({ status: 'ok', saved_deliveries: [] });
});

app.delete('/api/users/me/deliveries/:id', (req, res) => {
  res.json({ status: 'ok', saved_deliveries: [] });
});

app.get('/api/users/me/orders', (req, res) => {
  res.json(orders);
});

// ----------------------------------------------------
// Admin APIs
// ----------------------------------------------------

app.get('/api/admin/check', (req, res) => {
  res.json({ ok: true, user: { id: 1, first_name: 'Admin' } });
});

app.get('/api/admin/products', (req, res) => {
  res.json(products);
});

app.get('/api/admin/orders', (req, res) => {
  res.json(orders);
});

app.get('/api/admin/categories', (req, res) => {
  res.json(categories);
});

app.get('/api/admin/brands', (req, res) => {
  res.json(brands);
});

// ----------------------------------------------------
// Static File Serving
// ----------------------------------------------------

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`M1lipStore server listening on http://0.0.0.0:${PORT}`);
});
