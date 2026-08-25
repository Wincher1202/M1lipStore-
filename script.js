/**
 * MILIPSTORE — Digital Gallery & Gaming Showroom
 * Complete Localization, Clean Architecture & Interactive Experience
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
        wishlist: "Обране",
        searchPlaceholder: "Що ви шукаєте?",
        quickSearch: "Швидкі запити:",
        heroDesc: "Периферія, яка доповнює твій setup.",
        shopNow: "ПЕРЕГЛЯНУТИ ТОВАРИ",
        collectionTag: "SHOWROOM COLLECTION",
        exploreSetup: "EXPLORE YOUR SETUP",
        productOfWeekTag: "CURATED CHOICE",
        productOfWeek: "PRODUCT OF THE WEEK",
        x3Desc: "Wireless Gaming Mouse. Флагманський сенсор PAW3395 та ультралегкий корпус.",
        inStock: "В наявності",
        viewDetails: "ДЕТАЛЬНІШЕ →",
        newArrivalsTag: "LATEST DROPS",
        newArrivals: "NEW ARRIVALS",
        setupTag: "VISUAL ART",
        buildYourSetup: "BUILD YOUR SETUP.",
        backToCatalog: "Назад до галереї",
        colorNotSelected: "Колір не обрано",
        colorPrefix: "КОЛІР:",
        quantityLabel: "КІЛЬКІСТЬ:",
        specsTitle: "ХАРАКТЕРИСТИКИ",
        boxTitle: "КОМПЛЕКТАЦІЯ",
        warrantyTitle: "ГАРАНТІЯ",
        deliveryTitle: "ДОСТАВКА",
        addToCartBtn: "ДОДАТИ В КОШИК →",
        selectColorFirst: "ОБЕРИ КОЛІР",
        cartTitle: "КОШИК",
        subtotal: "Разом",
        checkoutBtn: "ОФОРМИТИ ЗАМОВЛЕННЯ →",
        checkoutTitle: "ОФОРМЛЕННЯ ЗАМОВЛЕННЯ",
        nameLabel: "Ваше ім'я *",
        contactLabel: "Telegram / Телефон *",
        commentLabel: "Коментар до замовлення",
        confirmOrderBtn: "ПІДТВЕРДИТИ ЗАМОВЛЕННЯ",
        wishlistTitle: "ОБРАНЕ",
        readyToUpgrade: "READY TO UPGRADE?",
        support: "Підтримка",
        warranty: "Гарантія",
        delivery: "Доставка",
        faq: "FAQ",
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
        wishlist: "Избранное",
        searchPlaceholder: "Что вы ищете?",
        quickSearch: "Быстрые запросы:",
        heroDesc: "Периферия, которая дополняет твой setup.",
        shopNow: "СМОТРЕТЬ ТОВАРЫ",
        collectionTag: "SHOWROOM COLLECTION",
        exploreSetup: "EXPLORE YOUR SETUP",
        productOfWeekTag: "CURATED CHOICE",
        productOfWeek: "PRODUCT OF THE WEEK",
        x3Desc: "Wireless Gaming Mouse. Флагманский сенсор PAW3395 и ультралегкий корпус.",
        inStock: "В наличии",
        viewDetails: "ПОДРОБНЕЕ →",
        newArrivalsTag: "LATEST DROPS",
        newArrivals: "NEW ARRIVALS",
        setupTag: "VISUAL ART",
        buildYourSetup: "BUILD YOUR SETUP.",
        backToCatalog: "Назад в галерею",
        colorNotSelected: "Цвет не выбран",
        colorPrefix: "ЦВЕТ:",
        quantityLabel: "КОЛИЧЕСТВО:",
        specsTitle: "ХАРАКТЕРИСТИКИ",
        boxTitle: "КОМПЛЕКТАЦИЯ",
        warrantyTitle: "ГАРАНТИЯ",
        deliveryTitle: "ДОСТАВКА",
        addToCartBtn: "ДОБ В КОРЗИНУ →",
        selectColorFirst: "ВЫБЕРИТЕ ЦВЕТ",
        cartTitle: "КОРЗИНА",
        subtotal: "Итого",
        checkoutBtn: "ОФОРМИТЬ ЗАКАЗ →",
        checkoutTitle: "ОФОРМЛЕНИЕ ЗАКАЗА",
        nameLabel: "Ваше имя *",
        contactLabel: "Telegram / Телефон *",
        commentLabel: "Комментарий к заказу",
        confirmOrderBtn: "ПОДТВЕРДИТЬ ЗАКАЗ",
        wishlistTitle: "ИЗБРАННОЕ",
        readyToUpgrade: "READY TO UPGRADE?",
        support: "Поддержка",
        warranty: "Гарантия",
        delivery: "Доставка",
        faq: "FAQ",
        contacts: "Контакты"
    }
};

let currentLang = 'ua';

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    
    document.getElementById('btnUA').classList.toggle('active', lang === 'ua');
    document.getElementById('btnRU').classList.toggle('active', lang === 'ru');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    renderProducts(products);
    updateCartUI();
}

// Unified Product Database
let products = [
    {
        id: "attack-shark-x3",
        brand: "Attack Shark",
        name: "X3",
        category: "mice",
        price: 1549,
        stock: 5,
        badge: "NEW",
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
            sensor: "PAW3395 (до 26000 DPI)",
            weight: "54 г",
            pollingRate: "8000 Hz",
            battery: "До 65 годин"
        },
        packageContents: [
            { name: "Бездротова мишка Attack Shark X3", desc: "Ультралегкий корпус" },
            { name: "USB Type-C кабель", desc: "Паракордове обплетення" },
            { name: "Ресивер 2.4G", desc: "Мініатюрний передавач" }
        ]
    }
];

let cart = [];
let wishlist = [];
let currentSelectedColorKey = null;
let currentQuantity = 1;

document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);
    updateCartUI();

    // Mouse movement subtle reaction for hero image
    const heroVisual = document.getElementById('heroVisual');
    const heroProductImg = document.getElementById('heroProductImg');
    if (heroVisual && heroProductImg) {
        heroVisual.addEventListener('mousemove', (e) => {
            const rect = heroVisual.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            heroProductImg.style.transform = `translate(${x * 0.02}px, ${y * 0.02}px) scale(1.02)`;
        });
        heroVisual.addEventListener('mouseleave', () => {
            heroProductImg.style.transform = `translate(0px, 0px) scale(1)`;
        });
    }
});

// Render Posters Grid
function renderProducts(list) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Товарів не знайдено</p>';
        return;
    }

    let html = '';
    list.forEach((p, index) => {
        let isWish = wishlist.includes(p.id);
        html += `
            <div class="product-poster" onclick="openProduct(${index})">
                <span class="vertical-label">MILIPSTORE</span>
                <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" style="position: absolute; top: 30px; right: 30px; background: none; border: none; cursor: pointer;">
                    <span class="material-symbols-outlined" style="font-size: 20px; color: ${isWish ? '#ff2d55' : 'var(--text-muted)'};">favorite</span>
                </button>
                <div class="poster-img-wrap">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="poster-footer">
                    <div class="poster-title-area">
                        <h4>${p.brand}</h4>
                        <h3>${p.name}</h3>
                        <span class="hover-details">VIEW PRODUCT → 54G • 8K • WIRELESS</span>
                    </div>
                    <span class="price">${p.price} ₴</span>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// Wishlist Logic
function toggleWishlist(id) {
    const idx = wishlist.indexOf(id);
    if (idx > -1) {
        wishlist.splice(idx, 1);
    } else {
        wishlist.push(id);
    }
    renderProducts(products);
    updateWishlistModalUI();
}

function openWishlistModal() {
    updateWishlistModalUI();
    document.getElementById('wishlistModal').classList.add('active');
}

function closeWishlistModal() {
    document.getElementById('wishlistModal').classList.remove('active');
}

function updateWishlistModalUI() {
    const container = document.getElementById('wishlistModalItems');
    if (!container) return;

    if (wishlist.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Список обраного порожній</p>';
        return;
    }

    let html = '';
    wishlist.forEach(id => {
        const p = products.find(item => item.id === id);
        if (p) {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 14px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${p.image}" alt="${p.name}" style="width: 44px; height: 44px; object-fit: contain;">
                        <div>
                            <h4 style="font-size: 13px; font-weight: 800;">${p.brand} ${p.name}</h4>
                            <span style="font-size: 12px; font-weight: 800; color: var(--accent);">${p.price} ₴</span>
                        </div>
                    </div>
                    <button onclick="toggleWishlist('${p.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><span class="material-symbols-outlined">delete</span></button>
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

// Product Showroom Page
function openProduct(index) {
    const p = products[index];
    const container = document.getElementById('productDetailContent');
    if (!container) return;

    currentSelectedColorKey = null;
    currentQuantity = 1;
    let activeImage = p.image;

    let galleryHtml = '';
    p.gallery.forEach((imgSrc, i) => {
        galleryHtml += `
            <img src="${imgSrc}" alt="Gallery ${i}" onclick="changeMainImage('${imgSrc}')" 
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border-color); cursor: pointer; transition: border-color 0.2s;">
        `;
    });

    let colorsHtml = '';
    Object.keys(p.colors).forEach(key => {
        let c = p.colors[key];
        colorsHtml += `
            <div class="color-swatch-item" 
                 style="background: ${c.hex}; ${c.hex === '#ffffff' ? 'border: 1px solid var(--border-color);' : ''}" 
                 onclick="selectProductColor('${key}', '${c.name}', '${c.image}', this)" 
                 title="${c.name}">
            </div>`;
    });

    let specsHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px;">
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 800;">SENSOR</span><b style="font-size: 14px; font-weight: 800;">${p.specifications.sensor}</b></div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 800;">WEIGHT</span><b style="font-size: 14px; font-weight: 800;">${p.specifications.weight}</b></div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 800;">POLLING RATE</span><b style="font-size: 14px; font-weight: 800;">${p.specifications.pollingRate}</b></div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 14px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 800;">BATTERY</span><b style="font-size: 14px; font-weight: 800;">${p.specifications.battery}</b></div>
        </div>
    `;

    let boxHtml = '';
    p.packageContents.forEach(item => {
        boxHtml += `
            <div style="background: var(--bg-secondary); padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 8px;">
                <b style="font-size: 13px; font-weight: 800; display: block;">${item.name}</b>
                <span style="font-size: 12px; color: var(--text-muted);">${item.desc}</span>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 32px; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--border-color);">
            <div style="height: 420px; display: flex; align-items: center; justify-content: center; width: 100%;">
                <img id="activeShowroomImg" src="${activeImage}" alt="${p.name}" style="max-height: 380px; max-width: 100%; object-fit: contain; transition: opacity 0.3s ease;">
            </div>
            <div style="margin-top: 30px; width: 100%; display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px;">
                ${galleryHtml}
            </div>
        </div>

        <div class="showroom-detail-info">
            <span style="font-size: 11px; font-weight: 800; color: var(--accent); letter-spacing: 1.5px;">MILIPSTORE / MICE / ${p.brand.toUpperCase()} ${p.name.toUpperCase()}</span>
            <h1 style="margin-top: 10px; font-size: 42px; font-weight: 800; letter-spacing: -1.5px;">${p.brand} ${p.name}</h1>
            <div style="font-size: 30px; font-weight: 800; margin: 14px 0 24px 0;">${p.price} ₴</div>
            <p style="color: var(--text-muted); font-size: 15px; margin-bottom: 30px; line-height: 1.6;">${translations[currentLang].x3Desc}</p>

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;"><span id="colorStatusText">${translations[currentLang].colorNotSelected}</span></div>
            <div class="color-swatch-box">${colorsHtml}</div>

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;">${translations[currentLang].quantityLabel}</div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">
                <button onclick="decrementQty()" style="width: 42px; height: 42px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">−</button>
                <span id="qtyDisplay" style="font-size: 16px; font-weight: 800; min-width: 24px; text-align: center;">1</span>
                <button onclick="incrementQty(${p.stock})" style="width: 42px; height: 42px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">+</button>
            </div>

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 12px; letter-spacing: 1px;">${translations[currentLang].specsTitle}</div>
            ${specsHtml}

            <div style="font-size: 11px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;">${translations[currentLang].boxTitle}</div>
            <div style="margin-bottom: 36px;">${boxHtml}</div>

            <div>
                <button id="addToCartDetailBtn" class="btn-gallery" style="width: 100%; padding: 20px; text-align: center; opacity: 0.5; cursor: not-allowed;" disabled onclick="addToCartFromDetail('${p.id}')">${translations[currentLang].selectColorFirst}</button>
            </div>
        </div>
    `;

    switchView('product-detail');
}

function changeMainImage(imgPath) {
    const imgEl = document.getElementById('activeShowroomImg');
    if (!imgEl) return;
    imgEl.style.opacity = '0';
    setTimeout(() => {
        imgEl.src = imgPath;
        imgEl.style.opacity = '1';
    }, 150);
}

function selectProductColor(colorKey, colorName, colorImg, el) {
    document.querySelectorAll('.color-swatch-item').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    currentSelectedColorKey = colorKey;

    const statusEl = document.getElementById('colorStatusText');
    if (statusEl) {
        statusEl.innerText = `${translations[currentLang].colorPrefix} ${colorName.toUpperCase()}`;
        statusEl.style.color = 'var(--accent)';
    }

    const btn = document.getElementById('addToCartDetailBtn');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerText = translations[currentLang].addToCartBtn;
    }

    changeMainImage(colorImg);
}

function incrementQty(maxStock) {
    if (currentQuantity < maxStock) {
        currentQuantity++;
        document.getElementById('qtyDisplay').innerText = currentQuantity;
    }
}

function decrementQty() {
    if (currentQuantity > 1) {
        currentQuantity--;
        document.getElementById('qtyDisplay').innerText = currentQuantity;
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    if (viewName === 'home') document.getElementById('homeView').classList.add('active');
    if (viewName === 'product-detail') document.getElementById('productDetailView').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterCategory(cat) {
    switchView('home');
    if (cat === 'all') {
        renderProducts(products);
    } else {
        const filtered = products.filter(p => p.category === cat);
        renderProducts(filtered);
    }
}

function addToCartFromDetail(productId) {
    if (!currentSelectedColorKey) return;
    const p = products.find(item => item.id === productId);
    if (!p) return;

    const colorObj = p.colors[currentSelectedColorKey];
    cart.push({
        name: `${p.brand} ${p.name}`,
        price: p.price,
        color: colorObj.name,
        quantity: currentQuantity
    });
    updateCartUI();
    openCartSidebar();
}

// Cart Sidebar Actions
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');

function openCartSidebar() {
    if (cartSidebar) cartSidebar.classList.add('active');
    if (cartOverlay) cartOverlay.classList.add('active');
}

function closeCartSidebar() {
    if (cartSidebar) cartSidebar.classList.remove('active');
    if (cartOverlay) cartOverlay.classList.remove('active');
}

document.getElementById('cartBtn').addEventListener('click', openCartSidebar);
document.getElementById('closeCart').addEventListener('click', closeCartSidebar);
cartOverlay.addEventListener('click', closeCartSidebar);

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartCount');
    const totalEl = document.getElementById('cartTotalPrice');

    if (!list || !badge || !totalEl) return;

    let totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cart.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 60px;">${translations[currentLang].cartTitle} порожній</div>`;
        badge.style.display = 'none';
        totalEl.innerText = '0 ₴';
        return;
    }

    badge.style.display = 'flex';
    badge.innerText = totalItemsCount;

    let html = '';
    let totalSum = 0;
    cart.forEach((item, idx) => {
        let itemTotal = item.price * item.quantity;
        totalSum += itemTotal;
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 16px; border-radius: 14px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <div>
                    <h4 style="font-size: 14px; font-weight: 800;">${item.name}</h4>
                    <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0;">Колір: ${item.color} | К-сть: ${item.quantity}</p>
                    <b style="font-size: 13px; color: var(--accent);">${itemTotal} ₴</b>
                </div>
                <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
    });
    list.innerHTML = html;
    totalEl.innerText = totalSum + ' ₴';
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    updateCartUI();
}

function openCheckoutModal() {
    if (cart.length === 0) return;
    closeCartSidebar();
    document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('active');
}

function submitOrderToTelegram() {
    const name = document.getElementById('orderName').value.trim();
    const contact = document.getElementById('orderContact').value.trim();
    const comment = document.getElementById('orderComment').value.trim();

    if (!name || !contact) {
        alert('Будь ласка, вкажіть ім\'я та контакт!');
        return;
    }

    let itemsText = cart.map(i => `- ${i.name} (${i.color}) x ${i.quantity} шт. — ${i.price * i.quantity} ₴`).join('\n');
    let totalPrice = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    let message = `MILIPSTORE New Order:\n\n${itemsText}\n\nСума: ${totalPrice} ₴\nІм'я: ${name}\nКонтакт: ${contact}\nКоментар: ${comment || 'немає'}`;

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.sendData(message);
    } else {
        alert('Замовлення успішно сформовано!\n\n' + message);
        cart = [];
        updateCartUI();
        closeCheckoutModal();
        switchView('home');
    }
}

// Search Overlay Logic
const searchToggle = document.getElementById('searchToggle');
const searchOverlayBox = document.getElementById('searchOverlayBox');
const searchInput = document.getElementById('searchInput');

searchToggle.addEventListener('click', () => {
    searchOverlayBox.classList.add('active');
    searchInput.focus();
});

searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(val) || p.brand.toLowerCase().includes(val));
    renderProducts(filtered);
});

function quickSearchTag(keyword) {
    searchInput.value = keyword;
    const filtered = products.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()) || p.brand.toLowerCase().includes(keyword.toLowerCase()));
    renderProducts(filtered);
    searchOverlayBox.classList.remove('active');
    switchView('home');
}