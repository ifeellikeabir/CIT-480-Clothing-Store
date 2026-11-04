// ==========================================================
// WARDROBE.IO  |  Shared site script (used on every page)
// - talks to the Node/MySQL server
// - keeps the cart + wishlist badges updated
// - shows the "Hi, name" login button
// - toast messages instead of alert() pop-ups
// - draws a simple clothing picture for each product
// ==========================================================

const API_BASE = 'http://localhost:3000';
const FREE_SHIPPING_MIN = 50;
const SHIPPING_COST = 5.99;

// ---------- Server helper ----------
async function api(path, options = {}) {
    const response = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

// ---------- Small helpers ----------
function money(amount) {
    return '$' + (parseFloat(amount) || 0).toFixed(2);
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function shippingFor(subtotal) {
    return subtotal === 0 || subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;
}

// ---------- Toast messages ----------
let toastTimer;
function showToast(message, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ---------- Cart & wishlist (saved in MySQL) ----------
async function getCartItems() {
    try {
        return await api('/api/cart');
    } catch (error) {
        console.error('Error loading cart:', error);
        return [];
    }
}

async function getWishlistItems() {
    try {
        return await api('/api/wishlist');
    } catch (error) {
        console.error('Error loading wishlist:', error);
        return [];
    }
}

// Adds to the cart. If the same item + size is already there, it just adds to the quantity.
async function addItemToCart(product, size, quantity = 1) {
    const cart = await getCartItems();
    const existing = cart.find(item =>
        Number(item.product_id) === Number(product.id) && item.size === size
    );

    if (existing) {
        await api(`/api/cart/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: existing.quantity + quantity })
        });
    } else {
        await api('/api/cart', {
            method: 'POST',
            body: JSON.stringify({
                product_id: product.id,
                name: product.name,
                color: product.color,
                size: size,
                price: parseFloat(product.price),
                quantity: quantity
            })
        });
    }
    updateNavCounts();
}

// Saves to the wishlist. Returns false if it was already saved.
async function addItemToWishlist(product, size) {
    const wishlist = await getWishlistItems();
    const alreadySaved = wishlist.some(item =>
        Number(item.product_id) === Number(product.id) && item.size === size
    );
    if (alreadySaved) return false;

    await api('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify({
            product_id: product.id,
            name: product.name,
            color: product.color,
            size: size,
            price: parseFloat(product.price)
        })
    });
    updateNavCounts();
    return true;
}

async function updateNavCounts() {
    const [cart, wishlist] = await Promise.all([getCartItems(), getWishlistItems()]);
    const cartCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);

    document.querySelectorAll('.cart-nav-count').forEach(el => el.textContent = cartCount);
    document.querySelectorAll('.wishlist-nav-count').forEach(el => el.textContent = wishlist.length);
}

// ---------- Login button ("Hi, name" + log out) ----------
function setupAuthButton() {
    const currentUser = localStorage.getItem('wardrobe_user');
    const loginBtn = document.querySelector('.nav-btn');
    if (!currentUser || !loginBtn) return;

    loginBtn.textContent = `Hi, ${currentUser}`;
    loginBtn.href = '#';
    loginBtn.title = 'Click to log out';
    loginBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!confirm('Do you want to log out?')) return;
        try {
            await api('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem('wardrobe_user');
        window.location.reload();
    });
}

// ---------- Product pictures ----------
// The database doesn't have photos yet, so each product gets a simple
// drawing based on its name, tinted with its color.

const COLOR_HEX = {
    white: '#f7f4ee', black: '#2a2c31', blue: '#55779f', navy: '#22365a',
    olive: '#6f7652', gray: '#9c9c98', grey: '#9c9c98', tan: '#cfb38a',
    red: '#c8553d', green: '#5f8a6a', brown: '#8a6248', pink: '#e7a3a0',
    cream: '#efe4cf', khaki: '#bfae86', yellow: '#e8c35a', orange: '#e8873c'
};

// soft beachy backgrounds, picked by product id
const BG_TINTS = ['#e8dcc8', '#d7e6e2', '#f2dccb', '#dde5ef', '#ece3cf', '#e6d6dc'];

function shadeHex(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const clamp = v => Math.max(0, Math.min(255, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function garmentType(product) {
    const name = (product.name || '').toLowerCase();
    if (/short/.test(name)) return 'shorts';
    if (/hoodie|sweatshirt|crew/.test(name)) return 'hoodie';
    if (/jacket|coat|flannel|overshirt/.test(name)) return 'jacket';
    if (/jean|pant|cargo|chino|jogger|trouser/.test(name)) return 'pants';
    if (/tee|shirt|tank|polo|top/.test(name)) return 'tee';
    if (/bag|tote|backpack/.test(name)) return 'tote';
    if (/beanie|hat|cap/.test(name)) return 'beanie';
    if (product.category === 'bottoms') return 'pants';
    if (product.category === 'accessories') return 'tote';
    return 'tee';
}

function garmentSVG(product) {
    const fill = COLOR_HEX[(product.color || '').toLowerCase()] || product.swatch_color || '#55779f';
    const isLight = parseInt(fill.slice(1, 3), 16) > 200;
    const line = isLight ? '#b9b2a6' : shadeHex(fill, -40);
    const accent = isLight ? shadeHex(fill, -14) : shadeHex(fill, -22);
    const s = `fill="${fill}" stroke="${line}" stroke-width="3" stroke-linejoin="round"`;
    const seam = `fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"`;

    const shapes = {
        tee: `
            <path ${s} d="M70 30 L48 38 L18 64 L36 90 L56 80 L56 174 L144 174 L144 80 L164 90 L182 64 L152 38 L130 30 Q100 50 70 30 Z"/>
            <path ${seam} d="M70 30 Q100 54 130 30"/>`,
        hoodie: `
            <path ${s} d="M64 42 L42 52 L20 124 L42 130 L58 94 L58 178 L142 178 L142 94 L158 130 L180 124 L158 52 L136 42 Z"/>
            <path fill="${accent}" stroke="${line}" stroke-width="3" stroke-linejoin="round" d="M64 42 Q100 2 136 42 Q122 66 100 68 Q78 66 64 42 Z"/>
            <path ${seam} d="M92 68 L90 98 M108 68 L110 98"/>
            <path ${seam} d="M74 132 L126 132 L134 160 L66 160 Z"/>`,
        jacket: `
            <path ${s} d="M68 30 L44 40 L20 126 L42 132 L58 96 L58 178 L142 178 L142 96 L158 132 L180 126 L156 40 L132 30 L100 48 Z"/>
            <path fill="${accent}" stroke="${line}" stroke-width="3" stroke-linejoin="round" d="M68 30 L100 48 L132 30 L118 64 L100 52 L82 64 Z"/>
            <path ${seam} d="M100 52 L100 178"/>
            <path ${seam} d="M70 92 L90 92 M110 92 L130 92"/>
            <circle cx="108" cy="110" r="3.5" fill="${line}"/><circle cx="108" cy="138" r="3.5" fill="${line}"/><circle cx="108" cy="164" r="3.5" fill="${line}"/>`,
        pants: `
            <path ${s} d="M60 24 L140 24 L150 180 L110 180 L100 84 L90 180 L50 180 Z"/>
            <path ${seam} d="M60 40 L140 40"/>
            <path ${seam} d="M64 42 Q72 64 92 60 M136 42 Q128 64 108 60"/>
            <path ${seam} d="M100 40 L100 84"/>`,
        shorts: `
            <path ${s} d="M56 48 L144 48 L156 142 L108 148 L100 102 L92 148 L44 142 Z"/>
            <path ${seam} d="M56 64 L144 64"/>
            <path ${seam} d="M92 50 L90 70 M108 50 L110 70"/>`,
        tote: `
            <path ${seam} stroke-width="8" d="M74 84 Q74 30 100 30 Q126 30 126 84"/>
            <path ${s} d="M44 78 L156 78 L148 180 L52 180 Z"/>
            <path ${seam} d="M62 100 L138 100"/>`,
        beanie: `
            <circle cx="100" cy="42" r="15" fill="${accent}" stroke="${line}" stroke-width="3"/>
            <path ${s} d="M46 132 Q46 54 100 52 Q154 54 154 132 Z"/>
            <rect x="40" y="124" width="120" height="40" rx="10" fill="${accent}" stroke="${line}" stroke-width="3"/>
            <path ${seam} d="M60 130 L60 158 M80 130 L80 158 M100 130 L100 158 M120 130 L120 158 M140 130 L140 158"/>`
    };

    return `<svg viewBox="0 0 200 200" aria-hidden="true">${shapes[garmentType(product)]}</svg>`;
}

function garmentBackground(product) {
    return BG_TINTS[(Number(product.id) || 0) % BG_TINTS.length];
}

// ---------- Run on every page ----------
document.addEventListener('DOMContentLoaded', () => {
    updateNavCounts();
    setupAuthButton();
});
