(function () {
    function getCurrentPage() {
        try {
            var path = window.location.pathname || '';
            var page = path.split('/').pop();
            if (!page) {
                page = 'index.html';
            }
            return page;
        } catch (e) {
            return 'index.html';
        }
    }

    function setActiveNavLink(page) {
        var links = document.querySelectorAll('.top-nav .nav-link[href]');
        if (!links || links.length === 0) return;

        links.forEach(function (link) {
            link.classList.remove('active');
        });

        links.forEach(function (link) {
            var href = link.getAttribute('href') || '';
            var hrefPage = href.split('?')[0].split('#')[0].split('/').pop();
            if (!hrefPage) return;
            if (hrefPage === page) {
                link.classList.add('active');
            }
        });
    }

    function configureNavForPage(page) {
        var globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            // If on a page with search params, sync the input
            var urlParams = new URLSearchParams(window.location.search);
            var searchParam = urlParams.get('search');
            if (searchParam) {
                globalSearch.value = searchParam;
            }

            globalSearch.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    var term = globalSearch.value.trim();
                    if (term) {
                        // Redirect to fundkarte.html with search parameter for now
                        // This serves as the central search entry point
                        var url = 'fundkarte.html?search=' + encodeURIComponent(term);
                        // Sprache beibehalten wenn I18n verfügbar
                        if (window.I18n && window.I18n.getLang() !== 'de') {
                            url += '&lang=' + window.I18n.getLang();
                        }
                        window.location.href = url;
                    }
                }
            });
        }
    }

    function initNavLight() {
        var navLinks = document.querySelectorAll('.nav-link');
        var navLight = document.getElementById('navLight');
        var topNav = document.querySelector('.top-nav');

        if (!navLight || !topNav || navLinks.length === 0) return;

        // Funktion um das Licht zu positionieren
        function moveLight(target) {
            if (!target) return;

            // Berechne Position relativ zum Container
            var rect = target.getBoundingClientRect();
            var navRect = topNav.getBoundingClientRect();
            
            // Die Mitte des Ziel-Elements berechnen
            var center = rect.left - navRect.left + (rect.width / 2);

            // Breite des Lichts: etwas breiter als den Text für den Fade-Out
            var lightWidth = rect.width + 60;

            // Styles anwenden
            navLight.style.width = lightWidth + 'px';
            navLight.style.left = center + 'px';
            navLight.style.opacity = '1';
        }

        // Aktives Element finden
        var activeItem = document.querySelector('.nav-link.active');

        // Initialisierung: Licht zum aktiven Element bewegen
        if (activeItem) {
            moveLight(activeItem);
        }

        // Event Listener für Hover
        navLinks.forEach(function(link) {
            link.addEventListener('mouseenter', function(e) {
                moveLight(e.target);
            });
        });

        // Wenn die Maus die Navigation verlässt, zurück zum aktiven Element
        var navLinksContainer = document.querySelector('.nav-links');
        if (navLinksContainer) {
            navLinksContainer.addEventListener('mouseleave', function() {
                activeItem = document.querySelector('.nav-link.active');
                if (activeItem) {
                    moveLight(activeItem);
                } else {
                    navLight.style.opacity = '0';
                }
            });
        }

        // Resize Handler
        window.addEventListener('resize', function() {
            activeItem = document.querySelector('.nav-link.active');
            if (activeItem) {
                moveLight(activeItem);
            }
        });
    }

    /**
     * Initialisiert die Sprachauswahl
     */
    function initLanguageSelector() {
        var langLinks = document.querySelectorAll('.nav-lang a[data-lang]');
        if (!langLinks || langLinks.length === 0) return;

        // Aktuelle Sprache ermitteln (aus URL oder localStorage)
        var currentLang = 'de';
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var urlLang = urlParams.get('lang');
            if (urlLang && ['de', 'en', 'mp'].indexOf(urlLang.toLowerCase()) !== -1) {
                currentLang = urlLang.toLowerCase();
            } else {
                var storedLang = localStorage.getItem('aetcar_lang');
                if (storedLang && ['de', 'en', 'mp'].indexOf(storedLang) !== -1) {
                    currentLang = storedLang;
                }
            }
        } catch(e) {}

        // Aktive Klasse setzen
        langLinks.forEach(function(link) {
            var lang = link.getAttribute('data-lang');
            if (lang === currentLang) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Click-Handler für Sprachwechsel
        langLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var newLang = this.getAttribute('data-lang');
                if (!newLang) return;

                // Wenn I18n-Modul geladen ist, nutze es
                if (window.I18n && typeof window.I18n.setLang === 'function') {
                    window.I18n.setLang(newLang);
                } else {
                    // Fallback: Seite mit neuem lang-Parameter neu laden
                    try { localStorage.setItem('aetcar_lang', newLang); } catch(e) {}
                    
                    var url = new URL(window.location.href);
                    if (newLang === 'de') {
                        url.searchParams.delete('lang');
                    } else {
                        url.searchParams.set('lang', newLang);
                    }
                    window.location.href = url.toString();
                }

                // Aktive Klasse aktualisieren
                langLinks.forEach(function(l) {
                    l.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
    }

    /**
     * Aktualisiert alle internen Links mit dem aktuellen Sprach-Parameter
     */
    function updateNavLinksWithLang() {
        var currentLang = 'de';
        try {
            // Verwende I18n-Modul wenn verfügbar, sonst Fallback
            if (window.I18n && typeof window.I18n.getLang === 'function') {
                currentLang = window.I18n.getLang();
            } else {
                var urlParams = new URLSearchParams(window.location.search);
                var urlLang = urlParams.get('lang');
                if (urlLang) {
                    currentLang = urlLang.toLowerCase();
                } else {
                    var storedLang = localStorage.getItem('aetcar_lang');
                    if (storedLang) {
                        currentLang = storedLang;
                    }
                }
            }
        } catch(e) {}

        var navLinks = document.querySelectorAll('.nav-link[href], .nav-brand[href]');
        navLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            
            try {
                // Bestehende Parameter parsen
                var parts = href.split('?');
                var basePath = parts[0];
                var params = new URLSearchParams(parts[1] || '');
                
                // Immer aktualisieren: Parameter setzen oder entfernen je nach aktueller Sprache
                if (currentLang === 'de') {
                    // Bei Default-Sprache Parameter entfernen
                    params.delete('lang');
                } else {
                    // Bei nicht-Default-Sprache Parameter setzen/aktualisieren
                    params.set('lang', currentLang);
                }
                
                var newHref = basePath;
                if (params.toString()) {
                    newHref += '?' + params.toString();
                }
                link.setAttribute('href', newHref);
            } catch(e) {}
        });
    }
    
    // Exportiere Funktion für I18n-Modul
    window.updateNavLinksWithLang = updateNavLinksWithLang;

    /**
     * Initialisiert das mobile Menü
     */
    function initMobileMenu() {
        var mobileToggle = document.getElementById('mobileMenuToggle');
        var navLinks = document.getElementById('navLinks');
        
        if (!mobileToggle || !navLinks) return;
        
        mobileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var isOpen = navLinks.classList.contains('mobile-open');
            
            if (isOpen) {
                navLinks.classList.remove('mobile-open');
                mobileToggle.textContent = '☰';
                mobileToggle.setAttribute('aria-expanded', 'false');
            } else {
                navLinks.classList.add('mobile-open');
                mobileToggle.textContent = '✕';
                mobileToggle.setAttribute('aria-expanded', 'true');
            }
        });
        
        // Schließe Menü wenn außerhalb geklickt wird
        document.addEventListener('click', function(e) {
            if (navLinks.classList.contains('mobile-open') && 
                !navLinks.contains(e.target) && 
                !mobileToggle.contains(e.target)) {
                navLinks.classList.remove('mobile-open');
                mobileToggle.textContent = '☰';
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Schließe Menü wenn Link geklickt wird
        var navItems = navLinks.querySelectorAll('.nav-link');
        navItems.forEach(function(item) {
            item.addEventListener('click', function() {
                navLinks.classList.remove('mobile-open');
                mobileToggle.textContent = '☰';
                mobileToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    function initializeNav() {
        var page = getCurrentPage();
        setActiveNavLink(page);
        configureNavForPage(page);
        initNavLight();
        initLanguageSelector();
        initMobileMenu();
        updateNavLinksWithLang();
        
        // Wenn I18n geladen ist, Navigation übersetzen und Links aktualisieren
        if (window.I18n && typeof window.I18n.translatePage === 'function') {
            window.I18n.translatePage();
            // Warte kurz, damit I18n vollständig initialisiert ist
            setTimeout(function() {
                updateNavLinksWithLang();
                initNavLight(); // Re-initialize nav light after translations
            }, 100);
        } else {
            // Wenn I18n noch nicht geladen ist, warte darauf
            var checkI18n = setInterval(function() {
                if (window.I18n && typeof window.I18n.translatePage === 'function') {
                    clearInterval(checkI18n);
                    window.I18n.translatePage();
                    setTimeout(function() {
                        updateNavLinksWithLang();
                        initNavLight(); // Re-initialize nav light after translations
                    }, 100);
                }
            }, 50);
            // Stoppe nach 5 Sekunden
            setTimeout(function() {
                clearInterval(checkI18n);
            }, 5000);
        }
    }

    function loadPartialIntoPlaceholder() {
        var placeholder = document.getElementById('site-nav');
        if (!placeholder) return;

        fetch('partials/nav.html?v=' + new Date().getTime())
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(function(html) {
                placeholder.outerHTML = html;
                initializeNav();
            })
            .catch(function(e) {
                console.error('Failed to load navigation:', e);
            });
    }

    loadPartialIntoPlaceholder();
})();
