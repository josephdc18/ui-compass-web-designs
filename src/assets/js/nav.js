//
//    Toggle Mobile Navigation (CodeStitch pattern)
//
(function() {
    // Find nav by prefix — exported IDs vary (cs-navigation, cs-navigation-758, etc.)
    var csNav = document.querySelector('header[id^="cs-navigation"]')
        || document.querySelector('[id^="cs-navigation"]');
    if (!csNav) return;

    var toggle = csNav.querySelector('.cs-toggle');
    var ul = csNav.querySelector('[id^="cs-expanded"]') || csNav.querySelector('.cs-ul');

    // Stagger index — drives the cascading reveal in the open state.
    if (ul) {
        var topItems = ul.querySelectorAll(':scope > .cs-li');
        topItems.forEach(function(li, i) { li.style.setProperty('--i', i); });
    }
    if (toggle && ul) {
        toggle.addEventListener('click', function() {
            var nextExpanded = ul.getAttribute('aria-expanded') !== 'true';
            csNav.classList.toggle('cs-active', nextExpanded);
            toggle.setAttribute('aria-expanded', String(nextExpanded));
            ul.setAttribute('aria-expanded', String(nextExpanded));
            document.body.classList.toggle('cs-open', nextExpanded);
        });
    }

    // Top-level mobile dropdown submenus (e.g. Services, Locations).
    // Click anywhere on the .cs-dropdown EXCEPT a link/nested toggle bubbles up to here.
    csNav.querySelectorAll('.cs-li.cs-dropdown').forEach(function(dd) {
        dd.addEventListener('click', function(e) {
            // Ignore clicks on real links (let them navigate) and on nested-dropdown buttons (handled below).
            if (e.target.closest('a.cs-drop-link')) return;
            if (e.target.closest('.cs-drop-li.cs-dropdown')) return;
            dd.classList.toggle('cs-active');
        });
    });

    // Close the mobile menu when tapping outside the nav (and not on the toggle).
    // Uses pointerdown rather than click because the accordion grid-template-rows
    // transition can shift layout between mousedown and mouseup; click events
    // then fire on the common ancestor of the two targets (often <html> or
    // <body>), which fooled the older click-based handler into treating an
    // inside accordion tap as an "outside" click and closing the whole menu.
    document.addEventListener('pointerdown', function(e) {
        if (!csNav.classList.contains('cs-active')) return;
        if (csNav.contains(e.target)) return;
        csNav.classList.remove('cs-active');
        document.body.classList.remove('cs-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        if (ul) ul.setAttribute('aria-expanded', 'false');
    });

    // Escape key closes the open menu and returns focus to the toggle.
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (!csNav.classList.contains('cs-active')) return;
        csNav.classList.remove('cs-active');
        document.body.classList.remove('cs-open');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
        }
        if (ul) ul.setAttribute('aria-expanded', 'false');
    });

    // Nested mobile dropdown submenus (state → city under Locations).
    // The CSS opens `.cs-drop3` when its parent `.cs-drop-li.cs-dropdown` has `.cs-active`.
    // On mobile, we bind a click on the inner toggle button to flip that class
    // without bubbling up to close the parent dropdown.
    csNav.querySelectorAll('.cs-drop-li.cs-dropdown > .cs-dropdown-button').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var li = btn.parentElement;
            if (!li) return;
            var nextOpen = !li.classList.contains('cs-active');
            li.classList.toggle('cs-active', nextOpen);
            btn.setAttribute('aria-expanded', String(nextOpen));
        });
    });
})();
