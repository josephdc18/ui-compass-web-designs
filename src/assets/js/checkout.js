/**
 * Checkout redirect — sends cart to /api/checkout and redirects to Stripe.
 * Loaded on the cart page.
 */

(function() {
    var btn = document.getElementById('cart-checkout-btn');
    if (!btn || !window.shopCart) return;

    btn.addEventListener('click', function(e) {
        e.preventDefault();

        var items = window.shopCart.getItems();
        if (items.length === 0) return;

        btn.textContent = 'Processing...';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';

        var payload = items.map(function(item) {
            return { productId: item.productId, variantId: item.variantId, quantity: item.quantity };
        });

        fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payload }),
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Checkout failed');
            }
        })
        .catch(function(err) {
            console.error('[Checkout]', err);
            btn.textContent = 'Checkout Failed — Try Again';
            btn.style.pointerEvents = '';
            btn.style.opacity = '';
            setTimeout(function() { btn.textContent = 'Proceed to Checkout'; }, 3000);
        });
    });
})();
