/**
 * AETCAR Internationalization (i18n) Module
 * 
 * Unterstützt: DE (Deutsch), EN (English), MP (Monty Python 🐍)
 * 
 * Verwendung:
 *   1. Script einbinden: <script src="i18n.js"></script>
 *   2. Texte markieren: <span data-i18n="page.key">Fallback-Text</span>
 *   3. Sprache wechseln: ?lang=mp in URL oder I18n.setLang('mp')
 * 
 * API:
 *   I18n.init()                    - Initialisierung (automatisch)
 *   I18n.t(key, page)              - Übersetzung abrufen
 *   I18n.setLang(lang)             - Sprache wechseln
 *   I18n.getLang()                 - Aktuelle Sprache
 *   I18n.translatePage()           - Alle [data-i18n] Elemente übersetzen
 *   I18n.onReady(callback)         - Callback wenn Übersetzungen geladen
 */

window.I18n = (function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================
    
    const CONFIG = {
        defaultLang: 'de',
        supportedLangs: ['de', 'en', 'mp'],
        storageKey: 'aetcar_lang',
        translationsUrl: 'assets/translations.json',
        urlParam: 'lang',
        debug: false
    };

    // ========================================
    // STATE
    // ========================================
    
    let currentLang = CONFIG.defaultLang;
    let translations = null;
    let isLoaded = false;
    let readyCallbacks = [];
    let currentPage = '_global';

    // ========================================
    // INITIALIZATION
    // ========================================
    
    function init() {
        // Bestimme aktuelle Seite
        currentPage = detectCurrentPage();
        
        // Sprache aus URL, localStorage oder Default
        currentLang = detectLanguage();
        
        // Übersetzungen laden
        loadTranslations();
        
        if (CONFIG.debug) {
            console.log('[i18n] Initialisiert:', { lang: currentLang, page: currentPage });
        }
    }

    function detectCurrentPage() {
        try {
            const path = window.location.pathname || '';
            const filename = path.split('/').pop() || 'index.html';
            // Entferne .html Endung
            return filename.replace('.html', '') || 'index';
        } catch (e) {
            return 'index';
        }
    }

    function detectLanguage() {
        // 1. URL Parameter hat höchste Priorität
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get(CONFIG.urlParam);
        if (urlLang && CONFIG.supportedLangs.includes(urlLang.toLowerCase())) {
            const lang = urlLang.toLowerCase();
            // Speichere in localStorage für Persistenz
            try { localStorage.setItem(CONFIG.storageKey, lang); } catch(e) {}
            return lang;
        }
        
        // 2. localStorage
        try {
            const storedLang = localStorage.getItem(CONFIG.storageKey);
            if (storedLang && CONFIG.supportedLangs.includes(storedLang)) {
                return storedLang;
            }
        } catch(e) {}
        
        // 3. Browser-Sprache
        try {
            const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase().split('-')[0];
            if (CONFIG.supportedLangs.includes(browserLang)) {
                return browserLang;
            }
        } catch(e) {}
        
        // 4. Default
        return CONFIG.defaultLang;
    }

    function loadTranslations() {
        fetch(CONFIG.translationsUrl)
            .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(data => {
                translations = data;
                isLoaded = true;
                
                if (CONFIG.debug) {
                    console.log('[i18n] Übersetzungen geladen:', data.meta);
                }
                
                // Seite übersetzen
                translatePage();
                
                // Sprachauswahl in Navigation aktualisieren
                updateLangSelector();
                
                // Alle internen Links mit Sprachparameter aktualisieren
                updateInternalLinks();
                
                // Callbacks ausführen
                readyCallbacks.forEach(cb => {
                    try { cb(); } catch(e) { console.error('[i18n] Callback-Fehler:', e); }
                });
                readyCallbacks = [];
            })
            .catch(error => {
                console.warn('[i18n] Übersetzungen konnten nicht geladen werden:', error);
                isLoaded = true; // Trotzdem als "geladen" markieren, damit Fallbacks greifen
            });
    }

    // ========================================
    // TRANSLATION
    // ========================================
    
    /**
     * Übersetzt einen Schlüssel
     * @param {string} key - Schlüssel (z.B. "hero.title" oder "nav.start")
     * @param {string} page - Seite (optional, default: aktuelle Seite)
     * @returns {string} Übersetzter Text oder Fallback
     */
    function t(key, page) {
        if (!translations || !translations.pages) {
            return key; // Fallback: Key selbst
        }
        
        page = page || currentPage;
        
        // Suche in spezifischer Seite
        let value = translations.pages[page]?.[key]?.[currentLang];
        
        // Fallback: _global
        if (!value && page !== '_global') {
            value = translations.pages['_global']?.[key]?.[currentLang];
        }
        
        // Fallback: Default-Sprache
        if (!value) {
            value = translations.pages[page]?.[key]?.[CONFIG.defaultLang];
        }
        if (!value && page !== '_global') {
            value = translations.pages['_global']?.[key]?.[CONFIG.defaultLang];
        }
        
        return value || key;
    }

    /**
     * Übersetzt alle Elemente mit [data-i18n] Attribut
     */
    function translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const page = el.getAttribute('data-i18n-page') || currentPage;
            
            if (!key) return;
            
            const translated = t(key, page);
            
            // Prüfe ob es ein Attribut-Suffix gibt (z.B. data-i18n="placeholder:filter.search")
            if (key.includes(':')) {
                const [attr, actualKey] = key.split(':');
                const attrValue = t(actualKey, page);
                el.setAttribute(attr, attrValue);
            } else {
                // Nur ersetzen wenn es eine echte Übersetzung ist (nicht der Key selbst)
                if (translated !== key) {
                    el.textContent = translated;
                }
            }
        });
        
        // Spezielle Behandlung für Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translated = t(key, '_global');
            if (translated !== key) {
                el.setAttribute('placeholder', translated);
            }
        });

        // Spezielle Behandlung für Title-Attribute
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = t(key, '_global');
            if (translated !== key) {
                el.setAttribute('title', translated);
            }
        });

        // Spezielle Behandlung für aria-label Attribute
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const translated = t(key, '_global');
            if (translated !== key) {
                el.setAttribute('aria-label', translated);
            }
        });

        if (CONFIG.debug) {
            console.log('[i18n] Seite übersetzt:', elements.length, 'Elemente');
        }
    }

    // ========================================
    // LANGUAGE SWITCHING
    // ========================================
    
    /**
     * Wechselt die Sprache
     * @param {string} lang - Sprachcode (de, en, mp)
     * @param {boolean} reload - Seite neu laden (default: false)
     */
    function setLang(lang, reload = false) {
        lang = lang.toLowerCase();
        
        if (!CONFIG.supportedLangs.includes(lang)) {
            console.warn('[i18n] Nicht unterstützte Sprache:', lang);
            return;
        }
        
        currentLang = lang;
        
        // In localStorage speichern
        try { localStorage.setItem(CONFIG.storageKey, lang); } catch(e) {}
        
        // URL aktualisieren (ohne Reload)
        updateUrlParam(lang);
        
        if (reload) {
            window.location.reload();
        } else {
            // Seite dynamisch übersetzen
            translatePage();
            updateLangSelector();
            updateInternalLinks();
        }
        
        if (CONFIG.debug) {
            console.log('[i18n] Sprache gewechselt:', lang);
        }
    }

    function getLang() {
        return currentLang;
    }

    function updateUrlParam(lang) {
        const url = new URL(window.location.href);
        
        if (lang === CONFIG.defaultLang) {
            // Bei Default-Sprache Parameter entfernen
            url.searchParams.delete(CONFIG.urlParam);
        } else {
            url.searchParams.set(CONFIG.urlParam, lang);
        }
        
        // URL aktualisieren ohne Reload
        window.history.replaceState({}, '', url.toString());
    }

    /**
     * Aktualisiert die Sprachauswahl in der Navigation
     */
    function updateLangSelector() {
        const langLinks = document.querySelectorAll('.nav-lang a[data-lang]');
        
        langLinks.forEach(link => {
            const linkLang = link.getAttribute('data-lang');
            
            if (linkLang === currentLang) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /**
     * Initialisiert die Sprachauswahl-Links
     */
    function initLangSelector() {
        const langLinks = document.querySelectorAll('.nav-lang a[data-lang]');
        
        langLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const lang = this.getAttribute('data-lang');
                if (lang) {
                    setLang(lang);
                }
            });
        });
        
        updateLangSelector();
    }

    // ========================================
    // URL HELPER
    // ========================================
    
    /**
     * Erstellt eine URL mit aktuellem Sprachparameter
     * @param {string} baseUrl - Basis-URL
     * @param {object} additionalParams - Zusätzliche Parameter
     * @returns {string} URL mit lang-Parameter
     */
    function buildUrl(baseUrl, additionalParams = {}) {
        const url = new URL(baseUrl, window.location.origin);
        
        // Sprache nur hinzufügen wenn nicht Default
        if (currentLang !== CONFIG.defaultLang) {
            url.searchParams.set(CONFIG.urlParam, currentLang);
        }
        
        // Zusätzliche Parameter
        Object.entries(additionalParams).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, value);
            }
        });
        
        return url.pathname + url.search;
    }

    /**
     * Aktualisiert alle internen Links mit dem Sprachparameter
     */
    function updateInternalLinks() {
        if (currentLang === CONFIG.defaultLang) return; // Kein Parameter nötig
        
        // Erfasse alle Links die auf interne Seiten verweisen
        const allLinks = document.querySelectorAll('a[href]');
        
        allLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('http://') || href.startsWith('https://')) {
                // Externe Links oder Anker überspringen
                // Aber lokale absolute URLs (http://localhost:8080/...) sollten aktualisiert werden
                if (href && (href.startsWith('http://localhost') || href.startsWith('https://localhost'))) {
                    // Lokale absolute URL - behandeln
                } else {
                    return;
                }
            }
            
            // Nur interne HTML-Seiten aktualisieren
            const isInternalPage = href.includes('index') || 
                                   href.includes('fundkarte') || 
                                   href.includes('steinzelt') || 
                                   href.includes('panorama');
            
            if (!isInternalPage) return;
            
            try {
                const url = new URL(href, window.location.origin);
                if (!url.searchParams.has(CONFIG.urlParam)) {
                    url.searchParams.set(CONFIG.urlParam, currentLang);
                    link.setAttribute('href', url.pathname + url.search);
                }
            } catch(e) {
                if (CONFIG.debug) console.warn('[i18n] Link-Update fehlgeschlagen:', href, e);
            }
        });
        
        if (CONFIG.debug) {
            console.log('[i18n] Interne Links aktualisiert für Sprache:', currentLang);
        }
    }

    // ========================================
    // CALLBACKS
    // ========================================
    
    /**
     * Registriert einen Callback für wenn Übersetzungen geladen sind
     * @param {function} callback 
     */
    function onReady(callback) {
        if (isLoaded) {
            try { callback(); } catch(e) { console.error('[i18n] Callback-Fehler:', e); }
        } else {
            readyCallbacks.push(callback);
        }
    }

    // ========================================
    // AUTO-INIT
    // ========================================
    
    // Initialisiere wenn DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================================
    // PUBLIC API
    // ========================================
    
    return {
        init: init,
        t: t,
        setLang: setLang,
        getLang: getLang,
        translatePage: translatePage,
        updateLangSelector: updateLangSelector,
        initLangSelector: initLangSelector,
        updateInternalLinks: updateInternalLinks,
        buildUrl: buildUrl,
        onReady: onReady,
        isLoaded: function() { return isLoaded; },
        getTranslations: function() { return translations; }
    };
})();

