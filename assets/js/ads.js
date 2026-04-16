/**
 * =============================================
 *  ADS.JS — Script Iklan Eksternal
 * =============================================
 *  File ini khusus memuat jenis iklan script:
 *  1. Popunder Ads (script eksternal)
 *  2. Social Bar Ads (script eksternal)
 *
 *  Catatan: Iklan Banner ditempatkan langsung
 *  di index.html agar Adsterra script bekerja normal
 *  dan tidak bentrok satu sama lain.
 * =============================================
 */

(function () {
    'use strict';

    // ==========================================
    //  DAFTAR SCRIPT POPUNDER
    // ==========================================
    const POPUNDER_SCRIPTS = [
        'https://pl28946621.profitablecpmratenetwork.com/26/f3/43/26f3431d773087c3b794dc01acff540f.js'
    ];

    // ==========================================
    //  DAFTAR SCRIPT SOCIAL BAR
    // ==========================================
    const SOCIALBAR_SCRIPTS = [
        'https://pl28946633.profitablecpmratenetwork.com/03/8e/5d/038e5d0c9a177bcd903ad960773ffd1f.js'
        // Tambahkan social bar baru di sini:
        // 'https://example.com/socialbar2.js',
    ];

    // ==========================================
    //  FUNGSI: Muat Script Eksternal (async)
    // ==========================================
    function loadScripts(scriptUrls) {
        scriptUrls.forEach(function (url) {
            if (!url || url.trim() === '') return;
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.setAttribute('data-cfasync', 'false');
            document.body.appendChild(s);
        });
    }

    // ==========================================
    //  INIT — Muat popunder & social bar
    // ==========================================
    function initAds() {
        loadScripts(POPUNDER_SCRIPTS);
        loadScripts(SOCIALBAR_SCRIPTS);
    }

    if (document.readyState === 'complete') {
        initAds();
    } else {
        window.addEventListener('load', initAds);
    }
})();
