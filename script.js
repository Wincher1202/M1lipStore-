// Translations dictionary (UA & RU)
const translations = {
    uk: {
        loader_sub: "CELESTIAL EXPERIENCE",
        nav_catalog: "МАГАЗИН",
        nav_new: "НОВИНКИ",
        nav_mice: "МИШКИ",
        nav_setup: "SETUP LAB",
        nav_delivery: "ДОСТАВКА",
        sys_online: "MILIPSTORE CELESTIAL SYSTEM ONLINE",
        hero_label: "MILIPSTORE / CELESTIAL EDITION",
        click_to_open: "ВІДКРИТИ НЕБЕСНИЙ ПРОСТІР →",
        cat_title: "CELESTIAL SPACE CATALOGUE",
        view_product: "ПЕРЕГЛЯНУТИ →",
        bread_mice: "МИШКИ",
        tag_bestseller: "CELESTIAL EDITION 2026",
        prod_subtitle: "Флагманська ультралегка ігрова миша у небесному білому виконанні",
        in_stock: "● В наявності (24 шт)",
        label_color: "КОЛІР:",
        btn_add_cart: "ДОДАТИ В КОШИК",
        acc_desc: "01. ОПИС ТОВАРУ",
        desc_text: "Attack Shark R5 Ultra створена для безкомпромісного геймінгу у витонченому білому дизайні. Небесна легкість корпусу, флагманський сенсор нового покоління та підтримка частоти 8000 Гц дарують абсолютний контроль над кожним рухом.",
        acc_specs: "02. ХАРАКТЕРИСТИКИ",
        acc_delivery: "03. ДОСТАВКА ТА ОПЛАТА",
        delivery_text: "Швидка доставка Новою Поштою по Україні (1-2 дні), кур'єр до дверей, оплата при отриманні або на рахунок ФОП.",
        cart_title: "КОШИК",
        cart_empty: "Ваш кошик наразі порожній",
        cart_total: "Разом:",
        cart_checkout: "ОФОРМИТИ ЗАМОВЛЕННЯ",
        search_title: "WHAT ARE YOU LOOKING FOR?",
        trend_label: "TRENDING:"
    },
    ru: {
        loader_sub: "CELESTIAL EXPERIENCE",
        nav_catalog: "МАГАЗИН",
        nav_new: "НОВИНКИ",
        nav_mice: "МЫШКИ",
        nav_setup: "SETUP LAB",
        nav_delivery: "ДОСТАВКА",
        sys_online: "MILIPSTORE CELESTIAL SYSTEM ONLINE",
        hero_label: "MILIPSTORE / CELESTIAL EDITION",
        click_to_open: "ОТКРЫТЬ НЕБЕСНОЕ ПРОСТРАНСТВО →",
        cat_title: "CELESTIAL SPACE CATALOGUE",
        view_product: "ПОСМОТРЕТЬ →",
        bread_mice: "МЫШКИ",
        tag_bestseller: "CELESTIAL EDITION 2026",
        prod_subtitle: "Флагманская ультралегкая игровая мышь в небесном белом исполнении",
        in_stock: "● В наличии (24 шт)",
        label_color: "ЦВЕТ:",
        btn_add_cart: "ДОБАВИТЬ В КОРЗИНУ",
        acc_desc: "01. ОПИСАНИЕ ТОВАРА",
        desc_text: "Attack Shark R5 Ultra создана для бескомпромиссного гейминга в изящном белом дизайне. Небесная легкость корпуса, флагманский сенсор нового поколения и поддержка частоты 8000 Гц даруют абсолютный контроль над каждым движением.",
        acc_specs: "02. ХАРАКТЕРИСТИКИ",
        acc_delivery: "03. ДОСТАВКА И ОПЛАТА",
        delivery_text: "Быстрая доставка Новой Почтой по Украине (1-2 дня), курьер до дверей, оплата при получении или на счет ФЛП.",
        cart_title: "КОРЗИНА",
        cart_empty: "Ваша корзина пока пуста",
        cart_total: "Итого:",
        cart_checkout: "ОФОРМИТЬ ЗАКАЗ",
        search_title: "WHAT ARE YOU LOOKING FOR?",
        trend_label: "TRENDING:"
    }
};

// Database of products with precise requested photo order
const productsData = {
    'r5-ultra': {
        name: 'ATTACK SHARK R5 ULTRA',
        subtitle: 'Флагманська ультралегка ігрова миша у небесному білому виконанні',
        price: 3299,
        category: 'MICE',
        images: [
            { file: 'attack-shark-r5-ultra-top-angle.jpg', title: 'Top Angle' },
            { file: 'attack-shark-r5-ultra-in-hand-setup.jpg', title: 'In Hand' },
            { file: 'attack-shark-r5-ultra-side-buttons.jpg', title: 'Side Buttons' },
            { file: 'attack-shark-r5-ultra-back-grip.jpg', title: 'Back Grip' },
            { file: 'attack-shark-r5-ultra-dongle-receiver.jpg', title: 'Dongle 8K' },
            { file: 'attack-shark-r5-ultra-box-bundle-contents.jpg', title: 'Bundle' },
            { file: 'attack-shark-r5-ultra-colors-price.jpg', title: 'Edition' }
        ],
        hasColors: true,
        specs: `
            <li><span>Сенсор:</span> <strong>PixArt PAW3395 Ultra</strong></li>
            <li><span>Частота опитування:</span> <strong>8000 Гц Hyper-Polling</strong></li>
            <li><span>Підключення:</span> <strong>Tri-Mode Wireless</strong></li>
            <li><span>Колір:</span> <strong>Celestial White</strong></li>
        `,
        desc: 'Attack Shark R5 Ultra створена для безкомпромісного геймінгу у витонченому білому дизайні. Небесна легкість корпусу, флагманський сенсор нового покоління та підтримка частоти 8000 Гц дарують абсолютний контроль над кожним рухом.'
    },
    'pad': {
        name: 'CELESTIAL ESPORTS MOUSEPAD',
        subtitle: 'Професійний ігровий килимок у небесному стилі',
        price: 999,
        category: 'SETUP LAB',
        images: [
            { file: 'attack-shark-r5-ultra-in-hand-setup.jpg', title: 'Celestial Mat' }
        ],
        hasColors: false,
        specs: `
            <li><span>Матеріал:</span> <strong>Micro-control Fabric</strong></li>
            <li><span>Розмір:</span> <strong>500 x 420 x 4 мм</strong></li>
        `,
        desc: 'Килимок преміум-класу для ідеального ковзання девайсів у вашому сетапі.'
    }
};

