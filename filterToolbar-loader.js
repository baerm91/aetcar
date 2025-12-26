/**
 * Filter Toolbar Loader
 * Loads shared filter toolbar partials into placeholder elements.
 * Similar to nav-loader.js but for the filter toolbar.
 * 
 * Usage:
 * 1. Add <div id="filterFacetsPartial"></div> where you want facet dropdowns (Material, Typ, Zustand, Schlagworte)
 * 2. Add <div id="filterToolbarPartial"></div> where you want shared elements (Count, Search, Reset)
 * 3. Include this script after the placeholders
 * 4. Add page-specific view options before/between the placeholders in the HTML
 */
(function () {
    'use strict';

    function loadPartial(placeholderId, partialPath) {
        var placeholder = document.getElementById(placeholderId);
        if (!placeholder) {
            return false;
        }

        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', partialPath + '?v=' + new Date().getTime(), false);
            xhr.send(null);

            if (xhr.status >= 200 && xhr.status < 300) {
                placeholder.outerHTML = xhr.responseText;
                return true;
            } else {
                console.error('FilterToolbar: Failed to load ' + partialPath + ', status:', xhr.status);
            }
        } catch (e) {
            console.error('FilterToolbar: Error loading ' + partialPath + ':', e);
        }
        return false;
    }

    function applyUrlParams() {
        var urlParams = new URLSearchParams(window.location.search);
        
        // Search parameter
        var searchParam = urlParams.get('search');
        var searchInput = document.getElementById('toolbarSearch');
        if (searchParam && searchInput) {
            searchInput.value = searchParam;
        }
    }

    // Load partials
    loadPartial('filterFacetsPartial', 'partials/filterFacets.html');
    loadPartial('filterToolbarPartial', 'partials/filterToolbar.html');
    
    // Apply URL parameters to search field
    applyUrlParams();
})();
