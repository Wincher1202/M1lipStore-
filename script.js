/**
 * MILIPSTORE — DIGITAL SPACE 3.0
 * Clean Modular Architecture & Unified Localization (UA / RU)
 */

let tg = window.Telegram.WebApp;
tg.expand();

// Localization Dictionaries
const translations = {
    ua: {
        shop: "Магазин",
        new: "Новинки",
        mice: "Мишки",
        keyboards: "Клавіатури",
        headsets: "Навушники",
        accessories: "Аксесуари",
        cart: "Кошик",
        savedTitle: "ОБРАНЕ",
        searchPlaceholder: "Що ви шукаєте?",
        trending: "Популярне:",
        exploreSpace: "ДОСЛІДЖУВАТИ ПРОСТІР",
        exploreCategories: "EXPLORE YOUR SETUP",
        x3Desc: "Wireless Gaming Mouse. Флагманський сенсор PAW3395 та ультралегкий корпус 54г.",
        inStock: "В наявності",
        viewDetails: "VIEW PRODUCT →",
        newArrivals: "NEW ARRIVALS",
        setupLabTitle: "SETUP LAB.",
        configuratorTitle: "YOUR SETUP SUMMARY",
        totalSum: "TOTAL",
        orderSetupBtn: "ORDER SETUP →",
        backToSpace: "Назад до простору",
        colorNotSelected: "Колір не обрано",
        colorPrefix: "КОЛІР:",
        quantityLabel: "КІЛЬКІСТЬ:",
        specsTitle: "ХАРАКТЕРИСТИКИ",
        boxTitle: "КОМПЛЕКТАЦІЯ",
        addToCartBtn: "ДОДАТИ В КОШИК →",
        selectColorFirst: "ОБЕРИ КОЛІР",
        cartTitle: "КОШИК",
        subtotal: "Разом",
        checkoutBtn: "ОФОРМИТИ ЗАМОВЛЕННЯ →",
        checkoutTitle: "ОФОРМЛЕННЯ ЗАМОВЛЕННЯ",
        nameLabel: "Ваше ім'я *",
        contactLabel: "Telegram / Телефон *",
        commentLabel: "Коментар",
        confirmOrderBtn: "ПІДТВЕРДИТИ ЗАМОВЛЕННЯ",
        readyToUpgrade: "READY TO UPGRADE?",
        support: "Підтримка",
        warranty: "Гарантія",
        delivery: "Доставка",
        contacts: "Контакти"
    },
    ru: {
        shop: "Магазин",
        new: "Новинки",
        mice: "Мыши",
        keyboards: "Клавиатуры",
        headsets: "Наушники",
        accessories: "Аксессуары",
        cart: "Корзина",
        savedTitle: "ИЗБРАННОЕ",
        searchPlaceholder: "Что вы ищете?",
        trending: "Популярное:",
        exploreSpace: "ИССЛЕДОВАТЬ ПРОСТРАНСТВО",
        exploreCategories: "EXPLORE YOUR SETUP",
        x3Desc: "Wireless Gaming Mouse. Флагманский сенсор PAW3395 и ультралегкий корпус 54г.",
        inStock: "В наличии",
        viewDetails: "VIEW PRODUCT →",
        newArrivals: "NEW ARRIVALS",
        setupLabTitle: "SETUP LAB.",
        configuratorTitle: "YOUR SETUP SUMMARY",
        totalSum: "TOTAL",
        orderSetupBtn: "ORDER SETUP →",
        backToSpace: "Назад в пространство",
        colorNotSelected: "Цвет не выбран",
        colorPrefix: "ЦВЕТ:",
        quantityLabel: "КОЛИЧЕСТВО:",
        specsTitle: "ХАРАКТЕРИСТИКИ",
        boxTitle: "КОМПЛЕКТАЦИЯ",
        addToCartBtn: "ДОБАВИТЬ В КОРЗИНУ →",
        selectColorFirst: "ВЫБЕРИТЕ ЦВЕТ",
        cartTitle: "КОРЗИНА",
        subtotal: "Итого",
        checkoutBtn: "ОФОРМИТЬ ЗАКАЗ →",
        checkoutTitle: "ОФОРМЛЕНИЕ ЗАКАЗА",
        nameLabel: "Ваше имя *",
        contactLabel: "Telegram / Телефон *",
        commentLabel: "Комментарий",
        confirmOrderBtn: "ПОДТВЕРДИТЬ ЗАКАЗ",
        readyToUpgrade: "READY TO UPGRADE?",
        support: "Поддержка",
        warranty: "Гарантия",
        delivery: "Доставка",
        contacts: "Контакты"
    }
};

