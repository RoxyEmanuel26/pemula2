/**
 * =============================================
 *  ANALYTICS.JS — Google Analytics 4 Tracker
 * =============================================
 * Skrip ini bertanggung jawab untuk melacak pageviews dan custom events.
 */

(function () {
    'use strict';

    // Ganti 'G-XXXXXXXXXX' dengan Measurement ID Google Analytics 4 milik Anda.
    var GA_MEASUREMENT_ID = 'G-CBJ8CPF3PX'; 

    // Injeksi skrip gtag.js
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    // Inisialisasi dataLayer
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag; // Ekspor ke global scope

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
        // Opsi konfigurasi tambahan bisa ditaruh di sini
        'send_page_view': true
    });

    // Custom Event Listeners
    document.addEventListener('DOMContentLoaded', function() {
        // Melacak klik tombol popunder/play
        document.addEventListener('click', function(e) {
            if (!e.isTrusted) return;
            
            var target = e.target;
            
            // Lacak klik Play/Video Overlay
            if (target.closest('.player-overlay') || target.closest('.video-wrapper')) {
                gtag('event', 'video_play_click', {
                    'event_category': 'Engagement',
                    'event_label': window.location.pathname + window.location.search
                });
            }

            // Lacak klik tag pencarian/kategori
            if (target.closest('a.keyword-btn') || target.closest('.category-card')) {
                var btn = target.closest('a.keyword-btn') || target.closest('.category-card');
                gtag('event', 'category_click', {
                    'event_category': 'Navigation',
                    'event_label': btn.textContent.trim()
                });
            }
        });
    });

})();
