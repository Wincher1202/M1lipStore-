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

let orders = [];
let userProfiles = new Map();

// Delivery mock data and live Nova Poshta integration for Ukraine
const UKRAINE_CITIES = [
  { ref: '8d5a980d-391c-11dd-90d9-001a92567626', name: 'Київ', region: 'Київська обл.' },
  { ref: 'db5c88e0-391c-11dd-90d9-001a92567626', name: 'Харків', region: 'Харківська обл.' },
  { ref: 'db5c88d0-391c-11dd-90d9-001a92567626', name: 'Одеса', region: 'Одеська обл.' },
  { ref: 'db5c88f0-391c-11dd-90d9-001a92567626', name: 'Дніпро', region: 'Дніпропетровська обл.' },
  { ref: 'db5c88f5-391c-11dd-90d9-001a92567626', name: 'Львів', region: 'Львівська обл.' },
  { ref: 'db5c88c6-391c-11dd-90d9-001a92567626', name: 'Запоріжжя', region: 'Запорізька обл.' },
  { ref: 'db5c88c7-391c-11dd-90d9-001a92567626', name: 'Кривий Ріг', region: 'Дніпропетровська обл.' },
  { ref: 'db5c88c8-391c-11dd-90d9-001a92567626', name: 'Миколаїв', region: 'Миколаївська обл.' },
  { ref: 'db5c88c9-391c-11dd-90d9-001a92567626', name: 'Вінниця', region: 'Вінницька обл.' },
  { ref: 'db5c88ca-391c-11dd-90d9-001a92567626', name: 'Полтава', region: 'Полтавська обл.' },
  { ref: 'db5c88cb-391c-11dd-90d9-001a92567626', name: 'Чернігів', region: 'Чернігівська обл.' },
  { ref: 'db5c88cc-391c-11dd-90d9-001a92567626', name: 'Черкаси', region: 'Черкаська обл.' },
  { ref: 'db5c88cd-391c-11dd-90d9-001a92567626', name: 'Житомир', region: 'Житомирська обл.' },
  { ref: 'db5c88ce-391c-11dd-90d9-001a92567626', name: 'Суми', region: 'Сумська обл.' },
  { ref: 'db5c88cf-391c-11dd-90d9-001a92567626', name: 'Хмельницький', region: 'Хмельницька обл.' },
  { ref: 'db5c88d1-391c-11dd-90d9-001a92567626', name: 'Чернівці', region: 'Чернівецька обл.' },
  { ref: 'db5c88d2-391c-11dd-90d9-001a92567626', name: 'Рівне', region: 'Рівненська обл.' },
  { ref: 'db5c88d3-391c-11dd-90d9-001a92567626', name: 'Івано-Франківськ', region: 'Івано-Франківська обл.' },
  { ref: 'db5c88d4-391c-11dd-90d9-001a92567626', name: "Кам'янське", region: 'Дніпропетровська обл.' },
  { ref: 'db5c88d5-391c-11dd-90d9-001a92567626', name: 'Тернопіль', region: 'Тернопільська обл.' },
  { ref: 'db5c88d6-391c-11dd-90d9-001a92567626', name: 'Кропивницький', region: 'Кіровоградська обл.' },
  { ref: 'db5c88d7-391c-11dd-90d9-001a92567626', name: 'Кременчук', region: 'Полтавська обл.' },
  { ref: 'db5c88d8-391c-11dd-90d9-001a92567626', name: 'Луцьк', region: 'Волинська обл.' },
  { ref: 'db5c88d9-391c-11dd-90d9-001a92567626', name: 'Біла Церква', region: 'Київська обл.' },
  { ref: 'db5c88da-391c-11dd-90d9-001a92567626', name: 'Ужгород', region: 'Закарпатська обл.' },
  { ref: 'db5c88db-391c-11dd-90d9-001a92567626', name: 'Бровари', region: 'Київська обл.' },
  { ref: 'db5c88dc-391c-11dd-90d9-001a92567626', name: 'Ірпінь', region: 'Київська обл.' },
  { ref: 'db5c88dd-391c-11dd-90d9-001a92567626', name: 'Буча', region: 'Київська обл.' }
];