// State
let currentLang = localStorage.getItem('milipstore_lang') || 'uk';
let selectedColor = 'white';
let currentProductId = 'r5-ultra';
let cart = JSON.parse(localStorage.getItem('milipstore_cart')) || [];
let wishlist = [];

document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initClock();
    setLanguage(currentLang);
    initParallax();
    updateCartUI();
});

function initLoader() {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loader-bar');
    const percent = document.getElementById('loader-percent');
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 20) + 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => { loader.classList.add('hidden'); }, 300);
        }
        bar.style.width = progress + '%';
        percent.textContent = progress + '%';
    }, 100);
}

function initClock() {
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if(clockEl) clockEl.textContent = `${hours}:${minutes}`;
    }, 1000);
}

document.querySelectorAll('[data-lang-switch]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        setLanguage(e.target.getAttribute('data-lang-switch'));
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
}

window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 40) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

function initParallax() {
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 15;
        const y = (e.clientY / window.innerHeight - 0.5) * 15;
        const floatCard = document.getElementById('heroProductCard');
        if (floatCard) {
            floatCard.style.transform = `translate(${x}px, ${y}px)`;
        }
    });
}

function openProductModal(productId = 'r5-ultra') {
    currentProductId = productId;
    const prod = productsData[productId];
    if (!prod) return;

    document.getElementById('modalTitle').textContent = prod.name;
    document.getElementById('modalSubtitle').textContent = prod.subtitle;
    document.getElementById('modalPrice').textContent = `₴ ${prod.price}`;
    document.getElementById('modalDescText').textContent = prod.desc;
    document.getElementById('modalSpecsList').innerHTML = prod.specs;
    document.getElementById('modalBreadcrumb').innerHTML = `MILIPSTORE / <span>${prod.category}</span> / ${prod.name}`;

    const colorBlock = document.getElementById('colorConfigBlock');
    if (prod.hasColors) {
        colorBlock.style.display = 'block';
        selectedColor = 'white';
    } else {
        colorBlock.style.display = 'none';
        selectedColor = 'default';
    }

    // Render thumbnails following user's file sequence
    const thumbsContainer = document.getElementById('thumbnailsContainer');
    let thumbsHtml = '';
    prod.images.forEach((imgObj, idx) => {
        const padNum = String(idx + 1).padStart(2, '0');
        thumbsHtml += `
            <button class="thumb-btn ${idx === 0 ? 'active' : ''}" onclick="switchImage('${imgObj.file}', ${idx})">
                <img src="${imgObj.file}" alt="Thumb">
                <span>${padNum}</span>
            </button>
        `;
    });
    thumbsContainer.innerHTML = thumbsHtml;
    document.getElementById('mainGalleryImg').src = prod.images[0].file;
    document.getElementById('galleryProgress').textContent = `01 / 0${prod.images.length}`;

    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = '';
}

function switchImage(src, index) {
    const mainImg = document.getElementById('mainGalleryImg');
    mainImg.style.opacity = '0';
    mainImg.style.transform = 'scale(0.97)';
    
    setTimeout(() => {
        mainImg.src = src;
        mainImg.style.opacity = '1';
        mainImg.style.transform = 'scale(1)';
    }, 200);

    const prod = productsData[currentProductId];
    document.querySelectorAll('.thumb-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });

    const totalStr = String(prod.images.length).padStart(2, '0');
    const curStr = String(index + 1).padStart(2, '0');
    document.getElementById('galleryProgress').textContent = `${curStr} / ${totalStr}`;
}

function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains(color));
    });
    document.getElementById('selectedColorLabel').textContent = 'CELESTIAL WHITE';
}

function toggleAccordion(btn) {
    btn.parentElement.classList.toggle('active');
}

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

function addToCart() {
    const prod = productsData[currentProductId];
    const item = {
        name: prod.name,
        color: 'Celestial White',
        price: prod.price,
        image: prod.images[0].file
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
                    <p>White</p>
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
    alert(currentLang === 'uk' ? 'Дякуємо! Замовлення на R5 Ultra успішно сформовано.' : 'Спасибо! Заказ на R5 Ultra успешно сформирован.');
    cart = [];
    saveCart();
    updateCartUI();
    closeCart();
}

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

    if ('attack shark r5 ultra white 8000hz'.includes(q)) {
        resultsHtml += `
            <div class="search-result-item" onclick="closeSearch(); openProductModal('r5-ultra');">
                <div>
                    <strong>Attack Shark R5 Ultra Wireless Mouse</strong>
                    <p style="font-size:0.75rem; color:#666;">Mice / Celestial White / 8K</p>
                </div>
                <span style="font-weight:700;">₴ 3,299 →</span>
            </div>
        `;
    }

    resultsEl.innerHTML = resultsHtml || `<div style="padding: 20px; color: #666;">${currentLang === 'uk' ? 'Нічого не знайдено' : 'Ничего не найдено'}</div>`;
}