let currentLang = localStorage.getItem('milipstore_lang') || 'ua';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('milipstore_lang', lang);
    document.documentElement.setAttribute('data-lang', lang);

    document.getElementById('btnUA').classList.toggle('active', lang === 'ua');
    document.getElementById('btnRU').classList.toggle('active', lang === 'ru');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) el.innerText = translations[lang][key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) el.placeholder = translations[lang][key];
    });

    renderProducts(products);
    updateCartUI();
}

// Unified Products Database
let products = [
    {
        id: "attack-shark-x3",
        brand: "Attack Shark",
        name: "X3",
        category: "mice",
        price: 1549,
        stock: 5,
        image: "attack-shark-x3-box.jpg",
        gallery: [
            "attack-shark-x3-box.jpg",
            "attack-shark-x3-white.jpg",
            "attack-shark-x3-black.jpg"
        ],
        colors: {
            black: { name: "Чорний", hex: "#111111", image: "attack-shark-x3-black.jpg" },
            white: { name: "Білий", hex: "#ffffff", image: "attack-shark-x3-white.jpg" }
        },
        specifications: {
            sensor: "PAW3395",
            weight: "54G",
            pollingRate: "8000HZ",
            battery: "500 MAH"
        },
        packageContents: [
            { name: "Wireless Gaming Mouse X3", desc: "Ультралегкий корпус" },
            { name: "USB Type-C Cable", desc: "Паракордове обплетення" },
            { name: "2.4G Receiver", desc: "Мініатюрний адаптер" }
        ]
    }
];

let cart = [];
let wishlist = [];
let selectedColorKey = null;
let currentQty = 1;

document.addEventListener('DOMContentLoaded', () => {
    // Loading Screen Simulation
    let progress = 0;
    const bar = document.getElementById('loadingBar');
    const percent = document.getElementById('loadingPercent');
    const screen = document.getElementById('loadingScreen');

    let loadInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadInterval);
            setTimeout(() => screen.classList.add('fade-out'), 200);
        }
        if (bar) bar.style.width = progress + '%';
        if (percent) percent.innerText = progress + '%';
    }, 80);

    setLanguage(currentLang);
    renderProducts(products);
    updateCartUI();

    // Live Clock
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clockEl = document.getElementById('liveClock');
        if (clockEl) clockEl.innerText = timeStr;
    }, 1000);

    // Hero Mouse Parallax
    const heroArea = document.getElementById('heroOrbitArea');
    const renderImg = document.getElementById('heroProductRender');
    if (heroArea && renderImg) {
        heroArea.addEventListener('mousemove', (e) => {
            const rect = heroArea.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) * 0.03;
            const y = (e.clientY - rect.top - rect.height / 2) * 0.03;
            renderImg.style.transform = `translate(${x}px, ${y}px)`;
        });
        heroArea.addEventListener('mouseleave', () => {
            renderImg.style.transform = `translate(0px, 0px)`;
        });
    }
});