function getMockNovaPoshtaWarehouses(cityName) {
  return [
    { ref: `np-wh-1-${cityName}`, name: `Відділення №1 (до 1100 кг): вул. Центральна, 1`, address: `вул. Центральна, 1`, type: 'branch' },
    { ref: `np-wh-2-${cityName}`, name: `Відділення №2 (до 30 кг): просп. Перемоги, 15`, address: `просп. Перемоги, 15`, type: 'branch' },
    { ref: `np-wh-3-${cityName}`, name: `Відділення №3 (до 30 кг): вул. Соборна, 42`, address: `вул. Соборна, 42`, type: 'branch' },
    { ref: `np-wh-4-${cityName}`, name: `Відділення №4 (до 30 кг): вул. Незалежності, 8`, address: `вул. Незалежності, 8`, type: 'branch' },
    { ref: `np-wh-5-${cityName}`, name: `Відділення №5 (до 30 кг): просп. Миру, 23`, address: `просп. Миру, 23`, type: 'branch' },
    { ref: `np-wh-6-${cityName}`, name: `Відділення №6 (до 30 кг): вул. Лесі Українки, 17`, address: `вул. Лесі Українки, 17`, type: 'branch' },
    { ref: `np-wh-7-${cityName}`, name: `Відділення №7 (до 30 кг): вул. Героїв Майдану, 50`, address: `вул. Героїв Майдану, 50`, type: 'branch' },
    { ref: `np-pm-1-${cityName}`, name: `Поштомат №1050: вул. Шевченка, 20 (ТРЦ)`, address: `вул. Шевченка, 20`, type: 'postomat' },
    { ref: `np-pm-2-${cityName}`, name: `Поштомат №2140: вул. Франка, 14`, address: `вул. Франка, 14`, type: 'postomat' },
    { ref: `np-pm-3-${cityName}`, name: `Поштомат №3305: просп. Свободи, 5`, address: `просп. Свободи, 5`, type: 'postomat' }
  ];
}

