// Translations dictionary (UA & RU)
const translations = {
    uk: {
        loader_sub: "DIGITAL EXPERIENCE",
        nav_catalog: "МАГАЗИН",
        nav_new: "НОВИНКИ",
        nav_mice: "МИШКИ",
        nav_setup: "SETUP LAB",
        nav_delivery: "ДОСТАВКА",
        sys_online: "MILIPSTORE SYSTEM ONLINE",
        hero_label: "MILIPSTORE / DIGITAL PERIPHERALS",
        click_to_open: "ВІДКРИТИ ПРОСТІР →",
        cat_title: "DIGITAL SPACE CATALOGUE",
        view_product: "ПЕРЕГЛЯНУТИ →",
        bread_mice: "МИШКИ",
        tag_bestseller: "BESTSELLER 2026",
        prod_subtitle: "Ультралегка бездротова ігрова миша трирежимного підключення",
        in_stock: "● В наявності (18 шт)",
        label_color: "КОЛІР:",
        color_not_selected: "НЕ ВИБРАНО",
        thumb_box: "Коробка",
        thumb_black: "Black",
        thumb_white: "White",
        btn_add_cart: "ДОДАТИ В КОШИК",
        acc_desc: "01. ОПИС ТОВАРУ",
        desc_text: "Attack Shark X3 створена для кіберспорту та професійного геймінгу. Ергономічний корпус вагою всього 54 грами, флагманський сенсор PAW3395 та підтримка частоти опитування 8000 Гц забезпечують блискавичну реакцію без затримок.",
        acc_specs: "02. ХАРАКТЕРИСТИКИ",
        acc_delivery: "03. ДОСТАВКА ТА ОПЛАТА",
        delivery_text: "Нова Пошта по Україні (1-2 дні), кур'єрська доставка, оплата при отриманні або на картку/рахунок ФОП.",
        cart_title: "КОШИК",
        cart_empty: "Ваш кошик наразі порожній",
        cart_total: "Разом:",
        cart_checkout: "ОФОРМИТИ ЗАМОВЛЕННЯ",
        search_title: "WHAT ARE YOU LOOKING FOR?",
        trend_label: "TRENDING:"
    },
    ru: {
        loader_sub: "DIGITAL EXPERIENCE",
        nav_catalog: "МАГАЗИН",
        nav_new: "НОВИНКИ",
        nav_mice: "МЫШКИ",
        nav_setup: "SETUP LAB",
        nav_delivery: "ДОСТАВКА",
        sys_online: "MILIPSTORE SYSTEM ONLINE",
        hero_label: "MILIPSTORE / DIGITAL PERIPHERALS",
        click_to_open: "ОТКРЫТЬ ПРОСТРАНСТВО →",
        cat_title: "DIGITAL SPACE CATALOGUE",
        view_product: "ПОСМОТРЕТЬ →",
        bread_mice: "МЫШКИ",
        tag_bestseller: "BESTSELLER 2026",
        prod_subtitle: "Ультралегкая беспроводная игровая мышь трехрежимного подключения",
        in_stock: "● В наличии (18 шт)",
        label_color: "ЦВЕТ:",
        color_not_selected: "НЕ ВЫБРАНО",
        thumb_box: "Коробка",
        thumb_black: "Black",
        thumb_white: "White",
        btn_add_cart: "ДОБАВИТЬ В КОРЗИНУ",
        acc_desc: "01. ОПИСАНИЕ ТОВАРА",
        desc_text: "Attack Shark X3 создана для киберспорта и профессионального гейминга. Эргономичный корпус весом всего 54 грамма, флагманский сенсор PAW3395 и поддержка частоты опроса 8000 Гц обеспечивают молниеносную реакцию без задержек.",
        acc_specs: "02. ХАРАКТЕРИСТИКИ",
        acc_delivery: "03. ДОСТАВКА И ОПЛАТА",
        delivery_text: "Новая Почта по Украине (1-2 дня), курьерская доставка, оплата при получении или на карту/счет ФЛП.",
        cart_title: "КОРЗИНА",
        cart_empty: "Ваша корзина пока пуста",
        cart_total: "Итого:",
        cart_checkout: "ОФОРМИТЬ ЗАКАЗ",
        search_title: "WHAT ARE YOU LOOKING FOR?",
        trend_label: "TRENDING:"
    }
};

