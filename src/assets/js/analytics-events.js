/* Umami custom events, delegated.
 *
 * One listener pair instead of data-umami-event attributes: the page HTML is
 * machine-exported (see the data-spec / tpl-* ids that sections.js keys off)
 * and duplicated per locale under /ko/, so per-element attributes would be
 * wiped by the next export and would have to be kept in sync across both
 * language trees. Everything here keys off hrefs and stable classes instead.
 *
 * Capture phase on purpose — nav.js stopPropagation()s in the bubble phase
 * (src/assets/js/nav.js:73); capture sees the click first. It also means the
 * FAQ handler below observes the item's class BEFORE sections.js toggles it,
 * which is how "opening" is told apart from "closing".
 *
 * The tracker sends with keepalive:true, so events fired on the same tick as
 * a navigation — tel: taps, outbound links — still go out. The contact form
 * doesn't need that guarantee: formspree.js preventDefault()s and posts via
 * fetch, so the page never unloads.
 */
(function () {
    'use strict';

    function track(name, props) {
        if (window.umami && typeof window.umami.track === 'function') {
            window.umami.track(name, props);
        }
    }

    /* Where on the page the click happened, in terms a human reading the
       dashboard will recognise. Checked most-specific first: the mobile menu
       lives inside #cs-navigation, the audit dialog sits at body level (so it
       would otherwise fall through to 'page'), and the contact strip is
       #contact-1392 / #cta-697 depending on the template. */
    function zoneOf(el) {
        if (el.closest('.audit-fab, .audit-dialog')) return 'audit-widget';
        if (el.closest('.cs-ul-wrapper')) return 'mobile-menu';
        if (el.closest('#cs-navigation')) return 'header';
        if (el.closest('[id^="cta-"], [id^="contact-"]')) return 'contact-strip';
        if (el.closest('#cs-footer-309, footer')) return 'footer';
        var section = el.closest('section[id]');
        return section ? section.id : 'page';
    }

    /* Outbound social destinations, by hostname suffix. Only LinkedIn is
       linked today; the others are here so adding a profile link later needs
       no change in this file. */
    var SOCIAL = [
        [/(^|\.)linkedin\.com$/, 'LinkedIn'],
        [/(^|\.)facebook\.com$/, 'Facebook'],
        [/(^|\.)instagram\.com$/, 'Instagram'],
        [/(^|\.)(twitter|x)\.com$/, 'X']
    ];

    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;

        /* FAQ opens — <button>, not <a>, so handled before the anchor path.
           sections.js toggles 'active' on the <li>; in capture phase that is
           still the PREVIOUS state, so its absence means this click opens. */
        var faqButton = e.target.closest('.cs-faq-item .cs-button');
        if (faqButton) {
            var item = faqButton.closest('.cs-faq-item');
            if (item && !item.classList.contains('active')) {
                var q = faqButton.querySelector('.cs-button-text');
                track('FAQ Open', {
                    question: ((q && q.textContent) || '').trim().replace(/\s+/g, ' ').slice(0, 80),
                    page: location.pathname
                });
            }
            return;
        }

        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var props = { zone: zoneOf(a), page: location.pathname };

        if (href.lastIndexOf('tel:', 0) === 0) {
            track('Call Click', props);
            return;
        }
        if (href.lastIndexOf('mailto:', 0) === 0) {
            track('Email Click', props);
            return;
        }

        /* Directions: both the long google.com/maps/place form and the
           maps.app.goo.gl short link the footer uses. */
        if (/(^|\.)maps\.app\.goo\.gl$/.test(a.hostname) ||
            (/(^|\.)google\.[a-z.]+$/.test(a.hostname) && /maps/.test(href))) {
            track('Directions Click', props);
            return;
        }

        for (var i = 0; i < SOCIAL.length; i++) {
            if (SOCIAL[i][0].test(a.hostname)) {
                props.network = SOCIAL[i][1];
                track('Social Click', props);
                return;
            }
        }

        /* Quote intent. cs-button-solid is the shared CTA styling and
           cs-nav-button is the header's; both point at /contact/ or
           /ko/contact/. The label separates a true "Get Started" from the
           softer "Read More" buttons that share the styling and destination. */
        if (/\/contact\/?$/.test(a.pathname) &&
            (a.classList.contains('cs-button-solid') ||
                a.classList.contains('cs-nav-button'))) {
            props.label = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
            track('Quote CTA', props);
        }
    }, true);

    /* Capture phase again so this runs before formspree.js's bubble-phase
       handler calls preventDefault() — that only cancels the native POST, not
       this listener, but capture keeps the ordering deterministic either way.
       Covers the footer contact form and the audit FAB form. */
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        track('Form Submit', {
            form: form.getAttribute('name') || form.id ||
                (form.hasAttribute('data-audit-form') ? 'Audit Form' : 'form'),
            page: location.pathname
        });
    }, true);
})();