function renderProducts(list) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Товарів не знайдено</p>';
        return;
    }

    let html = '';
    list.forEach((p, index) => {
        let isSaved = wishlist.includes(p.id);
        html += `
            <div class="product-module-card" onclick="openProduct(${index})">
                <span class="module-top-index">0${index+1} / 0${list.length}</span>
                <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" style="position: absolute; top: 30px; right: 30px; background: none; border: none; cursor: pointer;">
                    <span class="material-symbols-outlined" style="font-size: 20px; color: ${isSaved ? '#ff2d55' : 'var(--text-muted)'};">favorite</span>
                </button>
                <div class="module-img-wrap">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="module-footer-row">
                    <div class="module-info">
                        <h4>${p.brand}</h4>
                        <h3>${p.name}</h3>
                        <span class="hover-specs-tag">VIEW PRODUCT → 54G • 8K • WIRELESS</span>
                    </div>
                    <span class="price" style="font-size: 20px; font-weight: 800;">${p.price} ₴</span>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// Product Showroom Page
function openProduct(index) {
    const p = products[index];
    const container = document.getElementById('productDetailContent');
    if (!container) return;

    selectedColorKey = null;
    currentQty = 1;
    let activeImg = p.image;

    let galleryHtml = '';
    p.gallery.forEach((img, i) => {
        galleryHtml += `<img src="${img}" alt="Thumb" onclick="switchMainImage('${img}')" style="width: 76px; height: 76px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border-color); cursor: pointer;">`;
    });

    let swatchesHtml = '';
    Object.keys(p.colors).forEach(k => {
        let col = p.colors[k];
        swatchesHtml += `<div class="swatch-item" style="background: ${col.hex}; ${col.hex === '#ffffff' ? 'border: 1px solid var(--border-color);' : ''}" onclick="selectColor('${k}', '${col.name}', '${col.image}', this)"></div>`;
    });

    container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 28px; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--border-color);">
            <div style="height: 400px; display: flex; align-items: center; justify-content: center; width: 100%;">
                <img id="showroomActiveImg" src="${activeImg}" alt="${p.name}" style="max-height: 360px; max-width: 100%; object-fit: contain; transition: opacity 0.3s;">
            </div>
            <div style="display: flex; gap: 12px; margin-top: 24px; overflow-x: auto; width: 100%; padding-bottom: 4px;">${galleryHtml}</div>
        </div>
        <div>
            <span style="font-size: 11px; font-weight: 800; color: var(--accent); letter-spacing: 1.5px;">MILIPSTORE / MICE / ${p.brand.toUpperCase()} ${p.name.toUpperCase()}</span>
            <h1 style="font-size: 40px; font-weight: 800; letter-spacing: -1.5px; margin: 10px 0 16px 0;">${p.brand} ${p.name}</h1>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 24px;">${p.price} ₴</div>
            <p style="color: var(--text-muted); font-size: 15px; line-height: 1.6; margin-bottom: 30px;">${translations[currentLang].x3Desc}</p>

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;"><span id="colorStatusLabel">${translations[currentLang].colorNotSelected}</span></div>
            <div class="color-swatches-row">${swatchesHtml}</div>

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;">${translations[currentLang].quantityLabel}</div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px;">
                <button onclick="changeQty(-1)" style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">−</button>
                <span id="qtyValDisplay" style="font-size: 16px; font-weight: 800;">1</span>
                <button onclick="changeQty(1)" style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">+</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px;">
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px;"><span style="font-size: 10px; color: var(--text-muted); font-weight: 800; display: block;">SENSOR</span><b style="font-size: 13px;">${p.specifications.sensor}</b></div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px;"><span style="font-size: 10px; color: var(--text-muted); font-weight: 800; display: block;">WEIGHT</span><b style="font-size: 13px;">${p.specifications.weight}</b></div>
            </div>

            <button id="addToCartDetailBtn" class="btn-digital-space" style="width: 100%; padding: 18px; opacity: 0.5; cursor: not-allowed;" disabled onclick="addToCart('${p.id}')">${translations[currentLang].selectColorFirst}</button>
        </div>
    `;

    switchView('product-detail');
}

function switchMainImage(url) {
    const img = document.getElementById('showroomActiveImg');
    if (!img) return;
    img.style.opacity = '0';
    setTimeout(() => {
        img.src = url;
        img.style.opacity = '1';
    }, 150);
}

function selectColor(key, name, image, el) {
    document.querySelectorAll('.swatch-item').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    selectedColorKey = key;

    const label = document.getElementById('colorStatusLabel');
    if (label) {
        label.innerText = `${translations[currentLang].colorPrefix} ${name.toUpperCase()}`;
        label.style.color = 'var(--accent)';
    }

    const btn = document.getElementById('addToCartDetailBtn');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerText = translations[currentLang].addToCartBtn;
    }

    switchMainImage(image);
}