// Database of products for dynamic modal switching
const productsData = {
    'x3': {
        name: 'ATTACK SHARK X3',
        subtitle: 'Ультралегка бездротова ігрова миша трирежимного підключення',
        price: 2499,
        rawPrice: 2499,
        category: 'MICE',
        images: ['attack-shark-x3-box.jpg', 'attack-shark-x3-black.jpg', 'attack-shark-x3-white.jpg'],
        hasColors: true,
        specs: `
            <li><span>Сенсор:</span> <strong>PixArt PAW3395</strong></li>
            <li><span>Вага:</span> <strong>54 г</strong></li>
            <li><span>Частота опитування:</span> <strong>До 8000 Гц</strong></li>
            <li><span>Підключення:</span> <strong>Wired / 2.4G / Bluetooth 5.4</strong></li>
        `,
        desc: 'Attack Shark X3 створена для кіберспорту та професійного геймінгу. Ергономічний корпус вагою всього 54 грами, флагманський сенсор PAW3395 та підтримка частоти опитування 8000 Гц забезпечують блискавичну реакцію без затримок.'
    },
    'pad': {
        name: 'ESPORTS CONTROL MOUSEPAD',
        subtitle: 'Професійний ігровий килимок з контролюючим покриттям Cordura',
        price: 899,
        rawPrice: 899,
        category: 'SETUP LAB',
        images: ['attack-shark-x3-white.jpg'],
        hasColors: false,
        specs: `
            <li><span>Матеріал:</span> <strong>Cordura / Natural Rubber</strong></li>
            <li><span>Розмір:</span> <strong>480 x 400 x 4 мм</strong></li>
            <li><span>База:</span> <strong>Протиковзка гумова основа</strong></li>
        `,
        desc: 'Високоякісний ігровий килимок, що забезпечує ідеальний баланс між швидкістю ковзання миші та зупинкою під час точного прицілювання в шутерах.'
    }
};

// State Management
let currentLang = localStorage.getItem('milipstore_lang') || 'uk';
let selectedColor = null;
let currentProductId = 'x3';
let cart = JSON.parse(localStorage.getItem('milipstore_cart')) || [];
let wishlist = [];

// DOM Loaded Initialization
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initClock();
    setLanguage(currentLang);
    initParallax();
    updateCartUI();
});

// Loader simulation
function initLoader() {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loader-bar');
    const percent = document.getElementById('loader-percent');
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => { loader.classList.add('hidden'); }, 300);
        }
        bar.style.width = progress + '%';
        percent.textContent = progress + '%';
    }, 120);
}

// Live Clock
function initClock() {
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if(clockEl) clockEl.textContent = `${hours}:${minutes}`;
    }, 1000);
}

// Language Switcher
document.querySelectorAll('[data-lang-switch]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const lang = e.target.getAttribute('data-lang-switch');
        setLanguage(lang);
    });
});

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('milipstore_lang', lang);
    
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang-switch') === lang);
    });
    
    document.documentElement.setAttribute('lang', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    if (!selectedColor) {
        const colorLabel = document.getElementById('selectedColorLabel');
        if (colorLabel) colorLabel.textContent = lang === 'uk' ? 'НЕ ВИБРАНО' : 'НЕ ВЫБРАНО';
    }
}

// Header Scroll Effect
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 40) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Hero Parallax effect
function initParallax() {
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        const floatCard = document.getElementById('heroProductCard');
        if (floatCard) {
            floatCard.style.transform = `translate(${x}px, ${y}px)`;
        }
    });
}

// Product Modal Operations
function openProductModal(productId = 'x3') {
    currentProductId = productId;
    const prod = productsData[productId];
    if (!prod) return;

    // Populate Modal Data
    document.getElementById('modalTitle').textContent = prod.name;
    document.getElementById('modalSubtitle').textContent = prod.subtitle;
    document.getElementById('modalPrice').textContent = `₴ ${prod.price}`;
    document.getElementById('modalDescText').textContent = prod.desc;
    document.getElementById('modalSpecsList').innerHTML = prod.specs;
    document.getElementById('modalBreadcrumb').innerHTML = `MILIPSTORE / <span>${prod.category}</span> / ${prod.name}`;

    // Handle Color options block display
    const colorBlock = document.getElementById('colorConfigBlock');
    if (prod.hasColors) {
        colorBlock.style.display = 'block';
        selectedColor = null;
        document.getElementById('selectedColorLabel').textContent = currentLang === 'uk' ? 'НЕ ВИБРАНО' : 'НЕ ВЫБРАНО';
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
    } else {
        colorBlock.style.display = 'none';
        selectedColor = 'default';
    }

    // Render gallery thumbnails dynamically
    const thumbsContainer = document.getElementById('thumbnailsContainer');
    let thumbsHtml = '';
    prod.images.forEach((img, idx) => {
        const thumbName = idx === 0 ? (currentLang === 'uk' ? 'Вигляд' : 'Вид') : (idx === 1 ? 'Black' : 'White');
        thumbsHtml += `
            <button class="thumb-btn ${idx === 0 ? 'active' : ''}" onclick="switchImage('${img}', ${idx})">
                <img src="${img}" alt="Thumb">
                <span>${thumbName}</span>
            </button>
        `;
    });
    thumbsContainer.innerHTML = thumbsHtml;
    document.getElementById('mainGalleryImg').src = prod.images[0];
    document.getElementById('galleryProgress').textContent = `01 / 0${prod.images.length}`;

    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Gallery image switching
function switchImage(src, index) {
    const mainImg = document.getElementById('mainGalleryImg');
    mainImg.style.opacity = '0';
    mainImg.style.transform = 'scale(0.96)';
    
    setTimeout(() => {
        mainImg.src = src;
        mainImg.style.opacity = '1';
        mainImg.style.transform = 'scale(1)';
    }, 200);

    const prod = productsData[currentProductId];
    document.querySelectorAll('.thumb-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });

    document.getElementById('galleryProgress').textContent = `0${index + 1} / 0${prod.images.length}`;
}

// Color Selector
function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains(color));
    });
    
    const colorLabel = document.getElementById('selectedColorLabel');
    colorLabel.textContent = color.toUpperCase();

    if (currentProductId === 'x3') {
        if (color === 'black') switchImage('attack-shark-x3-black.jpg', 1);
        else if (color === 'white') switchImage('attack-shark-x3-white.jpg', 2);
    }
}

