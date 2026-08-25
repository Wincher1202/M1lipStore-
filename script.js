// База даних товарів (миші та клавіатури з детальними характеристиками, комплектацією, гарантією та доставкою)
const productsData = [
    {
        id: 'p1',
        brand: 'ATTACK SHARK',
        name: 'ATTACK SHARK R5 ULTRA',
        category: 'mice',
        price: 2945, //[cite: 5]
        image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=800&auto=format&fit=crop',
        spec: 'Вага: 39г / 8000 Гц / PAW3950MAX / 42 000 DPI', //[cite: 5]
        description: 'Ультралегка флагманська ігрова миша з передовими технологіями затримки введення.',
        bundle: 'Миша Attack Shark R5 Ultra, приймач 8K Dongle, кабель USB Type-C у м'якому обплетенні, тефлонові глайди, фірмова документація.',
        warranty: 'Офіційна гарантія від виробника на 12 місяців.',
        delivery: 'Швидка доставка Новою Поштою по всій Україні протягом 1-2 днів. Оплата при отриманні або на картку.'
    },
    {
        id: 'p2',
        brand: 'AULA',
        name: 'AULA F75 Sky Edition',
        category: 'keyboards',
        price: 4399,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop',
        spec: 'Gasket Mount / Hot-Swap / RGB / Ice Blue',
        description: 'Преміальна механічна клавіатура з унікальним приємним звуком друку та яскравим підсвічуванням.',
        bundle: 'Клавіатура AULA F75, пулер для світчів та кейкапів, змінні світи, дріт USB Type-C, пилозахисна кришка, інструкція.',
        warranty: 'Гарантійне обслуговування строком на 12 місяців.',
        delivery: 'Безкоштовна доставка Новою Поштою при повній передоплаті. Доступний післяплата.'
    }
];

let cart = [];
let wishlist = [];
let currentFilter = 'all';

// Завантаження сторінки
window.addEventListener('load', () => {
    const loaderBar = document.getElementById('loader-bar');
    if (loaderBar) loaderBar.style.transform = 'translateX(0)';
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 700);
        }
    }, 500);
    renderProducts();
});

// Плавний скрол до каталогу за допомогою кнопок
function scrollToCatalog() {
    const catalog = document.getElementById('catalog');
    if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth' });
    }
}

// Скрол та вибір певної категорії (миші або клавіатури)
function scrollToCategory(category) {
    scrollToCatalog();
    filterCategory(category);
}

// Рендеринг карток каталогу (тільки назва, ціна, короткий опис та картинка)
function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = currentFilter === 'all' 
        ? productsData 
        : productsData.filter(p => p.category === currentFilter);

    filtered.forEach((product, index) => {
        const isLiked = wishlist.includes(product.id);
        const cardHTML = `
            <div id="card-${product.id}" class="product-card group relative bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between transition-all duration-500 hover:border-skybrand-blue/80 shadow-md hover:shadow-xl">
                <div class="flex items-center justify-between mb-6">
                    <span class="text-[10px] uppercase tracking-widest text-skybrand-blue font-bold">0${index + 1} / ${product.category.toUpperCase()}</span>
                    <button onclick="event.stopPropagation(); toggleWishlist('${product.id}')" class="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all focus:outline-none group/btn shadow-sm" aria-label="Обране">
                        <svg class="w-5 h-5 transition-transform group-active/btn:scale-125 ${isLiked ? 'text-red-500 fill-red-500 animate-heartbeat' : ''}" fill="${isLiked ? '#EF4444' : 'none'}" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
                        </svg>
                    </button>
                </div>

                <div onclick="openProductModal('${product.id}')" class="relative w-full aspect-[4/3] flex items-center justify-center my-4 cursor-pointer">
                    <img src="${product.image}" alt="${product.name}" class="max-h-full object-contain transform group-hover:scale-105 transition-transform duration-500 drop-shadow-md">
                </div>

                <div onclick="openProductModal('${product.id}')" class="cursor-pointer">
                    <div class="flex items-center justify-between mb-1">
                        <h3 class="text-base font-bold text-slate-900 tracking-wide">${product.name}</h3>
                        <span class="text-sm font-bold text-skybrand-blue">₴ ${product.price.toLocaleString()}</span>
                    </div>
                    <p class="text-xs text-slate-500 font-light mb-2 line-clamp-1">${product.description}</p>
                    <p class="text-[11px] text-sky-600 font-medium mb-4">${product.spec}</p>
                </div>

                <button onclick="addToCart('${product.id}')" class="w-full py-3 bg-slate-900 border border-slate-900 rounded-xl text-xs uppercase tracking-wider text-white font-semibold hover:bg-skybrand-blue hover:border-skybrand-blue transition-all duration-300 shadow-md">
                    Додати до кошика
                </button>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// Фільтрація категорії
function filterCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.remove('bg-skybrand-blue', 'text-white', 'font-bold');
        btn.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
    });
    const activeBtn = document.getElementById(`filter-${category}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-200');
        activeBtn.classList.add('bg-skybrand-blue', 'text-white', 'font-bold');
    }
    renderProducts();
}