function changeQty(delta) {
    if (currentQty + delta >= 1 && currentQty + delta <= 10) {
        currentQty += delta;
        const disp = document.getElementById('qtyValDisplay');
        if (disp) disp.innerText = currentQty;
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    if (viewName === 'home') document.getElementById('homeView').classList.add('active');
    if (viewName === 'product-detail') document.getElementById('productDetailView').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function filterCategory(cat) {
    switchView('home');
    if (cat === 'all') renderProducts(products);
    else renderProducts(products.filter(p => p.category === cat));
}

function previewCategory(cat) {
    // Interactive category hover preview handler
}

// Cart Drawer
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('cartBackdrop');

document.getElementById('cartToggleBtn').addEventListener('click', () => {
    cartDrawer.classList.add('active');
    cartBackdrop.classList.add('active');
});

function closeCartDrawer() {
    cartDrawer.classList.remove('active');
    cartBackdrop.classList.remove('active');
}

function addToCart(id) {
    if (!selectedColorKey) return;
    const p = products.find(item => item.id === id);
    if (!p) return;

    cart.push({
        name: `${p.brand} ${p.name}`,
        price: p.price,
        color: p.colors[selectedColorKey].name,
        qty: currentQty
    });

    updateCartUI();
    closeCartDrawer();
    cartDrawer.classList.add('active');
    cartBackdrop.classList.add('active');
}

function updateCartUI() {
    const list = document.getElementById('cartDrawerItems');
    const badge = document.getElementById('cartBadge');
    const totalEl = document.getElementById('cartTotalPrice');
    if (!list || !badge || !totalEl) return;

    let totalCount = cart.reduce((acc, item) => acc + item.qty, 0);
    if (cart.length === 0) {
        list.innerHTML = `<p style="text-align: center; color: var(--text-muted); margin-top: 40px;">${translations[currentLang].cartTitle} порожній</p>`;
        badge.style.display = 'none';
        totalEl.innerText = '0 ₴';
        return;
    }

    badge.style.display = 'flex';
    badge.innerText = totalCount;

    let html = '';
    let sum = 0;
    cart.forEach((item, idx) => {
        let itemSum = item.price * item.qty;
        sum += itemSum;
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 14px; border-radius: 12px; margin-bottom: 10px;">
                <div>
                    <h4 style="font-size: 13px; font-weight: 800;">${item.name}</h4>
                    <span style="font-size: 11px; color: var(--text-muted);">${item.color} | Qty: ${item.qty}</span>
                    <b style="font-size: 12px; color: var(--accent); display: block;">${itemSum} ₴</b>
                </div>
                <button onclick="removeFromCart(${idx})" style="background: none; border: none; color: var(--text-muted); cursor: pointer;"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
    });
    list.innerHTML = html;
    totalEl.innerText = sum + ' ₴';
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    updateCartUI();
}

// Wishlist Modal
function toggleWishlist(id) {
    const idx = wishlist.indexOf(id);
    if (idx > -1) wishlist.splice(idx, 1);
    else wishlist.push(id);
    renderProducts(products);
    updateWishlistUI();
}

function openWishlistModal() {
    updateWishlistUI();
    document.getElementById('wishlistModal').classList.add('active');
}

function closeWishlistModal() {
    document.getElementById('wishlistModal').classList.remove('active');
}

function updateWishlistUI() {
    const box = document.getElementById('wishlistModalItems');
    if (!box) return;
    if (wishlist.length === 0) {
        box.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">Список збереженого порожній</p>`;
        return;
    }
    let html = '';
    wishlist.forEach(id => {
        const p = products.find(item => item.id === id);
        if (p) {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 12px; border-radius: 12px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${p.image}" alt="" style="width: 36px; height: 36px; object-fit: contain;">
                        <div><h4 style="font-size: 12px; font-weight: 800;">${p.brand} ${p.name}</h4><b style="font-size: 11px; color: var(--accent);">${p.price} ₴</b></div>
                    </div>
                    <button onclick="toggleWishlist('${p.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><span class="material-symbols-outlined">delete</span></button>
                </div>
            `;
        }
    });
    box.innerHTML = html;
}

// Checkout Modal
function openCheckoutModal() {
    if (cart.length === 0) {
        alert('Кошик порожній!');
        return;
    }
    closeCartDrawer();
    document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('active');
}

function submitOrder() {
    const name = document.getElementById('orderName').value.trim();
    const contact = document.getElementById('orderContact').value.trim();
    if (!name || !contact) {
        alert('Вкажіть ім\'я та контакт!');
        return;
    }
    alert('Замовлення успішно прийняте у цифровий простір MILIPSTORE!');
    cart = [];
    updateCartUI();
    closeCheckoutModal();
    switchView('home');
}

// Search Overlay Logic
const searchOverlay = document.getElementById('searchOverlay');
document.getElementById('searchToggleBtn').addEventListener('click', () => {
    searchOverlay.classList.add('active');
    document.getElementById('searchInput').focus();
});

function closeSearch() {
    searchOverlay.classList.remove('active');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const resBox = document.getElementById('searchResultsLive');
    const filtered = products.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    
    if (!q) {
        resBox.innerHTML = '';
        return;
    }

    let html = '';
    filtered.forEach((p, idx) => {
        html += `
            <div onclick="closeSearch(); openProduct(0)" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 8px; cursor: pointer;">
                <img src="${p.image}" style="width: 40px; height: 40px; object-fit: contain;">
                <div><h4 style="font-size: 13px; font-weight: 800;">${p.brand} ${p.name}</h4><span style="font-size: 11px; color: var(--accent);">${p.price} ₴</span></div>
            </div>
        `;
    });
    resBox.innerHTML = html || '<p style="color: var(--text-muted);">Нічого не знайдено</p>';
});

function quickSearch(keyword) {
    document.getElementById('searchInput').value = keyword;
    document.getElementById('searchInput').dispatchEvent(new Event('input'));
}