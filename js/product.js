// =========================
// Product Variables
// =========================

let quantity = 1;
let selectedSize = null;
let isWishlisted = false;

// =========================
// Load Product Data from MySQL
// =========================

let currentProduct = null;

async function fetchProductDetails() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        
        // For testing, let's grab the first product from your database
        // (Later, you can use URL search params to match a specific product ID)
        currentProduct = products[0]; 

        // Update the page elements dynamically
        document.querySelector('.product-title').textContent = currentProduct.name;
        document.querySelector('.product-price').textContent = `$${currentProduct.price}`;
        
        // If you have a description element:
        const descElem = document.querySelector('.product-description');
        if (descElem) descElem.textContent = currentProduct.description;

    } catch (error) {
        console.error('Error loading product:', error);
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', fetchProductDetails);
// =========================
// Size Selection
// =========================

const sizeButtons = document.querySelectorAll(".size-button");
const selectedSizeText = document.getElementById("selected-size");

sizeButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        // Remove selected state from all buttons
        sizeButtons.forEach(function(sizeButton) {
            sizeButton.classList.remove("selected");
        });

        // Select clicked button
        button.classList.add("selected");

        // Save selected size
        selectedSize = button.dataset.size;

        // Update text
        selectedSizeText.textContent = selectedSize;
    });

});


// =========================
// Quantity Controls
// =========================

const quantityDisplay = document.getElementById("quantity");
const decreaseButton = document.getElementById("decrease-quantity");
const increaseButton = document.getElementById("increase-quantity");


increaseButton.addEventListener("click", function() {

    quantity++;

    quantityDisplay.textContent = quantity;

});


decreaseButton.addEventListener("click", function() {

    // Prevent quantity from going below 1
    if (quantity > 1) {
        quantity--;
    }

    quantityDisplay.textContent = quantity;

});


// =========================
// Add to Cart
// =========================

const addToCartButton = document.getElementById("add-to-cart");

addToCartButton.addEventListener("click", function() {
    if (selectedSize === null) {
        alert("Please select a size before adding this item to your cart.");
        return;
    }

    if (!currentProduct) {
        alert("Product data is still loading. Please try again.");
        return;
    }

    // Create cart item object
    const cartItem = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        size: selectedSize,
        quantity: quantity
    };

    // Save to localStorage so your cart.html page can read it
    let cart = JSON.parse(localStorage.getItem('wardrobe_cart')) || [];
    cart.push(cartItem);
    localStorage.setItem('wardrobe_cart', JSON.stringify(cart));

    alert(
        `Added to cart!\n\n` +
        `Product: ${currentProduct.name}\n` +
        `Size: ${selectedSize}\n` +
        `Quantity: ${quantity}`
    );
});


// =========================
// Wishlist
// =========================

const wishlistButton = document.getElementById("wishlist-button");

wishlistButton.addEventListener("click", function() {

    isWishlisted = !isWishlisted;

    if (isWishlisted) {

        wishlistButton.classList.add("active");
        wishlistButton.textContent = "♥ Added to Wishlist";

    } else {

        wishlistButton.classList.remove("active");
        wishlistButton.textContent = "♡ Add to Wishlist";

    }

});