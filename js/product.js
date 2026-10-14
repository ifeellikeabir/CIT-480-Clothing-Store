// =========================
// Product Page Script
// =========================

let quantity = 1;
let selectedSize = null;
let currentProduct = null;

// Load Product Data from MySQL Backend API
async function fetchProductDetails() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        
        // Grab the first product (or you can map URL params later for specific IDs)
        currentProduct = products[0] || {}; 

        // Update the page elements dynamically
        const nameElem = document.querySelector('.product-name');
        if (nameElem) nameElem.textContent = currentProduct.name;

        const priceElem = document.querySelector('.product-price');
        if (priceElem) priceElem.textContent = `$${parseFloat(currentProduct.price || 0).toFixed(2)}`;
        
        const descElem = document.querySelector('.description p');
        if (descElem && currentProduct.description) {
            descElem.textContent = currentProduct.description;
        }

    } catch (error) {
        console.error('Error loading product details:', error);
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchProductDetails();
});

// =========================
// Size Selection
// =========================

const sizeButtons = document.querySelectorAll(".size-button");
const selectedSizeText = document.getElementById("selected-size");

sizeButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        sizeButtons.forEach(function(sizeButton) {
            sizeButton.classList.remove("selected");
        });

        button.classList.add("selected");
        selectedSize = button.dataset.size;
        if (selectedSizeText) selectedSizeText.textContent = selectedSize;
    });
});

// =========================
// Quantity Controls
// =========================

const quantityDisplay = document.getElementById("quantity");
const decreaseButton = document.getElementById("decrease-quantity");
const increaseButton = document.getElementById("increase-quantity");

if (increaseButton) {
    increaseButton.addEventListener("click", function() {
        quantity++;
        if (quantityDisplay) quantityDisplay.textContent = quantity;
    });
}

if (decreaseButton) {
    decreaseButton.addEventListener("click", function() {
        if (quantity > 1) {
            quantity--;
        }
        if (quantityDisplay) quantityDisplay.textContent = quantity;
    });
}

// =========================
// Add to Cart Logic (Synced with cart.html)
// =========================

const addToCartButton = document.getElementById("add-to-cart");

if (addToCartButton) {
    addToCartButton.addEventListener("click", function() {
        if (selectedSize === null) {
            alert("Please select a size before adding this item to your cart.");
            return;
        }

        if (!currentProduct) {
            alert("Product data is still loading. Please try again.");
            return;
        }

        const cartItem = {
            name: currentProduct.name,
            color: currentProduct.color || "Standard",
            size: selectedSize,
            price: parseFloat(currentProduct.price),
            quantity: quantity
        };

        // Use the consistent 'wardrobe_cart' key matching your cart.html
        let cart = JSON.parse(localStorage.getItem('wardrobe_cart')) || [];
        
        const existing = cart.find(item => item.name === cartItem.name && item.size === cartItem.size);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + quantity;
        } else {
            cart.push(cartItem);
        }

        localStorage.setItem('wardrobe_cart', JSON.stringify(cart));
        alert(`"${cartItem.name}" (Size ${selectedSize}, Qty: ${quantity}) was added to your cart!`);
    });
}

// =========================
// Wishlist Logic (Synced with wishlist.html)
// =========================

const wishlistButton = document.getElementById("wishlist-button");

if (wishlistButton) {
    wishlistButton.addEventListener("click", function() {
        if (!currentProduct) {
            alert("Product data is still loading. Please try again.");
            return;
        }

        const wishlistItem = {
            name: currentProduct.name,
            color: currentProduct.color || "Standard",
            size: selectedSize || "S",
            price: parseFloat(currentProduct.price)
        };

        // Use the consistent 'wardrobe_wishlist' key matching your wishlist.html
        let wishlist = JSON.parse(localStorage.getItem('wardrobe_wishlist')) || [];

        const alreadySaved = wishlist.some(item => item.name === wishlistItem.name && item.size === wishlistItem.size);
        if (alreadySaved) {
            alert(`"${wishlistItem.name}" is already in your wishlist.`);
            return;
        }

        wishlist.push(wishlistItem);
        localStorage.setItem('wardrobe_wishlist', JSON.stringify(wishlist));
        
        wishlistButton.classList.add("active");
        wishlistButton.textContent = "♥ Added to Wishlist";
        alert(`"${wishlistItem.name}" was saved to your wishlist!`);
    });
}