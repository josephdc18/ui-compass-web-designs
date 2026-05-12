/**
 * Cart — client-side cart state using localStorage.
 * No server-side cart — all state lives in the browser.
 *
 * API:
 *   window.shopCart.add(product, quantity, variant)
 *   window.shopCart.remove(itemKey)
 *   window.shopCart.updateQuantity(itemKey, quantity)
 *   window.shopCart.getItems()
 *   window.shopCart.getTotal()
 *   window.shopCart.getCount()
 *   window.shopCart.clear()
 */

(function () {
    const STORAGE_KEY = 'shop-cart';

    function esc(str) {
        var d = document.createElement('div');
        d.textContent = String(str || '');
        return d.innerHTML;
    }

    function load() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch { return []; }
    }

    function save(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items, count: countItems(items), total: calcTotal(items) } }));
    }

    function itemKey(productId, variantId) {
        return variantId ? productId + '-' + variantId : String(productId);
    }

    function countItems(items) {
        return items.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    }

    function calcTotal(items) {
        return items.reduce(function (sum, i) { return sum + i.price_cents * i.quantity; }, 0);
    }

    window.shopCart = {
        add: function (product, quantity, variant) {
            quantity = Math.max(1, parseInt(quantity, 10) || 1);
            var items = load();
            var key = itemKey(product.id, variant ? variant.id : null);
            var existing = items.find(function (i) { return i.key === key; });

            if (existing) {
                existing.quantity += quantity;
            } else {
                items.push({
                    key: key,
                    productId: product.id,
                    variantId: variant ? variant.id : null,
                    name: product.name + (variant ? ' — ' + variant.name : ''),
                    price_cents: variant ? variant.price_cents : product.price_cents,
                    price: variant ? variant.price : product.price,
                    image_url: product.image_url || '',
                    slug: product.slug,
                    quantity: quantity,
                });
            }
            save(items);
        },

        remove: function (key) {
            var items = load().filter(function (i) { return i.key !== key; });
            save(items);
        },

        updateQuantity: function (key, quantity) {
            quantity = Math.max(0, parseInt(quantity, 10) || 0);
            var items = load();
            if (quantity <= 0) {
                items = items.filter(function (i) { return i.key !== key; });
            } else {
                var item = items.find(function (i) { return i.key === key; });
                if (item) item.quantity = quantity;
            }
            save(items);
        },

        getItems: function () { return load(); },
        getCount: function () { return countItems(load()); },
        getTotal: function () { return calcTotal(load()); },
        getTotalFormatted: function () { return (calcTotal(load()) / 100).toFixed(2); },
        clear: function () { save([]); },
    };

    // --- Cart Drawer ---
    var drawer = document.getElementById('cart-drawer');
    var overlay = document.getElementById('cart-overlay');
    var badge = document.getElementById('cart-badge');
    var drawerItems = document.getElementById('cart-drawer-items');
    var drawerTotal = document.getElementById('cart-drawer-total');
    var drawerClose = document.getElementById('cart-drawer-close');
    var cartTriggers = document.querySelectorAll('[data-open-cart]');

    function openDrawer() {
        if (drawer) { drawer.classList.add('cs-active'); }
        if (overlay) { overlay.classList.add('cs-active'); }
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        if (drawer) { drawer.classList.remove('cs-active'); }
        if (overlay) { overlay.classList.remove('cs-active'); }
        document.body.style.overflow = '';
    }

    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
    for (var i = 0; i < cartTriggers.length; i++) {
        cartTriggers[i].addEventListener('click', function (e) {
            e.preventDefault();
            openDrawer();
        });
    }

    function renderDrawer() {
        var items = load();
        if (badge) {
            var count = countItems(items);
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
        if (!drawerItems || !drawerTotal) return;

        if (items.length === 0) {
            drawerItems.innerHTML = '<p style="text-align:center;color:#888;padding:2rem 0">Your cart is empty</p>';
            drawerTotal.textContent = '$0.00';
            return;
        }

        drawerItems.innerHTML = items.map(function (item) {
            var k = esc(item.key);
            return '<div class="cs-cart-item" data-key="' + k + '">' +
                (item.image_url ? '<img class="cs-cart-item-img" src="' + esc(item.image_url) + '" alt="" width="60" height="60" loading="lazy" decoding="async">' : '') +
                '<div class="cs-cart-item-info">' +
                    '<div class="cs-cart-item-name">' + esc(item.name) + '</div>' +
                    '<div class="cs-cart-item-price">$' + esc(item.price) + '</div>' +
                '</div>' +
                '<div class="cs-cart-item-actions">' +
                    '<div class="cs-cart-qty">' +
                        '<button class="cs-cart-qty-btn" data-action="minus" data-key="' + k + '">−</button>' +
                        '<span class="cs-cart-qty-num">' + parseInt(item.quantity, 10) + '</span>' +
                        '<button class="cs-cart-qty-btn" data-action="plus" data-key="' + k + '">+</button>' +
                    '</div>' +
                    '<button class="cs-cart-remove" data-key="' + k + '" aria-label="Remove">×</button>' +
                '</div>' +
            '</div>';
        }).join('');

        drawerTotal.textContent = '$' + (calcTotal(items) / 100).toFixed(2);
    }

    // Delegate click events in drawer
    if (drawerItems) {
        drawerItems.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (btn) {
                var key = btn.dataset.key;
                var items = load();
                var item = items.find(function (i) { return i.key === key; });
                if (item) {
                    if (btn.dataset.action === 'plus') {
                        window.shopCart.updateQuantity(key, item.quantity + 1);
                    } else if (btn.dataset.action === 'minus') {
                        window.shopCart.updateQuantity(key, item.quantity - 1);
                    }
                }
                return;
            }
            var removeBtn = e.target.closest('.cs-cart-remove');
            if (removeBtn) {
                window.shopCart.remove(removeBtn.dataset.key);
            }
        });
    }

    document.addEventListener('cart:updated', renderDrawer);
    renderDrawer();
})();
