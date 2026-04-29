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
    if (toggle && ul) {
        toggle.addEventListener('click', function() {
            var nextExpanded = ul.getAttribute('aria-expanded') !== 'true';
            csNav.classList.toggle('cs-active', nextExpanded);
            toggle.setAttribute('aria-expanded', String(nextExpanded));
            ul.setAttribute('aria-expanded', String(nextExpanded));
            document.body.classList.toggle('cs-open', nextExpanded);
        });
    }

    // Mobile dropdown submenus
    csNav.querySelectorAll('.cs-dropdown').forEach(function(dd) {
        dd.addEventListener('click', function(e) {
            if (e.target.closest('.cs-drop-link')) return;
            dd.classList.toggle('cs-active');
        });
    });
})();