// Відкриття детального опису товару в модальному вікні з випадаючими блоками
function openProductModal(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mb-6">
            <div class="bg-slate-50 rounded-2xl p-4 flex items-center justify-center border border-slate-200">
                <img src="${product.image}" class="max-h-48 object-contain drop-shadow-md">
            </div>
            <div>
                <span class="text-[10px] uppercase tracking-widest text-skybrand-blue font-bold">${product.brand}</span>
                <h3 class="text-xl font-bold text-slate-900 mt-1 mb-2">${product.name}</h3>
                <div class="text-2xl font-extrabold text-skybrand-blue mb-4">₴ ${product.price.toLocaleString()}</div>
                <button onclick="addToCart('${product.id}'); closeProductModal();" class="w-full py-3 bg-skybrand-blue text-white text-xs uppercase tracking-widest font-bold rounded-xl hover:brightness-110 shadow-lg shadow-sky-500/20 transition-all">
                    Купити зараз
                </button>
            </div>
        </div>

        <div class="space-y-3 pt-4 border-t border-slate-200 text-xs">
            <div class="font-semibold text-slate-700 uppercase tracking-wider mb-1">Повний опис:</div>
            <p class="text-slate-600 font-light leading-relaxed mb-4">${product.description} Основні характеристики: ${product.spec}.</p>
            
            <!-- Випадаючий блок: Комплектація -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <button onclick="toggleAccordion('acc-bundle')" class="w-full flex items-center justify-between p-3.5 bg-slate-50 font-semibold text-slate-800 text-left hover:bg-slate-100 transition-colors">
                    <span>Комплектація</span>
                    <span id="icon-acc-bundle" class="transform transition-transform">▼</span>
                </button>
                <div id="acc-bundle" class="hidden p-3.5 bg-white text-slate-600 border-t border-slate-200">
                    ${product.bundle}
                </div>
            </div>

            <!-- Випадаючий блок: Гарантія -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <button onclick="toggleAccordion('acc-warranty')" class="w-full flex items-center justify-between p-3.5 bg-slate-50 font-semibold text-slate-800 text-left hover:bg-slate-100 transition-colors">
                    <span>Гарантія</span>
                    <span id="icon-acc-warranty" class="transform transition-transform">▼</span>
                </button>
                <div id="acc-warranty" class="hidden p-3.5 bg-white text-slate-600 border-t border-slate-200">
                    ${product.warranty}
                </div>
            </div>

            <!-- Випадаючий блок: Доставка -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <button onclick="toggleAccordion('acc-delivery')" class="w-full flex items-center justify-between p-3.5 bg-slate-50 font-semibold text-slate-800 text-left hover:bg-slate-100 transition-colors">
                    <span>Доставка</span>
                    <span id="icon-acc-delivery" class="transform transition-transform">▼</span>
                </button>
                <div id="acc-delivery" class="hidden p-3.5 bg-white text-slate-600 border-t border-slate-200">
                    ${product.delivery}
                </div>
            </div>
        </div>
    `;

    const modal = document.getElementById('product-modal');
    const box = document.getElementById('modal-content-box');
    if (!modal || !box) return;
    modal.style.pointerEvents = 'auto';
    modal.style.opacity = '1';
    box.style.transform = 'scale(1)';
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    const box = document.getElementById('modal-content-box');
    if (!modal || !box) return;
    modal.style.opacity = '0';
    box.style.transform = 'scale(0.95)';
    setTimeout(() => modal.style.pointerEvents = 'none', 300);
}

// Функція акордеона для деталей (комплектація, гарантія, доставка)
function toggleAccordion(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`);
    if (!el) return;
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        el.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

