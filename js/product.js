// =========================
// Product Page Script
// Shows one product from the database: product.html?id=3
// (uses helpers from js/site.js)
// =========================

let quantity = 1;
let selectedSize = null;
let currentProduct = null;

const CATEGORY_LABELS = { tops: 'Tops', bottoms: 'Bottoms', accessories: 'Accessories' };

// Load Product Data from MySQL Backend API
async function fetchProductDetails() {
    try {
        const products = await api('/api/products');
        const id = Number(new URLSearchParams(window.location.search).get('id'));

        // Use the product from the URL, or the first product if there's no id
        currentProduct = products.find(p => p.id === id) || products[0];
        if (!currentProduct) throw new Error('No products found');

        renderProduct(currentProduct);
        renderRelated(products);
    } catch (error) {
        console.error('Error loading product details:', error);
        document.querySelector('.product-name').textContent = 'Product unavailable';
        document.querySelector('.product-price').textContent = 'Make sure the server is running (node server.js).';
    }
}

function renderProduct(product) {
    const category = CATEGORY_LABELS[product.category] || 'Shop';
    const sizes = Array.isArray(product.sizes) ? product.sizes : String(product.sizes || 'One Size').split(',');

    document.title = `Wardrobe.io | ${product.name}`;
    document.querySelector('.product-name').textContent = product.name;
    document.querySelector('.product-price').textContent = money(product.price);
    document.getElementById('product-color').textContent = product.color;
    document.getElementById('product-category').textContent = category;
    document.getElementById('crumb-category').textContent = category;
    document.getElementById('crumb-category').href = `index.html#${product.category}`;
    document.getElementById('crumb-name').textContent = product.name;

    const image = document.getElementById('product-image');
    image.style.backgroundColor = garmentBackground(product);
    image.innerHTML = garmentSVG(product);

    if (product.description) {
        document.getElementById('product-description').textContent = product.description;
    }

    // Size buttons come from the sizes saved in the database
    document.getElementById('size-options').innerHTML = sizes.map(size =>
        `<button class="size-button" data-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`
    ).join('');
    setupSizeButtons();

    // Only one size? Pick it automatically.
    if (sizes.length === 1) {
        document.querySelector('.size-button').click();
    }
}

// "You Might Also Like": other items in the same category
function renderRelated(products) {
    const related = products
        .filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
        .slice(0, 4);
    const section = document.querySelector('.related');

    if (related.length === 0) {
        section.style.display = 'none';
        return;
    }

    document.getElementById('related-grid').innerHTML = related.map(p => `
        <article class="product-card">
            <a href="product.html?id=${p.id}" class="garment" style="background-color: ${garmentBackground(p)};">${garmentSVG(p)}</a>
            <div class="product-body">
                <h4><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h4>
                <p class="product-meta">
                    <span>${escapeHtml(p.color)}</span>
                    <span class="price">${money(p.price)}</span>
                </p>
            </div>
        </article>
    `).join('');
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchProductDetails();
});

// =========================
// Size Selection
// =========================

function setupSizeButtons() {
    const sizeButtons = document.querySelectorAll('.size-button');
    const selectedSizeText = document.getElementById('selected-size');

    sizeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            sizeButtons.forEach(function (sizeButton) {
                sizeButton.classList.remove('selected');
            });

            button.classList.add('selected');
            selectedSize = button.dataset.size;
            if (selectedSizeText) selectedSizeText.textContent = selectedSize;
        });
    });
}

// =========================
// Quantity Controls
// =========================

const quantityDisplay = document.getElementById('quantity');
const decreaseButton = document.getElementById('decrease-quantity');
const increaseButton = document.getElementById('increase-quantity');

increaseButton.addEventListener('click', function () {
    quantity++;
    quantityDisplay.textContent = quantity;
});

decreaseButton.addEventListener('click', function () {
    if (quantity > 1) {
        quantity--;
    }
    quantityDisplay.textContent = quantity;
});

// =========================
// Add to Cart (saved in the database)
// =========================

document.getElementById('add-to-cart').addEventListener('click', async function () {
    if (!currentProduct) {
        showToast('Product is still loading. Try again in a second.', true);
        return;
    }
    if (selectedSize === null) {
        showToast('Pick a size first.', true);
        return;
    }

    try {
        await addItemToCart(currentProduct, selectedSize, quantity);
        showToast(`${currentProduct.name} (Size ${selectedSize}, Qty ${quantity}) added to your bag`);
    } catch (error) {
        console.error(error);
        showToast('Could not add to bag. Is the server running?', true);
    }
});

// =========================
// Wishlist (saved in the database)
// =========================

const wishlistButton = document.getElementById('wishlist-button');

wishlistButton.addEventListener('click', async function () {
    if (!currentProduct) {
        showToast('Product is still loading. Try again in a second.', true);
        return;
    }
    if (selectedSize === null) {
        showToast('Pick a size first.', true);
        return;
    }

    try {
        const added = await addItemToWishlist(currentProduct, selectedSize);
        wishlistButton.classList.add('active');
        wishlistButton.innerHTML = '&#9829; Saved to Wishlist';
        showToast(added ? `${currentProduct.name} saved to your wishlist` : `${currentProduct.name} is already in your wishlist`);
    } catch (error) {
        console.error(error);
        showToast('Could not save to wishlist. Is the server running?', true);
    }
});
