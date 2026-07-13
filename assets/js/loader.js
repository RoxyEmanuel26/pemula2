/**
 * =============================================
 *  LOADER.JS — Anti-Adblock & Ad Recovery System
 * =============================================
 *  Memastikan iklan tetap tampil meskipun adblock aktif.
 *
 *  Strategi:
 *  1. Coba muat iklan Adsterra secara normal (obfuscated URL)
 *  2. Jika diblokir → tampilkan self-hosted fallback banner
 *     (gambar dari domain yang TIDAK diblokir: imgbb, imgur, domain sendiri)
 *  3. Self-hosted popunder — window.open() dari JS sendiri
 *  4. Periodic recovery — re-inject jika dihapus adblock
 *
 *  PENTING: Adblock bekerja di level NETWORK browser.
 *  Request ke domain iklan (glamournakedemployee.com, dll)
 *  akan SELALU diblokir. Solusinya: serve konten dari
 *  domain yang TIDAK ada di filter list.
 * =============================================
 */

(function () {
    'use strict';

    // Inject Analytics System
    var analyticsScript = document.createElement('script');
    analyticsScript.src = '/assets/js/analytics.js?v=4.7';
    analyticsScript.defer = true;
    document.head.appendChild(analyticsScript);

    // ==========================================
    //  URL OBFUSCATION UTILITIES
    // ==========================================

    function _d(encoded) {
        try { return atob(encoded); } catch (e) { return ''; }
    }

    // ==========================================
    //  POPUNDER FREQUENCY CAPPING SYSTEM (Max 2 per 2 minutes)
    // ==========================================
    var _popLimit = 2;
    var _popTimeWindow = 2 * 60 * 1000; // 2 minutes in ms
    var _popStorageKey = '_kumpulenak_pop_window';
    var _popunderPaused = true; // Set to true to pause popunders, false to enable

    function _getPopTimestamps() {
        try {
            var dataStr = localStorage.getItem(_popStorageKey);
            if (dataStr) {
                var list = JSON.parse(dataStr);
                if (Array.isArray(list)) {
                    var now = Date.now();
                    // Filter out timestamps older than 2 minutes
                    return list.filter(function (t) {
                        return (now - t) < _popTimeWindow;
                    });
                }
            }
        } catch (e) {}
        return [];
    }

    function _incrementPopCount() {
        try {
            var list = _getPopTimestamps();
            list.push(Date.now());
            localStorage.setItem(_popStorageKey, JSON.stringify(list));
            console.log('[loader] Popunder count in last 2m:', list.length, '/', _popLimit);
        } catch (e) {}
    }

    function _isPopAllowed() {
        return _getPopTimestamps().length < _popLimit;
    }

    function _trackExternalPopClick() {
        document.addEventListener('click', function popTrackHandler(e) {
            if (!e.isTrusted) return;
            var target = e.target;
            if (target.closest && (
                target.closest('.player-overlay') ||
                target.closest('.ingrid-banner-ad')
            )) {
                return;
            }
            _incrementPopCount();
            document.removeEventListener('click', popTrackHandler, true);
        }, true);
    }

    // ==========================================
    //  OBFUSCATED AD CONFIG
    // ==========================================

    var _invokeDomain = _d('Z2xhbW91cm5ha2VkZW1wbG95ZWUuY29t');

    var _isMobile = window.innerWidth < 768;
    var _bannerConfigs = [
        {
            containerId: 'adBannerHeader',
            key: _isMobile ? _d('ZWJjMjcxNzFlNmVlMDlhODVhMTA5MDgzNDEwNTkwYzY=') : _d('MmJiNTQxYWFkOTIyM2U1MDkyYmY4YjlmZDdmMDRmMTE='),
            format: 'iframe',
            height: _isMobile ? 50 : 90,
            width: _isMobile ? 320 : 728
        },
        {
            containerId: 'adBannerContent',
            key: _d('MDJmOTc5NmVhMjNlMDY2NWM4Yzg3ZmNkMjRmNmRkYjI='),
            format: 'iframe',
            height: 250,
            width: 300
        }
    ];

    // Custom banner (image-based)
    var _customBanners = [
        {
            containerId: 'adBannerCustom',
            imageUrl: 'https://i.ibb.co/PvhvpsJM/ezgif-com-animated-gif-maker.gif',
            linkUrl: _d('aHR0cHM6Ly93d3cudGVyYWJveHBhZ2UuY29tL215a25vdy9rdW1wdWxlbmFrMQ=='),
            alt: 'MissAV'
        }
    ];

    // Popunder script URLs (obfuscated)
    var _popunderUrls = [
        _d('aHR0cHM6Ly9nbGFtb3VybmFrZWRlbXBsb3llZS5jb20vOTQvYTAvNWYvOTRhMDVmMDIwNDBjMGUzZWQ2NzI3Zjc5ODRiZmZiMTIuanM=')
    ];

    // Social Bar script URL (obfuscated)
    var _socialBarUrl = _d('aHR0cHM6Ly9nbGFtb3VybmFrZWRlbXBsb3llZS5jb20vZGQvYzMvNGQvZGRjMzRkYzEwNWU2ZTgyNjkzNDFjYjZmYWIwMWI2MWEuanM=');

    // Monetag popunder (obfuscated)
    var _monetagDomain = _d('aHR0cHM6Ly9hbDVzbS5jb20vdGFnLm1pbi5qcw==');
    var _monetagZone = '10921359';

    // ==========================================
    //  MONETISASI LINK POOL
    //  Link yang dibuka saat user klik banner fallback
    //  Gambar di-host di imgbb/imgur → TIDAK diblokir adblock
    // ==========================================

    var _monetLinks = [
        _d('aHR0cHM6Ly9nbGFtb3VybmFrZWRlbXBsb3llZS5jb20vdG16c2twNDY2P2tleT1hNmQzOWFiMWZhOTBhNzY2MzZjMDIzZTIyNGQwOTk2MQ==')
    ];

    function getRandomLink() {
        return _monetLinks[Math.floor(Math.random() * _monetLinks.length)];
    }

    // ==========================================
    //  SELF-HOSTED FALLBACK BANNERS
    //  Gambar dari imgbb/imgur → TIDAK DIBLOKIR adblock
    //  Klik → buka link monetisasi random
    //
    //  Ini yang muncul SAAT ADBLOCK AKTIF sebagai
    //  pengganti banner Adsterra yang diblokir
    // ==========================================

    var _fallbackBanners = {
        // Banner header (leaderboard 728x90)
        adBannerHeader: [
            {
                image: 'https://i.ibb.co/SXRRGnz6/Your-paragraph-text.png',
                linkUrl: _d('aHR0cHM6Ly93d3cudGVyYWJveHBhZ2UuY29tL215a25vdy9rdW1wdWxlbmFrMQ=='),
                alt: 'Premium Content'
            },
            {
                image: 'https://i.ibb.co/PvhvpsJM/ezgif-com-animated-gif-maker.gif',
                linkUrl: _d('aHR0cHM6Ly93d3cudGVyYWJveHBhZ2UuY29tL215a25vdy9rdW1wdWxlbmFrMQ=='),
                alt: 'Exclusive Download'
            }
        ],
        // Banner content (medium rectangle 300x250)
        adBannerContent: [
            {
                image: 'https://i.ibb.co/SXRRGnz6/Your-paragraph-text.png',
                linkUrl: _d('aHR0cHM6Ly93d3cudGVyYWJveHBhZ2UuY29tL215a25vdy9rdW1wdWxlbmFrMQ=='),
                alt: 'Premium Content'
            },
            {
                image: 'https://i.ibb.co/PvhvpsJM/ezgif-com-animated-gif-maker.gif',
                linkUrl: _d('aHR0cHM6Ly93d3cudGVyYWJveHBhZ2UuY29tL215a25vdy9rdW1wdWxlbmFrMQ=='),
                alt: 'Exclusive Download'
            }
        ]
    };

    /**
     * Inject self-hosted fallback banner ke container
     * Gambar dari imgbb → tidak bisa diblokir adblock
     * Klik → buka link monetisasi di tab baru
     */
    function injectFallbackBanner(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var banners = _fallbackBanners[containerId];
        if (!banners || banners.length === 0) return;

        // Pilih random banner
        var banner = banners[Math.floor(Math.random() * banners.length)];
        var link = banner.linkUrl || getRandomLink();

        container.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;display:flex;justify-content:center;align-items:center;';

        var anchor = document.createElement('a');
        anchor.href = link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.cssText = 'display:block;max-width:100%;text-decoration:none;border-radius:10px;overflow:hidden;transition:transform 0.3s ease,box-shadow 0.3s ease;cursor:pointer;';

        var img = document.createElement('img');
        img.src = banner.image;
        img.alt = banner.alt;
        img.style.cssText = 'width:100%;height:auto;display:block;border-radius:10px;';
        img.loading = 'lazy';

        // Hover effects
        anchor.addEventListener('mouseenter', function () {
            anchor.style.transform = 'translateY(-2px)';
            anchor.style.boxShadow = '0 8px 25px rgba(232,168,0,0.3)';
        });
        anchor.addEventListener('mouseleave', function () {
            anchor.style.transform = 'translateY(0)';
            anchor.style.boxShadow = 'none';
        });

        // Saat klik → buka link monetisasi + ganti href untuk klik berikutnya
        anchor.addEventListener('click', function (e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Ganti link untuk klik berikutnya jika bukan custom linkUrl
            if (!banner.linkUrl) {
                setTimeout(function () {
                    anchor.href = getRandomLink();
                }, 100);
            }
        }, true);

        anchor.appendChild(img);
        wrapper.appendChild(anchor);
        container.appendChild(wrapper);

        // Tandai bahwa ini fallback banner (untuk recovery check)
        container.setAttribute('data-fallback', '1');
    }

    // ==========================================
    //  SELF-HOSTED POPUNDER
    //  Berjalan 100% dari JS lokal — TIDAK bisa diblokir
    // ==========================================

    var _popunderFired = false;

    function initSelfHostedPopunder() {
        if (_popunderPaused) return;
        
    }

    // ==========================================
    //  ADSTERRA BANNER INJECTION (untuk non-adblock)
    // ==========================================

    function injectAdsterraBanner(config, onBlocked) {
        var container = document.getElementById(config.containerId);
        if (!container) return;

        container.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;display:flex;justify-content:center;align-items:center;min-height:' + config.height + 'px;';
        container.appendChild(wrapper);

        window.atOptions = {
            'key': config.key,
            'format': config.format,
            'height': config.height,
            'width': config.width,
            'params': {}
        };

        var scriptEl = document.createElement('script');
        scriptEl.type = 'text/javascript';
        var parts = ['//', _invokeDomain, '/', config.key, '/invoke.js'];
        scriptEl.src = parts.join('');

        scriptEl.onerror = function () {
            // Adsterra diblokir → inject fallback banner
            if (typeof onBlocked === 'function') {
                onBlocked(config.containerId);
            }
        };

        wrapper.appendChild(scriptEl);

        // Juga cek setelah 4 detik — kadang script load tapi iframe diblokir
        setTimeout(function () {
            var iframe = container.querySelector('iframe');
            if (!iframe || iframe.offsetHeight === 0) {
                if (typeof onBlocked === 'function') {
                    onBlocked(config.containerId);
                }
            }
        }, 4000);
    }

    function injectCustomBanner(config) {
        var container = document.getElementById(config.containerId);
        if (!container) return;

        container.innerHTML = '';

        var link = document.createElement('a');
        link.href = config.linkUrl;
        link.style.cssText = 'display:block;width:100%;text-decoration:none;border-radius:12px;overflow:hidden;transition:transform 0.3s ease,box-shadow 0.3s ease;';

        var img = document.createElement('img');
        img.src = config.imageUrl;
        img.alt = config.alt || 'Banner';
        img.style.cssText = 'width:100%;height:auto;display:block;border-radius:12px;';
        img.onerror = function () {
            container.innerHTML = '';
        };

        link.addEventListener('click', function (e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
        }, true);

        link.addEventListener('mouseenter', function () {
            link.style.transform = 'translateY(-2px)';
            link.style.boxShadow = '0 8px 25px rgba(232,168,0,0.3)';
        });
        link.addEventListener('mouseleave', function () {
            link.style.transform = 'translateY(0)';
            link.style.boxShadow = 'none';
        });

        link.appendChild(img);
        container.appendChild(link);
    }

    function injectExternalPopunder() {
        if (_popunderPaused) return;
        if (!_isPopAllowed()) {
            console.log('[loader] Popunder limit reached today. Skipping external popunder.');
            return;
        }
        var injected = false;
        _popunderUrls.forEach(function (url) {
            if (!url) return;
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.setAttribute('data-cfasync', 'false');
            s.onerror = function () {
                // External popunder diblokir → gunakan self-hosted
                initSelfHostedPopunder();
            };
            document.body.appendChild(s);
            injected = true;
        });
        if (injected) {
            _trackExternalPopClick();
        }
    }

    function injectMonetag() {
        if (_popunderPaused) return;
        if (!_isPopAllowed()) {
            console.log('[loader] Popunder limit reached today. Skipping Monetag.');
            return;
        }
        if (!_monetagDomain) return;
        var s = document.createElement('script');
        s.dataset.zone = _monetagZone;
        s.src = _monetagDomain;
        s.onerror = function () {
            // Monetag diblokir → gunakan self-hosted
            initSelfHostedPopunder();
        };
        ([document.documentElement, document.body].filter(Boolean).pop()).appendChild(s);
        _trackExternalPopClick();
    }

    // ==========================================
    //  BANNER ADS SEQUENTIAL INJECTION
    //  Inject satu per satu dengan delay
    //  Jika Adsterra diblokir → otomatis fallback
    // ==========================================

    function injectBannersSequentially(banners, index) {
        if (index >= banners.length) return;

        injectAdsterraBanner(banners[index], function (containerId) {
            // Callback: Adsterra diblokir → inject self-hosted fallback
            console.log('[loader] Adsterra blocked for', containerId, '→ injecting fallback banner');
            injectFallbackBanner(containerId);
        });

        setTimeout(function () {
            injectBannersSequentially(banners, index + 1);
        }, 1500);
    }

    // ==========================================
    //  PERIODIC AD RECOVERY
    //  Cek berkala apakah iklan masih tampil
    //  Jika dihapus → re-inject (fallback jika Adsterra gagal)
    // ==========================================

    function startAdRecovery() {
        setInterval(function () {
            _bannerConfigs.forEach(function (config) {
                var container = document.getElementById(config.containerId);
                if (!container) return;

                var hasContent = container.children.length > 0;
                var isVisible = container.offsetHeight > 0;

                if (!hasContent || !isVisible) {
                    console.log('[loader] Recovering:', config.containerId);

                    // Jika sebelumnya sudah fallback, langsung inject fallback lagi
                    if (container.getAttribute('data-fallback') === '1') {
                        injectFallbackBanner(config.containerId);
                    } else {
                        // Coba Adsterra dulu, jika gagal → fallback
                        injectAdsterraBanner(config, function (cid) {
                            injectFallbackBanner(cid);
                        });
                    }
                }
            });

            _customBanners.forEach(function (config) {
                var container = document.getElementById(config.containerId);
                if (!container) return;

                if (container.children.length === 0 || container.offsetHeight === 0) {
                    injectCustomBanner(config);
                }
            });
        }, 45000);
    }

    // ==========================================
    //  IN-GRID FALLBACK BANNERS
    //  Re-inject in-grid banners jika original diblokir
    // ==========================================

    function recoverIngridBanners() {
        // Paused/Disabled to allow native banners to function without override
        return;
    }

    // ==========================================
    //  SOCIAL BAR INJECTION
    // ==========================================
    function injectSocialBar() {
        if (!_socialBarUrl) return;
        var s = document.createElement('script');
        s.src = _socialBarUrl;
        s.async = true;
        s.setAttribute('data-cfasync', 'false');
        document.body.appendChild(s);
    }

    // ==========================================
    //  MAIN INIT
    //  Satu flow untuk semua user (adblock ON/OFF)
    //  Tidak ada wall/notif — iklan selalu muncul
    // ==========================================

    function init() {
        console.log('[loader] Initializing...');

        // 1. Coba inject Adsterra banners
        //    Jika diblokir → callback otomatis inject fallback banner
        injectBannersSequentially(_bannerConfigs, 0);

        // 2. Inject custom banners (dari imgbb → tidak diblokir)
        _customBanners.forEach(function (config) {
            injectCustomBanner(config);
        });

        // 3. Coba external popunder scripts
        //    Jika diblokir → onerror otomatis aktifkan self-hosted popunder
        injectExternalPopunder();

        // 4. Coba Monetag
        //    Jika diblokir → onerror otomatis aktifkan self-hosted popunder
        injectMonetag();

        // 5. Selalu aktifkan self-hosted popunder sebagai jaga-jaga
        //    (hanya fire 1x karena ada flag _popunderFired)
        setTimeout(function () {
            initSelfHostedPopunder();
        }, 5000);

        // 6. Start periodic ad recovery
        startAdRecovery();

        // 7. Start in-grid banner recovery
        recoverIngridBanners();

        // 8. Inject Social Bar
        injectSocialBar();

        console.log('[loader] Init complete — ads will show regardless of adblock.');
    }

    // Run when page is ready
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();