// Перемикання обраного (сердечко + червона пульсуюча рамка каталогу)
function toggleWishlist(productId) {
    const card = document.getElementById(`card-${productId}`);
    const index = wishlist.indexOf(productId);

    if (index > -1) {
        wishlist.splice(index, 1);
        if (card) card.classList.remove('card-active-glow');
    } else {
        wishlist.push(productId);
        if (card) {
            card.classList.remove('card-active-glow');
            void card.offsetWidth;
            card.classList.add('card-active-glow');
        }
    }

    updateWishlistUI();
    renderProducts();
}

function updateWishlistUI() {
    const counter = document.getElementById('wishlist-counter');
    if (!counter) return;
    if (wishlist.length > 0) {
        counter.style.transform = 'scale(1)';
    } else {
        counter.style.transform = 'scale(0)';
    }
}

// Додавання в кошик
function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }

    updateCartUI();
    openCartDrawer();
}

// Оновлення кошика
function updateCartUI() {
    const counter = document.getElementById('cart-counter');
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    
    if (!counter || !container || !totalElement) return;

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    
    counter.innerText = totalItems;
    counter.style.transform = totalItems > 0 ? 'scale(1)' : 'scale(0)';

    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-10">Кошик порожній</p>`;
        totalElement.innerText = `₴ 0`;
        return;
    }

    let totalSum = 0;
    cart.forEach(item => {
        totalSum += item.price * item.qty;
        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex items-center space-x-3">
                    <img src="${item.image}" class="w-12 h-12 object-contain bg-white p-1 rounded-lg border border-slate-100">
                    <div>
                        <h4 class="text-xs font-bold text-slate-900">${item.name}</h4>
                        <span class="text-[11px] text-slate-500">₴ ${item.price.toLocaleString()} × ${item.qty}</span>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-red-500 text-xs px-2 font-bold transition-colors">✕</button>
            </div>
        `);
    });

    totalElement.innerText = `₴ ${totalSum.toLocaleString()}`;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

// Висувні панелі (Drawers)
function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const panel = document.getElementById('cart-panel');
    if (!drawer || !panel) return;
    drawer.style.pointerEvents = 'auto';
    drawer.style.opacity = '1';
    panel.style.transform = 'translateX(0)';
    updateCartUI();
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const panel = document.getElementById('cart-panel');
    if (!drawer || !panel) return;
    drawer.style.opacity = '0';
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => drawer.style.pointerEvents = 'none', 300);
}

function openWishlistDrawer() {
    const drawer = document.getElementById('wishlist-drawer');
    const panel = document.getElementById('wishlist-panel');
    const container = document.getElementById('wishlist-items');
    
    if (!drawer || !panel || !container) return;
    
    drawer.style.pointerEvents = 'auto';
    drawer.style.opacity = '1';
    panel.style.transform = 'translateX(0)';

    container.innerHTML = '';

    if (wishlist.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-10">Список обраного порожній</p>`;
        return;
    }

    wishlist.forEach(id => {
        const product = productsData.find(p => p.id === id);
        if (product) {
            container.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <div class="flex items-center space-x-3">
                        <img src="${product.image}" class="w-12 h-12 object-contain bg-white p-1 rounded-lg border border-slate-100">
                        <div>
                            <h4 class="text-xs font-bold text-slate-900">${product.name}</h4>
                            <span class="text-[11px] text-skybrand-blue font-bold">₴ ${product.price.toLocaleString()}</span>
                        </div>
                    </div>
                    <button onclick="toggleWishlist('${product.id}'); openWishlistDrawer();" class="text-red-500 text-xs px-2 font-bold hover:underline">Видалити</button>
                </div>
            `);
        }
    });
}

function closeWishlistDrawer() {
    const drawer = document.getElementById('wishlist-drawer');
    const panel = document.getElementById('wishlist-panel');
    if (!drawer || !panel) return;
    drawer.style.opacity = '0';
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => drawer.style.pointerEvents = 'none', 300);
}

function checkout() {
    if (cart.length === 0) return;
    alert('Замовлення успішно підтверджено! Дякуємо за покупку в MILIPSTORE.');
    cart = [];
    updateCartUI();
    closeCartDrawer();
}