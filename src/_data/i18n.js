/**
 * Internationalization (i18n) Configuration
 * Defines available languages and default settings
 */

module.exports = {
    // Default language (used when no locale prefix in URL)
    defaultLocale: 'en',

    // Available languages
    // Add or remove languages as needed for your project
    locales: {
        en: {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            dir: 'ltr',
            hreflang: 'en',
            dateFormat: 'MMMM d, yyyy',
            flag: '\u{1F1FA}\u{1F1F8}',
        },
        ko: {
            code: 'ko',
            name: 'Korean',
            nativeName: '\ud55c\uad6d\uc5b4',
            dir: 'ltr',
            hreflang: 'ko',
            dateFormat: 'yyyy\ub144 M\uc6d4 d\uc77c',
            flag: '\u{1F1F0}\u{1F1F7}',
        },
        es: {
            code: 'es',
            name: 'Spanish',
            nativeName: 'Espa\u00f1ol',
            dir: 'ltr',
            hreflang: 'es',
            dateFormat: "d 'de' MMMM 'de' yyyy",
            flag: '\u{1F1F2}\u{1F1FD}',
        },
        // Add more languages as needed:
        // fr: { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', dir: 'ltr', hreflang: 'fr', dateFormat: 'd MMMM yyyy', flag: '\u{1F1EB}\u{1F1F7}' },
        // de: { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', hreflang: 'de', dateFormat: 'd. MMMM yyyy', flag: '\u{1F1E9}\u{1F1EA}' },
    },

    // Get array of locale codes for iteration
    get localeList() {
        return Object.keys(this.locales);
    },

    // Get locale info by code
    getLocale(code) {
        return this.locales[code] || this.locales[this.defaultLocale];
    },

    // Check if locale is RTL (right-to-left)
    isRTL(code) {
        const locale = this.getLocale(code);
        return locale.dir === 'rtl';
    },
};
