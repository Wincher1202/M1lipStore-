/**
 * MILIPSTORE — Premium Gaming Peripherals
 * Product First Architecture & Editorial Experience
 */

let tg = window.Telegram.WebApp;
tg.expand();

// Loading Screen Animation
window.addEventListener('load', () => {
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('fade-out');
        }
    }, 1400);
});

// Structured Product Database with Real Files
let products = [
    {
        id: 1,
        category: 'mice',
        brand: 'ATTACK SHARK',
        name: 'ATTACK SHARK X3',
        tagline: 'Ультралегка бездротова ігрова мишка з флагманським сенсором PAW3395.',
        price: 1549,
        badge: 'NEW',
        stock: 5,
        // Головна фотографія товару — коробка + основний товар
        image: 'attack-shark-x3-box.jpg',
        gallery: [
            'attack-shark-x3-box.jpg',
            'attack-shark-x3-white.jpg',
            'attack-shark-x3-black.jpg'
        ],
        colors: [
            { name: 'White', hex: '#ffffff', img: 'attack-shark-x3-white.jpg' },
            { name: 'Black', hex: '#111111', img: 'attack-shark-x3-black.jpg' }
        ],
        specs: {
            sensor: 'PAW3395 (до 26000 DPI)',
            weight: '49 грамів',
            connection: 'Tri-Mode (2.4G / BT / USB-C)',
            battery: 'До 65 годин автономності',
            pollingRate: '1000 Hz'
        },
        boxContents: [
            { name: 'Бездротова мишка Attack Shark X3', desc: 'Ультралегкий симетричний корпус' },
            { name: 'USB Type-C кабель', desc: 'Гнучкий паракордовий кабель у захисному обплетенні' },
            { name: 'Ресивер 2.4G', desc: 'Мініатюрний передавач для стабільного з'єднання' },
            { name: 'Інструкція', desc: 'Посібник користувача та гарантійний талон' }
        ]
    }
];

let cart = [];
let wishlist = [];
let orders = JSON.parse(localStorage.getItem('milipstore_orders')) || [];

let currentSelectedColor = null;
let currentQuantity = 1;

document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);
    updateCartUI();
    updateAdminStats();
});

// Render Catalog Cards
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
            <div class="product-card" onclick="openProduct(${index})">
                <span class="badge">${p.badge}</span>
                <button class="wishlist-btn-card" onclick="event.stopPropagation(); toggleWishlist(${p.id})">
                    <span class="material-symbols-outlined" style="font-size: 18px; color: ${isWish ? '#ff2d55' : 'inherit'};">favorite</span>
                </button>
                <div class="product-img-wrap">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <span class="card-brand">${p.brand}</span>
                <h3 class="card-title">${p.name}</h3>
                <p class="card-desc">${p.tagline}</p>
                <div class="card-footer-row">
                    <span class="price">${p.price} ₴</span>
                    <button class="buy-card-btn" onclick="event.stopPropagation(); quickAdd(${index})">КУПИТИ</button>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// Wishlist Management
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
    const modal = document.getElementById('wishlistModal');
    if (modal) modal.classList.add('active');
}

