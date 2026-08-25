// База даних товарів (включно з Attack Shark R5 Ultra та супутніми категоріями)
const productsData = [
    {
        id: 'p1',
        brand: 'ATTACK SHARK',
        name: 'ATTACK SHARK R5 ULTRA',
        category: 'mice',
        price: 2945, //[cite: 5]
        image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=800&auto=format&fit=crop',
        spec: 'Вага: 39г / 8000 Гц / PAW3950MAX / 42 000 DPI', //[cite: 5]
        description: 'Флагманська бездротова ігрова миша' //[cite: 5]
    },
    {
        id: 'p2',
        brand: 'AULA',
        name: 'AULA F75 Sky Edition',
        category: 'keyboards',
        price: 4399,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop',
        spec: 'Gasket Mount / Hot-Swap / RGB',
        description: 'Механічна ігрова клавіатура'
    }
];

let cart = [];
let wishlist = [];
let currentFilter = 'all';

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
            <div id="card-${product.id}" class="product-card group relative bg-skybrand-card border border-skybrand-border rounded-2xl p-6 flex flex-col justify-between transition-all duration-500 hover:border-skybrand-blue/60 shadow-lg">
                <div class="flex items-center justify-between mb-6">
                    <span class="text-[10px] uppercase tracking-widest text-skybrand-blue font-bold">0${index + 1} / ${product.category.toUpperCase()}</span>
                    <button onclick="toggleWishlist('${product.id}')" class="w-9 h-9 rounded-full bg-skybrand-surface border border-skybrand-border flex items-center justify-center text-skybrand-light/70 hover:text-white transition-all focus:outline-none group/btn" aria-label="Обране">
                        <svg class="w-4 h-4 transition-transform group-active/btn:scale-125 ${isLiked ? 'text-red-500 fill-red-500 animate-heartbeat' : ''}" fill="${isLiked ? '#EF4444' : 'none'}" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
                        </svg>
                    </button>
                </div>

                <div class="relative w-full aspect-[4/3] flex items-center justify-center my-6">
                    <img src="${product.image}" alt="${product.name}" class="max-h-full object-contain transform group-hover:scale-105 transition-transform duration-500 drop-shadow-md">
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <h3 class="text-base font-semibold text-white tracking-wide">${product.name}</h3>
                        <span class="text-sm font-bold text-skybrand-blue">₴ ${product.price.toLocaleString()}</span>
                    </div>
                    <p class="text-xs text-skybrand-light/60 font-light mb-2">${product.description}</p>
                    <p class="text-[11px] text-skybrand-blue/80 font-medium mb-4">${product.spec}</p>
                    <button onclick="addToCart('${product.id}')" class="w-full py-3 bg-skybrand-surface border border-skybrand-border rounded-xl text-xs uppercase tracking-wider text-skybrand-light font-semibold hover:bg-skybrand-blue hover:border-skybrand-blue hover:text-skybrand-bg transition-all duration-300 shadow-md">
                        Додати до кошика
                    </button>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function filterCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.remove('bg-skybrand-blue', 'text-skybrand-bg', 'font-bold');
        btn.classList.add('bg-skybrand-card', 'text-skybrand-light/70', 'border', 'border-skybrand-border');
    });
    const activeBtn = document.getElementById(`filter-${category}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-skybrand-card', 'text-skybrand-light/70', 'border', 'border-skybrand-border');
        activeBtn.classList.add('bg-skybrand-blue', 'text-skybrand-bg', 'font-bold');
    }
    renderProducts();
}

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
        container.innerHTML = `<p class="text-xs text-skybrand-light/50 text-center py-10">Кошик порожній</p>`;
        totalElement.innerText = `₴ 0`;
        return;
    }

    let totalSum = 0;
    cart.forEach(item => {
        totalSum += item.price * item.qty;
        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between p-3 bg-skybrand-surface rounded-xl border border-skybrand-border shadow-inner">
                <div class="flex items-center space-x-3">
                    <img src="${item.image}" class="w-12 h-12 object-contain bg-skybrand-bg p-1 rounded-lg">
                    <div>
                        <h4 class="text-xs font-semibold text-white">${item.name}</h4>
                        <span class="text-[11px] text-skybrand-light/60">₴ ${item.price.toLocaleString()} × ${item.qty}</span>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="text-skybrand-light/60 hover:text-white text-xs px-2 font-bold">✕</button>
            </div>
        `);
    });

    totalElement.innerText = `₴ ${totalSum.toLocaleString()}`;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

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
        container.innerHTML = `<p class="text-xs text-skybrand-light/50 text-center py-10">Список обраного порожній</p>`;
        return;
    }

    wishlist.forEach(id => {
        const product = productsData.find(p => p.id === id);
        if (product) {
            container.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between p-3 bg-skybrand-surface rounded-xl border border-skybrand-border shadow-inner">
                    <div class="flex items-center space-x-3">
                        <img src="${product.image}" class="w-12 h-12 object-contain bg-skybrand-bg p-1 rounded-lg">
                        <div>
                            <h4 class="text-xs font-semibold text-white">${product.name}</h4>
                            <span class="text-[11px] text-skybrand-blue font-bold">₴ ${product.price.toLocaleString()}</span>
                        </div>
                    </div>
                    <button onclick="toggleWishlist('${product.id}'); openWishlistDrawer();" class="text-red-400 text-xs px-2 font-bold hover:text-red-300">Видалити</button>
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
    alert('Замовлення успішно підтверджено! Очікуйте доставку вашого небесного девайсу.');
    cart = [];
    updateCartUI();
    closeCartDrawer();
}