// Accordion Toggle
function toggleAccordion(btn) {
    const accordion = btn.parentElement;
    accordion.classList.toggle('active');
}

// Wishlist Logic
function toggleWishlist(itemName, btn) {
    btn.classList.toggle('active');
    const countEl = document.getElementById('wishlist-count');
    if (btn.classList.contains('active')) {
        wishlist.push(itemName);
    } else {
        wishlist = wishlist.filter(item => item !== itemName);
    }
    countEl.textContent = wishlist.length;
}

function toggleModalWishlist() {
    const btn = document.getElementById('modalWishBtn');
    const prod = productsData[currentProductId];
    btn.style.color = btn.style.color === 'rgb(255, 51, 102)' ? '' : '#FF3366';
    btn.style.borderColor = btn.style.color;
    toggleWishlist(prod.name, btn);
}

// Cart Logic
function addToCart() {
    const prod = productsData[currentProductId];
    if (prod.hasColors && !selectedColor) {
        alert(currentLang === 'uk' ? 'Будь ласка, виберіть колір миші!' : 'Пожалуйста, выберите цвет мыши!');
        return;
    }

    const item = {
        name: prod.name,
        color: selectedColor && selectedColor !== 'default' ? selectedColor : '',
        price: prod.price,
        image: prod.images[0]
    };

    cart.push(item);
    saveCart();
    updateCartUI();
    openCart();
}

function saveCart() {
    localStorage.setItem('milipstore_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const listEl = document.getElementById('cartItemsList');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cartTotalPrice');

    countEl.textContent = cart.length;

    if (cart.length === 0) {
        listEl.innerHTML = `<div class="empty-cart">${translations[currentLang].cart_empty}</div>`;
        totalEl.textContent = '₴ 0';
        return;
    }

    let html = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price;
        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    ${item.color ? `<p>${currentLang === 'uk' ? 'Колір' : 'Цвет'}: ${item.color.toUpperCase()}</p>` : ''}
                    <strong>₴ ${item.price}</strong>
                </div>
                <button onclick="removeFromCart(${index})" style="background:none;border:none;cursor:pointer;margin-left:auto;color:#999;font-size:1.2rem;">×</button>
            </div>
        `;
    });

    listEl.innerHTML = html;
    totalEl.textContent = `₴ ${total}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function openCart() {
    document.getElementById('cartDrawer').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartDrawer').classList.remove('active');
    document.body.style.overflow = '';
}

function checkout() {
    alert(currentLang === 'uk' ? 'Дякуємо! Замовлення успішно сформовано.' : 'Спасибо! Заказ успешно сформирован.');
    cart = [];
    saveCart();
    updateCartUI();
    closeCart();
}

// Search Overlay Logic
document.getElementById('search-btn').addEventListener('click', () => {
    document.getElementById('searchOverlay').classList.add('active');
    document.getElementById('searchInput').focus();
    document.body.style.overflow = 'hidden';
});

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function setSearchQuery(query) {
    document.getElementById('searchInput').value = query;
    handleSearch(query);
}

function handleSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsEl.innerHTML = '';
        return;
    }

    const q = query.toLowerCase();
    let resultsHtml = '';

    if ('attack shark x3 mice paw3395'.includes(q)) {
        resultsHtml += `
            <div class="search-result-item" onclick="closeSearch(); openProductModal('x3');">
                <div>
                    <strong>Attack Shark X3 Wireless Gaming Mouse</strong>
                    <p style="font-size:0.75rem; color:#666;">Mice / PAW3395 / 54G</p>
                </div>
                <span style="font-weight:700;">₴ 2,499 →</span>
            </div>
        `;
    }
    if ('pad mat килимок cordura'.includes(q)) {
        resultsHtml += `
            <div class="search-result-item" onclick="closeSearch(); openProductModal('pad');">
                <div>
                    <strong>Esports Control Mousepad</strong>
                    <p style="font-size:0.75rem; color:#666;">Setup Lab / Control</p>
                </div>
                <span style="font-weight:700;">₴ 899 →</span>
            </div>
        `;
    }

    resultsEl.innerHTML = resultsHtml || `<div style="padding: 20px; color: #666;">${currentLang === 'uk' ? 'Нічого не знайдено' : 'Ничего не найдено'}</div>`;
}