function closeWishlistModal() {
    const modal = document.getElementById('wishlistModal');
    if (modal) modal.classList.remove('active');
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
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 12px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${p.image}" alt="${p.name}" style="width: 40px; height: 40px; object-fit: contain;">
                        <div>
                            <h4 style="font-size: 13px; font-weight: 800;">${p.name}</h4>
                            <span style="font-size: 12px; font-weight: 800; color: var(--accent);">${p.price} ₴</span>
                        </div>
                    </div>
                    <button onclick="toggleWishlist(${p.id})" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><span class="material-symbols-outlined">delete</span></button>
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

// Detailed Product Experience Page
function openProduct(index) {
    const p = products[index];
    const container = document.getElementById('productDetailContent');
    if (!container) return;
    
    currentSelectedColor = null;
    currentQuantity = 1;
    let activeImage = p.image;

    let galleryHtml = '';
    p.gallery.forEach((imgSrc, i) => {
        galleryHtml += `
            <img src="${imgSrc}" alt="Thumbnail ${i}" onclick="changeMainImage('${imgSrc}')" 
                 style="width: 70px; height: 70px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border-color); cursor: pointer; transition: border-color 0.2s;">
        `;
    });

    let colorsHtml = '';
    p.colors.forEach((c) => {
        colorsHtml += `
            <div class="color-swatch" 
                 style="background: ${c.hex}; ${c.hex === '#ffffff' ? 'border: 1px solid var(--border-color);' : ''}" 
                 onclick="changeProductColor(this, '${c.name}', '${c.img}')" 
                 title="${c.name}">
            </div>`;
    });

    let boxHtml = '';
    p.boxContents.forEach(item => {
        boxHtml += `
            <div style="background: var(--bg-secondary); padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 8px;">
                <b style="font-size: 13px; display: block; margin-bottom: 2px;">${item.name}</b>
                <span style="font-size: 12px; color: var(--text-muted);">${item.desc}</span>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 28px; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--border-color);">
            <div style="height: 380px; display: flex; align-items: center; justify-content: center; width: 100%;">
                <img id="activeDetailImg" src="${activeImage}" alt="${p.name}" style="max-height: 350px; max-width: 100%; object-fit: contain; transition: opacity 0.3s ease;">
            </div>
            <div style="margin-top: 24px; width: 100%; display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px;">
                ${galleryHtml}
            </div>
        </div>

        <div class="detail-info">
            <span style="font-size: 11px; font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: 1px;">${p.brand} • 🟢 IN STOCK (${p.stock} pcs)</span>
            <h1 style="margin-top: 8px; font-size: 36px; font-weight: 800; letter-spacing: -1px;">${p.name}</h1>
            <div style="font-size: 28px; font-weight: 800; margin: 12px 0 20px 0; letter-spacing: -0.5px;">${p.price} ₴</div>
            <p style="color: var(--text-muted); font-size: 15px; margin-bottom: 24px; line-height: 1.6;">${p.tagline} Створено для безкомпромісної перемоги та повного контролю у грі.</p>
            
            <div style="font-size: 12px; font-weight: 800; margin-bottom: 8px; letter-spacing: 0.5px;">SELECT COLOR: <span id="selectedColorName" style="color: var(--accent);">Color not selected</span></div>
            <div class="color-options" style="display: flex; gap: 12px; margin-bottom: 24px;">${colorsHtml}</div>

            <div style="font-size: 12px; font-weight: 800; margin-bottom: 8px; letter-spacing: 0.5px;">QUANTITY:</div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 28px;">
                <button onclick="decrementQty()" style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">−</button>
                <span id="qtyDisplay" style="font-size: 16px; font-weight: 800; min-width: 24px; text-align: center;">1</span>
                <button onclick="incrementQty(${p.stock})" style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 800; cursor: pointer;">+</button>
            </div>

            <div style="font-size: 12px; font-weight: 800; margin-bottom: 12px; letter-spacing: 0.5px;">TECH SPECS:</div>
            <div class="specs-grid-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px;">
                <div class="spec-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted);">SENSOR</span><b style="font-size: 13px;">${p.specs.sensor}</b></div>
                <div class="spec-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted);">WEIGHT</span><b style="font-size: 13px;">${p.specs.weight}</b></div>
                <div class="spec-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted);">CONNECTION</span><b style="font-size: 13px;">${p.specs.connection}</b></div>
                <div class="spec-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color);"><span style="display: block; font-size: 10px; color: var(--text-muted);">BATTERY</span><b style="font-size: 13px;">${p.specs.battery}</b></div>
            </div>

            <div style="font-size: 12px; font-weight: 800; margin-bottom: 10px; letter-spacing: 0.5px;">WHAT'S IN THE BOX:</div>
            <div style="margin-bottom: 32px;">${boxHtml}</div>

            <div>
                <button id="addToCartDetailBtn" class="btn-primary" style="width: 100%; padding: 18px; text-align: center; opacity: 0.5; cursor: not-allowed;" disabled onclick="addToCartFromDetail(${index})">SELECT COLOR FIRST</button>
            </div>
        </div>
    `;

    switchView('product-detail');
}

function changeMainImage(imgPath) {
    const imgEl = document.getElementById('activeDetailImg');
    if (!imgEl) return;
    imgEl.style.opacity = '0';
    setTimeout(() => {
        imgEl.src = imgPath;
        imgEl.style.opacity = '1';
    }, 150);
}

function changeProductColor(el, colorName, imgPath) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    currentSelectedColor = colorName;
    document.getElementById('selectedColorName').innerText = colorName;
    
    const btn = document.getElementById('addToCartDetailBtn');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerText = 'ADD TO CART →';
    }

    changeMainImage(imgPath);
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
    if (viewName === 'home') {
        const home = document.getElementById('homeView');
        if (home) home.classList.add('active');
    }
    if (viewName === 'product-detail') {
        const detail = document.getElementById('productDetailView');
        if (detail) detail.classList.add('active');
    }
    if (viewName === 'admin') {
        const admin = document.getElementById('adminView');
        if (admin) admin.classList.add('active');
        renderAdminOrders();
    }
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

function quickAdd(index) {
    const p = products[index];
    cart.push({
        name: p.name,
        price: p.price,
        color: p.colors[0].name,
        quantity: 1
    });
    updateCartUI();
    openCartSidebar();
}

function addToCartFromDetail(index) {
    if (!currentSelectedColor) return;
    const p = products[index];
    cart.push({
        name: p.name,
        price: p.price,
        color: currentSelectedColor,
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

const cartBtn = document.getElementById('cartBtn');
if (cartBtn) cartBtn.addEventListener('click', openCartSidebar);
const closeCart = document.getElementById('closeCart');
if (closeCart) closeCart.addEventListener('click', closeCartSidebar);
if (cartOverlay) cartOverlay.addEventListener('click', closeCartSidebar);

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartCount');
    const totalEl = document.getElementById('cartTotalPrice');

    if (!list || !badge || !totalEl) return;

    let totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cart.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 60px;">Кошик порожній</div>';
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
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.add('active');
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('active');
}

function submitOrderToTelegram() {
    const nameInput = document.getElementById('orderName');
    const contactInput = document.getElementById('orderContact');
    const commentInput = document.getElementById('orderComment');

    if (!nameInput || !contactInput) return;

    const name = nameInput.value.trim();
    const contact = contactInput.value.trim();
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!name || !contact) {
        alert('Будь ласка, вкажіть ім\'я та контакт!');
        return;
    }

    let itemsText = cart.map(i => `- ${i.name} (${i.color}) x ${i.quantity} шт. — ${i.price * i.quantity} ₴`).join('\n');
    let totalPrice = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    let orderData = {
        id: Date.now().toString().slice(-4),
        items: itemsText,
        total: totalPrice,
        name: name,
        contact: contact,
        comment: comment || 'немає',
        date: new Date().toLocaleDateString()
    };

    orders.push(orderData);
    localStorage.setItem('milipstore_orders', JSON.stringify(orders));
    updateAdminStats();

    let message = `Добрий день! Бажаю оформити замовлення в MILIPSTORE:\n\n${itemsText}\n\nСума: ${totalPrice} ₴\nІм'я: ${name}\nКонтакт: ${contact}\nКоментар: ${comment}`;

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

if (searchToggle && searchOverlayBox && searchInput) {
    searchToggle.addEventListener('click', () => {
        searchOverlayBox.classList.toggle('active');
        if (searchOverlayBox.classList.contains('active')) searchInput.focus();
    });

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = products.filter(p => p.name.toLowerCase().includes(val) || p.brand.toLowerCase().includes(val));
        renderProducts(filtered);
    });
}

function quickSearchTag(keyword) {
    if (searchInput) searchInput.value = keyword;
    const filtered = products.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()) || p.brand.toLowerCase().includes(keyword.toLowerCase()));
    renderProducts(filtered);
    if (searchOverlayBox) searchOverlayBox.classList.remove('active');
    switchView('home');
}

function openAdminPanel() {
    switchView('admin');
}

function updateAdminStats() {
    const ordCount = document.getElementById('adminOrdersCount');
    if (ordCount) ordCount.innerText = orders.length;
}

function renderAdminOrders() {
    const list = document.getElementById('adminOrdersList');
    if (!list) return;

    if (orders.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted);">Поки що замовлень немає.</p>';
        return;
    }
    let html = '';
    orders.slice().reverse().forEach(o => {
        html += `
            <div class="admin-order-card" style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <b>Замовлення #${o.id} від ${o.date}</b>
                <p style="font-size: 13px; margin: 8px 0; white-space: pre-line;">${o.items}</p>
                <p style="font-size: 13px;"><b>Сума:</b> ${o.total} ₴ | <b>Клієнт:</b> ${o.name} (${o.contact})</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Коментар: ${o.comment}</p>
            </div>
        `;
    });
    list.innerHTML = html;
}