function getMockUkrposhtaWarehouses(cityName) {
  return [
    { ref: `up-main-${cityName}`, name: `Головне відділення (Головпоштамт): вул. Головна, 1`, address: `вул. Головна, 1`, type: 'main' },
    { ref: `up-1-${cityName}`, name: `Відділення Укрпошта №1: вул. Соборності, 12`, address: `вул. Соборності, 12`, type: 'standard' },
    { ref: `up-2-${cityName}`, name: `Відділення Укрпошта №2: вул. Шевченка, 45`, address: `вул. Шевченка, 45`, type: 'standard' },
    { ref: `up-3-${cityName}`, name: `Відділення Укрпошта №3: просп. Незалежності, 88`, address: `просп. Незалежності, 88`, type: 'standard' },
    { ref: `up-4-${cityName}`, name: `Відділення Укрпошта №4: вул. Франка, 21`, address: `вул. Франка, 21`, type: 'standard' },
    { ref: `up-5-${cityName}`, name: `Відділення Укрпошта №5: вул. Миру, 10`, address: `вул. Миру, 10`, type: 'standard' },
    { ref: `up-6-${cityName}`, name: `Відділення Укрпошта №6: вул. Богдана Хмельницького, 3`, address: `вул. Богдана Хмельницького, 3`, type: 'standard' }
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

app.post('/api/orders', async (req, res) => {
  const { customer, delivery, payment, comment, items } = req.body || {};
  const firstName = (customer?.first_name || customer?.firstName || '').trim();
  const phone = (customer?.phone || '').trim();

  if (!firstName || !phone) {
    return res.status(400).json({ detail: "Будь ласка, заповніть ім'я та контактний телефон" });
  }
  if (!items || !items.length) {
    return res.status(400).json({ detail: 'Кошик порожній' });
  }

  let subtotal = 0;
  const pricedItems = [];

  for (const item of items) {
    const p = products.find(prod => prod.id === item.id);
    if (!p) {
      return res.status(400).json({ detail: `Товар не знайдено` });
    }
    const qty = Math.max(1, Number(item.qty) || 1);
    const color = item.color || '';
    const lineTotal = p.price * qty;
    subtotal += lineTotal;

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
      lineTotal,
      img: (p.color_images && p.color_images[color] && p.color_images[color].main) || p.img
    });
  }

  const paymentMethod = payment?.method || 'online';
  const isCod = paymentMethod === 'cod';
  const codFee = isCod ? Math.round(20 + subtotal * 0.02) : 0;
  const total = subtotal + codFee;

  const orderId = `MLP-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderRecord = {
    order_id: orderId,
    id: orderId,
    status: 'NEW',
    tracking_number: null,
    subtotal,
    cod_fee: codFee,
    total,
    dispatch_timeline: '1-2 дні',
    shipping_note: 'Відправлення замовлення протягом 1-2 робочих днів з моменту оформлення',
    created_at: new Date().toISOString(),
    customer: {
      first_name: firstName,
      last_name: (customer?.last_name || customer?.lastName || '').trim(),
      email: (customer?.email || '').trim(),
      phone: phone
    },
    delivery: delivery || {},
    payment: {
      method: paymentMethod,
      is_cod: isCod,
      cod_fee: codFee,
      comment: (payment?.comment || comment || '').trim()
    },
    comment: (payment?.comment || comment || '').trim(),
    items: pricedItems
  };

  orders.unshift(orderRecord);
  res.json({
    status: 'success',
    order_id: orderId,
    id: orderId,
    orderId,
    subtotal,
    codFee,
    total,
    dispatch_timeline: '1-2 дні',
    shipping_note: 'Відправлення замовлення протягом 1-2 робочих днів',
    orderStatus: 'NEW'
  });
});

app.get('/api/orders/:order_id', (req, res) => {
  const order = orders.find(o => o.order_id === req.params.order_id || o.id === req.params.order_id);
  if (!order) {
    return res.status(404).json({ detail: 'Замовлення не знайдено' });
  }
  res.json(order);
});

// ----------------------------------------------------
// Delivery Service APIs
// ----------------------------------------------------

const NOVA_POSHTA_DEFAULT_KEY = '38993fae866d85598bf3e851cb919a6a';

app.get('/api/delivery/providers', (req, res) => {
  res.json([
    { id: 'nova_poshta', name: 'Нова Пошта', note: 'Відділення, поштомати та курʼєр', configured: true },
    { id: 'ukrposhta', name: 'Укрпошта', note: 'Відділення Експрес / Стандарт', configured: true }
  ]);
});

function parseDeliveryQuery(q) {
  if (!q) return { raw: '', clean: '', tokens: [], words: [], numbers: [], primaryWord: '', primaryNumber: '' };
  const raw = q.toString().trim();
  const normalized = raw.replace(/вулиця|вул\.?|проспект|просп\.?|бульвар|бул\.?|провулок|пров\.?|площа|шосе|набережна|тупик|№|#|\bд\.\b|\bбуд\.\b|\bкв\.\b|\bоф\.\b/gi, ' ')
                        .replace(/[,\.:;!?'"()]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
  const tokens = normalized.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const words = tokens.filter(t => !/^\d+[\wа-яіїєґ]*$/i.test(t));
  const numbers = tokens.filter(t => /^\d+[\wа-яіїєґ]*$/i.test(t));
  return {
    raw,
    clean: normalized,
    tokens,
    words,
    numbers,
    primaryWord: words[0] || '',
    primaryNumber: numbers[0] || ''
  };
}

async function handleCitySearch(req, res) {
  const q = (req.query.query || '').toString().trim();
  const provider = req.params.provider_id || req.query.provider || 'nova_poshta';
  const npApiKey = process.env.NOVA_POSHTA_API_KEY || NOVA_POSHTA_DEFAULT_KEY;

  if (q.length >= 2) {
    try {
      const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: npApiKey,
          modelName: 'Address',
          calledMethod: 'searchSettlements',
          methodProperties: {
            CityName: q,
            Limit: '30',
            Page: '1'
          }
        })
      });
      const data = await response.json();
      if (data.success && data.data && data.data[0]?.Addresses) {
        const liveCities = data.data[0].Addresses.map(addr => ({
          ref: addr.DeliveryCity || addr.Ref,
          name: addr.MainDescription || addr.Present,
          fullName: addr.Present,
          region: addr.Area ? `${addr.Area} обл.` : (addr.Region || '')
        }));
        if (liveCities.length > 0) return res.json(liveCities);
      }
    } catch (e) {
      // fallback on network error
    }
  }

  if (q.length < 2) {
    return res.json(UKRAINE_CITIES.slice(0, 10));
  }
  const qLower = q.toLowerCase();
  const matched = UKRAINE_CITIES.filter(c =>
    c.name.toLowerCase().includes(qLower) || c.region.toLowerCase().includes(qLower)
  );
  res.json(matched);
}

app.get('/api/delivery/cities', handleCitySearch);
app.get('/api/delivery/:provider_id/cities', handleCitySearch);

async function handleWarehouseSearch(req, res) {
  const cityRef = (req.query.city_ref || req.query.cityRef || '').toString();
  const cityNameReq = (req.query.city_name || req.query.cityName || '').toString().trim();
  const rawQ = (req.query.query || '').toString().trim();
  const provider = req.params.provider_id || req.query.provider || 'nova_poshta';
  const typeFilter = (req.query.type || '').toString().trim(); // 'branch', 'postomat', 'all'
  const npApiKey = process.env.NOVA_POSHTA_API_KEY || NOVA_POSHTA_DEFAULT_KEY;

  const qInfo = parseDeliveryQuery(rawQ);

  let matchedCity = UKRAINE_CITIES.find(c => c.ref === cityRef || c.name.toLowerCase() === cityNameReq.toLowerCase());
  const cityName = cityNameReq || (matchedCity ? matchedCity.name : 'Київ');

  if (provider === 'nova_poshta' || provider.startsWith('nova_poshta')) {
    try {
      const npSearchTerm = qInfo.primaryWord || qInfo.primaryNumber || qInfo.clean;
      const methodProperties = {
        CityName: cityName,
        Limit: '100',
        Page: '1'
      };
      if (npSearchTerm) {
        methodProperties.FindByString = npSearchTerm;
      }

      let response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: npApiKey,
          modelName: 'Address',
          calledMethod: 'getWarehouses',
          methodProperties
        })
      });
      let data = await response.json();
      let rawList = (data.success && Array.isArray(data.data)) ? data.data : [];

      // If nothing returned and we had a search term, try fetching base city list
      if (rawList.length === 0 && npSearchTerm) {
        const fallbackResp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: npApiKey,
            modelName: 'Address',
            calledMethod: 'getWarehouses',
            methodProperties: {
              CityName: cityName,
              Limit: '150',
              Page: '1'
            }
          })
        });
        const fallbackData = await fallbackResp.json();
        if (fallbackData.success && Array.isArray(fallbackData.data)) {
          rawList = fallbackData.data;
        }
      }

      if (rawList.length > 0) {
        let liveWh = rawList.map(w => {
          const isPostomat = w.CategoryOfWarehouse === 'Postomat' || (w.Description && w.Description.toLowerCase().includes('поштомат'));
          const maxWeight = w.TotalMaxWeightAllowed ? `${w.TotalMaxWeightAllowed} кг` : (w.PlaceMaxWeightAllowed ? `${w.PlaceMaxWeightAllowed} кг` : '');
          return {
            ref: w.Ref,
            number: w.Number,
            name: w.Description,
            address: w.ShortAddress || w.Description,
            type: isPostomat ? 'postomat' : 'branch',
            maxWeight: maxWeight,
            schedule: w.Schedule || null
          };
        });

        // Filter by type if requested
        if (typeFilter === 'postomat') {
          liveWh = liveWh.filter(w => w.type === 'postomat');
        } else if (typeFilter === 'branch') {
          liveWh = liveWh.filter(w => w.type === 'branch');
        }

        // Token scoring & ranking
        if (qInfo.tokens.length > 0) {
          liveWh.forEach(item => {
            const fullText = (item.name + ' ' + item.address + ' ' + item.number).toLowerCase();
            let matchCount = 0;
            qInfo.tokens.forEach(tok => {
              if (fullText.includes(tok)) matchCount++;
            });
            item._matchScore = matchCount;
            if (qInfo.primaryNumber && (item.number === qInfo.primaryNumber || item.address.includes(qInfo.primaryNumber))) {
              item._matchScore += 2;
            }
          });

          const matching = liveWh.filter(item => item._matchScore > 0);
          if (matching.length > 0) {
            matching.sort((a, b) => b._matchScore - a._matchScore);
            liveWh = matching;
          }
        }

        return res.json(liveWh);
      }
    } catch (e) {
      // fallback on network error
    }
  }

  // Fallback or Ukrposhta warehouses
  let warehouses = provider === 'ukrposhta'
    ? getMockUkrposhtaWarehouses(cityName)
    : getMockNovaPoshtaWarehouses(cityName);

  if (typeFilter === 'postomat') {
    warehouses = warehouses.filter(w => w.type === 'postomat');
  } else if (typeFilter === 'branch') {
    warehouses = warehouses.filter(w => w.type === 'branch');
  }

  if (qInfo.tokens.length > 0) {
    warehouses.forEach(w => {
      const fullText = (w.name + ' ' + (w.address || '')).toLowerCase();
      let matchCount = 0;
      qInfo.tokens.forEach(tok => {
        if (fullText.includes(tok)) matchCount++;
      });
      w._matchScore = matchCount;
    });

    let filtered = warehouses.filter(w => w._matchScore > 0);
    if (filtered.length > 0) {
      filtered.sort((a, b) => b._matchScore - a._matchScore);
      return res.json(filtered);
    }

    if (qInfo.primaryNumber) {
      if (provider === 'ukrposhta') {
        return res.json([
          { ref: `up-custom-${qInfo.primaryNumber}`, name: `Відділення Укрпошти №${qInfo.primaryNumber}: вул. Головна, ${qInfo.primaryNumber}`, address: `вул. Головна, ${qInfo.primaryNumber}`, type: 'branch' }
        ]);
      } else {
        const isPostomat = typeFilter === 'postomat';
        return res.json([
          isPostomat
            ? { ref: `np-pm-custom-${qInfo.primaryNumber}`, name: `Поштомат №${qInfo.primaryNumber}: вул. ${qInfo.primaryWord || 'Центральна'}, ${qInfo.primaryNumber}`, address: `вул. ${qInfo.primaryWord || 'Центральна'}, ${qInfo.primaryNumber}`, type: 'postomat' }
            : { ref: `np-wh-custom-${qInfo.primaryNumber}`, name: `Відділення №${qInfo.primaryNumber} (до 30 кг): вул. ${qInfo.primaryWord || 'Центральна'}, ${qInfo.primaryNumber}`, address: `вул. ${qInfo.primaryWord || 'Центральна'}, ${qInfo.primaryNumber}`, type: 'branch' }
        ]);
      }
    }
  }

  res.json(warehouses);
}

app.get('/api/delivery/warehouses', handleWarehouseSearch);
app.get('/api/delivery/:provider_id/warehouses', handleWarehouseSearch);

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
