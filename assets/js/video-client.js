/* Client-side fallback for video.html (served statically from Cloudflare CDN — 0 Vercel Origin bytes!) */
(function () {
    'use strict';

    function isSafeUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            var u = new URL(url);
            return u.protocol === 'https:' || u.protocol === 'http:';
        } catch (e) {
            return false;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function cleanTitle(text) {
        if (!text || typeof text !== 'string') return text || '';
        return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    var KNOWN_CATEGORIES = new Set([
        '60-fps','ai','amateur','american','anal','asian','asmr','babe','bbw','bdsm','big-ass',
        'big-dick','big-tits','bisexual','blonde','blowjob','bondage','british','brunette','bukkake',
        'casting','compilation','cosplay','couple','creampie','cuckold','cumshot','czech','dance',
        'doctor','double-penetration','ebony','european','fat','fetish','fisting','footjob','for-women',
        'french','german','gloryhole','group-sex','handjob','hardcore','hd-porn-1080p','hd-sex','hentai',
        'homemade','hotel','hotwife','housewives','hq-porn','indian','indonesia','interracial','italian',
        'japanese','latina','lesbian','lingerie','live-cam','massage','masturbation','mature','milf',
        'nurses','office','older-men','orgy','outdoor','pawg','petite','pinay','pornstar','pov',
        'pregnant','public','redhead','romantic','russian','shemale','sleep','small-tits','spanish',
        'squirt','stepmom','stepsister','striptease','swinger','threesome','toys','uniform','vintage',
        'vr-porn','webcam'
    ]);

    function showError(msg) {
        var robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) robotsMeta.setAttribute('content', 'noindex, follow');
        document.title = 'Video unavailable — kumpulenak';
        var container = document.getElementById('videoContainer');
        if (!container) return;
        container.innerHTML =
            '<div class="error-state">' +
            '<h2>Video Unavailable</h2>' +
            '<p>' + escapeHtml(msg) + '</p>' +
            '<a href="/" class="back-btn">← Back to Home</a>' +
            '</div>';
    }

    function renderVideo(video) {
        var container = document.getElementById('videoContainer');
        if (!container) return;
        if (!video.embed || !isSafeUrl(video.embed)) {
            showError('This video does not provide a valid streaming player.');
            return;
        }
        var title = cleanTitle(video.title || 'Untitled Video');
        var tagsHtml = '';
        if (video.keywords) {
            var arr = typeof video.keywords === 'string'
                ? video.keywords.split(',').map(function (t) { return t.trim(); })
                : video.keywords;
            tagsHtml = arr.filter(Boolean).map(function (tag) {
                var slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                if (KNOWN_CATEGORIES.has(slug)) {
                    return '<a href="/category/' + slug + '" class="video-tag">' + escapeHtml(tag) + '</a>';
                }
                return '<span class="video-tag video-tag-btn" onclick="window.location.href=\'/?q=' + encodeURIComponent(tag) + '\'">' + escapeHtml(tag) + '</span>';
            }).join(' ');
        }
        container.innerHTML =
            '<a href="/" class="back-btn">← Back to Home</a>' +
            '<div class="video-wrapper"><iframe id="videoPlayer" src="' + escapeHtml(video.embed) + '" width="1280" height="720" frameborder="0" allowfullscreen="true" scrolling="no" title="' + escapeHtml(title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>' +
            '<div class="video-details">' +
            '<h1 class="video-title">' + escapeHtml(title) + '</h1>' +
            '<div class="video-meta">' +
            '<span>⏱ ' + escapeHtml(video.length_min || '0:00') + '</span>' +
            '<span>👁 ' + escapeHtml(video.views ? Number(video.views).toLocaleString('en-US') : '0') + ' views</span>' +
            '<span>⭐ ' + escapeHtml(String(video.rate || '4.5')) + ' rating</span>' +
            '</div>' +
            (tagsHtml ? '<div class="video-tags">' + tagsHtml + '</div>' : '') +
            '</div>';
    }

    // If SSR already rendered #videoPlayer, skip all client API fetches (saves bandwidth & CPU)
    if (document.getElementById('videoPlayer')) return;

    var urlParams = new URLSearchParams(window.location.search);
    var videoId = urlParams.get('id') || urlParams.get('v');
    if (!videoId) {
        var parts = window.location.pathname.split('/').filter(Boolean);
        var last = (parts[parts.length - 1] || '').replace('.html', '');
        if (last && last !== 'v' && last !== 'video') videoId = last;
    }
    if (videoId && videoId.indexOf('-') !== -1) videoId = videoId.split('-')[0];
    if (!videoId) {
        showError('Video ID was not found in the URL.');
        return;
    }

    fetch('https://www.eporner.com/api/v2/video/id/?id=' + encodeURIComponent(videoId) + '&format=json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) {
            if (!data || data.error || (Array.isArray(data) && data.length === 0)) {
                showError('This video was not found or has been removed.');
                return;
            }
            renderVideo(data);
        })
        .catch(function () {
            showError('Failed to load video data. Please try again later.');
        });
})();
