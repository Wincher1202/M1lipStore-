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
        acc_box: "03. КОМПЛЕКТАЦІЯ (INSIDE THE BOX)",
        box_text: "Фірмова коробка, миша Attack Shark X3, бездротовий приймач 2.4G (донгл), кабель USB Type-C в м'якому обплетенні, інструкція користувача.",
        acc_warranty: "04. ГАРАНТІЯ",
        warranty_text: "Офіційна гарантія від виробника та магазину MILIPSTORE — 12 місяців з повною підтримкою та сервісом.",
        acc_delivery: "05. ДОСТАВКА ТА ОПЛАТА",
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
        acc_box: "03. КОМПЛЕКТАЦИЯ (INSIDE THE BOX)",
        box_text: "Фирменная коробка, мышь Attack Shark X3, беспроводной приемник 2.4G (донгл), кабель USB Type-C в мягкой оплетке, инструкция пользователя.",
        acc_warranty: "04. ГАРАНТИЯ",
        warranty_text: "Официальная гарантия от производителя и магазина MILIPSTORE — 12 месяцев с полной поддержкой и сервисом.",
        acc_delivery: "05. ДОСТАВКА И ОПЛАТА",
        delivery_text: "Новая Почта по Украине (1-2 дня), курьерская доставка, оплата при получении или на карту/счет ФЛП.",
        cart_title: "КОРЗИНА",
        cart_empty: "Ваша корзина пока пуста",
        cart_total: "Итого:",
        cart_checkout: "ОФОРМИТЬ ЗАКАЗ",
        search_title: "WHAT ARE YOU LOOKING FOR?",
        trend_label: "TRENDING:"
    }
};

// State Management
let currentLang = localStorage.getItem('milipstore_lang') || 'uk';
let selectedColor = null;
let cart = [];
let wishlist = [];

// DOM Loaded Initialization
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initClock();
    setLanguage(currentLang);
    initParallax();
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
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 300);
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
        clockEl.textContent = `${hours}:${minutes}`;
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
        if (translations[lang][key]) {
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
function openProductModal() {
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

    document.querySelectorAll('.thumb-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });

    document.querySelector('.gallery-progress').textContent = `0${index + 1} / 04`;
}

// Color Selector
function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains(color));
    });
    
    const colorLabel = document.getElementById('selectedColorLabel');
    colorLabel.textContent = color.toUpperCase();

    // Auto-switch image based on color
    if (color === 'black') {
        switchImage('attack-shark-x3-black.jpg', 1);
    } else if (color === 'white') {
        switchImage('attack-shark-x3-white.jpg', 2);
    }
}

// Accordion Toggle
function toggleAccordion(btn) {
    const accordion = btn.parentElement;
    accordion.classList.toggle('active');
}

// Wishlist Logic
function toggleWishlist(btn) {
    btn.classList.toggle('active');
    const countEl = document.getElementById('wishlist-count');
    if (btn.classList.contains('active')) {
        wishlist.push('Attack Shark X3');
    } else {
        wishlist = wishlist.filter(item => item !== 'Attack Shark X3');
    }
    countEl.textContent = wishlist.length;
}

function toggleModalWishlist() {
    const btn = document.getElementById('modalWishBtn');
    btn.style.color = btn.style.color === 'rgb(255, 51, 102)' ? '' : '#FF3366';
    btn.style.borderColor = btn.style.color;
}

// Cart Logic
function addToCart() {
    if (!selectedColor) {
        alert(currentLang === 'uk' ? 'Будь ласка, виберіть колір миші!' : 'Пожалуйста, выберите цвет мыши!');
        return;
    }

    const item = {
        name: 'Attack Shark X3',
        color: selectedColor,
        price: 2499,
        image: selectedColor === 'black' ? 'attack-shark-x3-black.jpg' : 'attack-shark-x3-white.jpg'
    };

    cart.push(item);
    updateCartUI();
    openCart();
}

function updateCartUI() {
    const listEl = document.getElementById('cartItemsList');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cartTotalPrice');

    countEl.textContent = cart.length;

    if (cart.length === 0) {
        listEl.innerHTML = `<div class="empty-cart" data-i18n="cart_empty">${translations[currentLang].cart_empty}</div>`;
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
                    <p>Колір: ${item.color.toUpperCase()}</p>
                    <strong>₴ ${item.price}</strong>
                </div>
                <button onclick="removeFromCart(${index})" style="background:none;border:none;cursor:pointer;margin-left:auto;color:#999;">×</button>
            </div>
        `;
    });

    listEl.innerHTML = html;
    totalEl.textContent = `₴ ${total}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
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
    alert(currentLang === 'uk' ? 'Дякуємо! Система оформлення замовлення готова до інтеграції з Firebase / Telegram Bot.' : 'Спасибо! Система оформления заказа готова к интеграции с Firebase / Telegram Bot.');
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

    if ('attack shark x3 mice paw3395'.includes(query.toLowerCase())) {
        resultsEl.innerHTML = `
            <div class="search-result-item" onclick="closeSearch(); openProductModal();">
                <div>
                    <strong>Attack Shark X3 Wireless Gaming Mouse</strong>
                    <p style="font-size:0.75rem; color:#666;">Mice / PAW3395 / 54G</p>
                </div>
                <span style="font-weight:700;">₴ 2,499 →</span>
            </div>
        `;
    } else {
        resultsEl.innerHTML = `<div style="padding: 20px; color: #666;">Нічого не знайдено / Ничего не найдено</div>`;
    }
}