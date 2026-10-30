'use strict';

const fs = require('fs');
const path = require('path');

// Cache templates in memory across warm serverless invocations
let videoTemplate = null;
let notFoundTemplate = null;

function getTemplates() {
    if (!videoTemplate) {
        const videoPath = path.join(process.cwd(), 'video.html');
        videoTemplate = fs.existsSync(videoPath) ? fs.readFileSync(videoPath, 'utf8') : '';
    }
    if (!notFoundTemplate) {
        const notFoundPath = path.join(process.cwd(), '404.html');
        notFoundTemplate = fs.existsSync(notFoundPath) ? fs.readFileSync(notFoundPath, 'utf8') : '';
    }
    return { videoTemplate, notFoundTemplate };
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

function cleanFancyText(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.replace(/[\uD835][\uDC00-\uDFFF]/g, ' ');
    return clean.replace(/\s+/g, ' ').trim();
}

function slugify(title) {
    return String(title || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '');
}

const KNOWN_CATEGORIES = new Set([
    "60-fps","ai","amateur","anal","asian","asmr","babe","bbw","bdsm","big-ass",
    "big-dick","big-tits","bisexual","blonde","blowjob","bondage","brunette","bukkake",
    "casting","compilation","cosplay","couple","creampie","cuckold","cumshot","dance",
    "doctor","double-penetration","ebony","fat","fetish","fisting","footjob","for-women",
    "gloryhole","group-sex","handjob","hardcore","hd-porn-1080p","hd-sex","hentai",
    "homemade","hotel","hotwife","housewives","hq-porn","indian","indonesia","interracial",
    "japanese","latina","lesbian","lingerie","live-cam","massage","masturbation","mature",
    "milf","nurses","office","older-men","orgy","outdoor","pawg","petite","pinay",
    "pornstar","pov","pregnant","public","redhead","shemale","sleep","small-tits",
    "squirt","stepmom","stepsister","striptease","swinger","threesome","toys","uniform",
    "vintage","vr-porn","webcam"
]);


function buildSeoTitle(rawTitle) {
    const clean = cleanFancyText(rawTitle || 'Trending Video');
    const brand = ' | kumpulenak';
    const targetMax = 60;
    const maxLen = targetMax - brand.length; // 46 chars
    if (clean.length > maxLen) {
        return clean.slice(0, maxLen - 3).trim() + '...' + brand;
    }
    if (clean.length < 32) {
        const withSuffix = clean + ' - Watch HD' + brand;
        if (withSuffix.length <= 60) return withSuffix;
    }
    return clean + brand;
}

function buildMetaDesc(rawTitle) {
    const clean = cleanFancyText(rawTitle || 'Trending Video');
    const base = 'Watch ' + clean + ' in full HD resolution for free on kumpulenak. High quality streaming, instant playback, and daily viral video updates.';
    if (base.length > 155) {
        return base.slice(0, 152).trim() + '...';
    }
    if (base.length < 120) {
        const longer = 'Watch ' + clean + ' in full HD resolution for free on kumpulenak. Stream top rated viral adult clips with fast loading and no registration required.';
        return longer.length > 155 ? longer.slice(0, 152).trim() + '...' : longer;
    }
    return base;
}

// Server-Side In-Memory Cache (Warm Lambdas)
const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min negative cache for 404s
const MAX_CACHE_ENTRIES = 500;

module.exports = async function handler(req, res) {
    const { videoTemplate: rawVideoTpl, notFoundTemplate: raw404Tpl } = getTemplates();
    const siteUrl = 'https://www.kumpulenak.my.id';

    // Extract slug / id from request query or URL path
    const urlPath = req.url ? req.url.split('?')[0] : '';
    const querySlug = req.query ? (req.query.slug || req.query.path || req.query.id) : '';
    const candidate = querySlug || urlPath.replace(/^\/v\//, '') || '';

    const idMatch = candidate.match(/^([A-Za-z0-9]{6,32})(?:-|$)/);
    const videoId = idMatch ? idMatch[1] : null;

    if (!videoId) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        res.status(404).send(raw404Tpl || '404 Page Not Found');
        return;
    }

    try {
        let data = null;
        const cached = memoryCache.get(videoId);
        if (cached && Date.now() < cached.expires) {
            if (cached.notFound) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
                res.status(404).send(raw404Tpl || '404 Video Not Found');
                return;
            }
            data = cached.data;
        }

        if (!data) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const apiUrl = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(videoId)}&format=json`;
            const apiRes = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!apiRes.ok) {
                throw new Error(`API response status ${apiRes.status}`);
            }

            data = await apiRes.json();

            // Eporner returns empty array [] or data.error if not found or deleted
            if (!data || data.error || (Array.isArray(data) && data.length === 0) || !data.id) {
                if (memoryCache.size >= MAX_CACHE_ENTRIES) {
                    const oldest = memoryCache.keys().next().value;
                    memoryCache.delete(oldest);
                }
                memoryCache.set(videoId, { notFound: true, expires: Date.now() + NEGATIVE_CACHE_TTL_MS });

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
                res.status(404).send(raw404Tpl || '404 Video Not Found');
                return;
            }

            if (memoryCache.size >= MAX_CACHE_ENTRIES) {
                const oldest = memoryCache.keys().next().value;
                memoryCache.delete(oldest);
            }
            memoryCache.set(videoId, { data, expires: Date.now() + CACHE_TTL_MS });
        }

        const title = cleanFancyText(data.title || 'Trending Video');
        const safeTitle = escapeHtml(title);
        const seoTitle = buildSeoTitle(title);
        const safeSeoTitle = escapeHtml(seoTitle);
        const desc = buildMetaDesc(title);
        const safeDesc = escapeHtml(desc);
        const slug = slugify(title);
        const finalSlug = `${data.id}${slug ? '-' + slug : ''}`;
        const canonicalUrl = `${siteUrl}/v/${finalSlug}`;

        // Find primary category for breadcrumbs
        let primaryCatSlug = 'amateur';
        let primaryCatName = 'Amateur';
        if (data.keywords) {
            const rawTags = typeof data.keywords === 'string'
                ? data.keywords.split(',').map(t => t.trim())
                : (Array.isArray(data.keywords) ? data.keywords : []);
            for (const t of rawTags) {
                const s = slugify(t);
                if (KNOWN_CATEGORIES.has(s)) {
                    primaryCatSlug = s;
                    primaryCatName = t.charAt(0).toUpperCase() + t.slice(1);
                    break;
                }
            }
        }
        const thumbUrl = (data.default_thumb && data.default_thumb.src) ? data.default_thumb.src : `${siteUrl}/assets/icons/og-image.png`;
        const embedUrl = data.embed || `https://www.eporner.com/embed/${data.id}/`;

        let uploadISO = new Date().toISOString().slice(0, 10);
        if (data.added) {
            const m = data.added.match(/^(\d{4}-\d{2}-\d{2})/);
            if (m) uploadISO = m[1];
        }

        const durationSec = Math.max(0, Math.floor(Number(data.length_sec) || 0));
        const durationMin = data.length_min || `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
        const viewsCount = data.views ? Number(data.views).toLocaleString('en-US') : '0';
        const ratingVal = data.rate || '4.5';

        // Build Rich Results Schema (@graph: BreadcrumbList + VideoObject)
        const jsonLdGraph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": siteUrl + "/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": primaryCatName,
                            "item": `${siteUrl}/category/${primaryCatSlug}`
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": title,
                            "item": canonicalUrl
                        }
                    ]
                },
                {
                    "@type": "VideoObject",
                    "name": title,
                    "description": desc,
                    "thumbnailUrl": [thumbUrl],
                    "uploadDate": `${uploadISO}T00:00:00Z`,
                    "duration": `PT${durationSec}S`,
                    "embedUrl": embedUrl,
                    "interactionStatistic": {
                        "@type": "InteractionCounter",
                        "interactionType": { "@type": "WatchAction" },
                        "userInteractionCount": Number(data.views || 0)
                    }
                }
            ]
        };

        // Build tags HTML
        let tagsHtml = '';
        if (data.keywords) {
            const rawTags = typeof data.keywords === 'string'
                ? data.keywords.split(',').map(t => t.trim())
                : (Array.isArray(data.keywords) ? data.keywords : []);

            tagsHtml = rawTags.filter(Boolean).map(tag => {
                const tagSlug = slugify(tag);
                if (KNOWN_CATEGORIES.has(tagSlug)) {
                    return `<a href="/category/${tagSlug}" class="video-tag">${escapeHtml(tag)}</a>`;
                }
                return `<a href="/?q=${encodeURIComponent(tag)}" rel="nofollow" class="video-tag">${escapeHtml(tag)}</a>`;
            }).join(' ');
        }

        // Pre-rendered video container HTML
        const preRenderedContainer = `
            <nav class="breadcrumb-nav" aria-label="Breadcrumb">
                <a href="/">Home</a>
                <span class="sep">›</span>
                <a href="/category/${escapeHtml(primaryCatSlug)}">${escapeHtml(primaryCatName)}</a>
                <span class="sep">›</span>
                <span class="current" aria-current="page">${safeTitle.slice(0, 40)}${safeTitle.length > 40 ? '...' : ''}</span>
            </nav>
            <a href="/" class="back-btn">← Back to Home</a>
            <div class="video-wrapper">
                <div class="video-facade" id="videoFacade" onclick="playVideo(this)" data-embed="${escapeHtml(embedUrl)}" role="button" aria-label="Play ${safeTitle}" tabindex="0">
                    <img class="facade-poster" src="${escapeHtml(thumbUrl)}" alt="${safeTitle}" width="1280" height="720" fetchpriority="high" decoding="async">
                    <button class="facade-play-btn" aria-hidden="true" tabindex="-1">
                        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                </div>
                <noscript>
                    <iframe src="${escapeHtml(embedUrl)}" frameborder="0" allowfullscreen="true" scrolling="no" title="${safeTitle}"></iframe>
                </noscript>
            </div>
            <div class="video-details">
                <h1 class="video-title">${safeTitle}</h1>
                <div class="video-meta">
                    <span>⏱ ${escapeHtml(durationMin)}</span>
                    <span>👁 ${viewsCount} views</span>
                    <span>⭐ ${escapeHtml(String(ratingVal))} rating</span>
                </div>
                ${tagsHtml ? `<div class="video-tags">${tagsHtml}</div>` : ''}
            </div>
        `;

        let html = rawVideoTpl;

        // Replace metadata
        html = html.replace(/<title>.*?<\/title>/s, `<title>${safeSeoTitle}</title>`);
        html = html.replace(/<meta name="description"[\s\S]*?>/s, `<meta name="description" content="${safeDesc}">`);
        html = html.replace(/<link rel="canonical"[\s\S]*?>/s, `<link rel="canonical" href="${canonicalUrl}">`);

        // Replace Open Graph
        html = html.replace(/<meta id="ogTitle" property="og:title" content=".*?">/s, `<meta id="ogTitle" property="og:title" content="${safeSeoTitle}">`);
        html = html.replace(/<meta id="ogDesc" property="og:description" content=".*?">/s, `<meta id="ogDesc" property="og:description" content="${safeDesc}">`);
        html = html.replace(/<meta id="ogImage" property="og:image" content=".*?">/s, `<meta id="ogImage" property="og:image" content="${escapeHtml(thumbUrl)}">`);
        html = html.replace(/<meta id="ogUrl" property="og:url" content=".*?">/s, `<meta id="ogUrl" property="og:url" content="${canonicalUrl}">`);

        // Replace Twitter
        html = html.replace(/<meta name="twitter:title" content=".*?">/s, `<meta name="twitter:title" content="${safeSeoTitle}">`);
        html = html.replace(/<meta name="twitter:description" content=".*?">/s, `<meta name="twitter:description" content="${safeDesc}">`);

        // Replace JSON-LD
        html = html.replace(
            '<script id="jsonLdScript" type="application/ld+json"></script>',
            `<script id="jsonLdScript" type="application/ld+json">\n${JSON.stringify(jsonLdGraph, null, 2)}\n    </script>`
        );

        // Replace video container loader with server-rendered content
        html = html.replace(
            '<div class="loader" id="videoLoader"></div>',
            preRenderedContainer
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(html);

    } catch (err) {
        // Fallback: serve base video.html if API fetch fails so client can retry
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, no-cache');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        res.status(200).send(rawVideoTpl);
    }
};
