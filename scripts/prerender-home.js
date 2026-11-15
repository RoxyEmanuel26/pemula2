'use strict';

const fs = require('fs');
const path = require('path');
const { generateItemListSchema, BASE_URL } = require('./schema-helper');
const { cleanVideoTitle, isHarmfulContent, isInternationalFriendly } = require('./content-filter');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function generateCardHTML(video, index) {
    const title = cleanVideoTitle(video.title || 'Untitled');
    const safeTitle = escapeHTML(title);
    const slug = slugify(title);
    const videoUrl = `/v/${video.id}${slug ? '-' + slug : ''}`;
    const thumbUrl = (video.default_thumb && video.default_thumb.src) ? video.default_thumb.src : '';
    const views = video.views ? Number(video.views).toLocaleString('en-US') : '0';
    const added = video.added ? video.added.slice(0, 10) : '';
    const length = video.length_min || '';
    const rate = video.rate || '';

    let badges = '';
    if (length) badges += `<span class="badge-duration">${escapeHTML(length)}</span>`;
    if (rate) badges += `<span class="badge-rating">⭐ ${escapeHTML(String(rate))}</span>`;

    const isLcp = typeof index === 'number' && index < 2;
    const imgAttrs = isLcp
        ? 'width="360" height="202" fetchpriority="high" loading="eager" decoding="async"'
        : 'width="360" height="202" loading="lazy" decoding="async"';

    return `                <a href="${escapeHTML(videoUrl)}" class="card" aria-label="${safeTitle}">
                    <div class="card-img-wrapper">
                        ${badges}
                        <img src="${escapeHTML(thumbUrl)}" alt="${safeTitle} HD Video Thumbnail" ${imgAttrs} onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
                    </div>
                    <div class="card-meta">
                        <div class="card-date-views">
                            <span class="card-date">📅 ${escapeHTML(added)}</span>
                            <span class="card-views">👁 ${escapeHTML(views)}</span>
                        </div>
                        <h3 class="card-title">${safeTitle}</h3>
                    </div>
                </a>`;
}

const SEO_CRAWL_HUB_HTML = `            <nav class="seo-crawl-hub" aria-label="Popular International Categories & Video Directory" style="margin: 28px 0 20px; padding: 20px; background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <h2 style="font-size: 1rem; font-weight: 700; margin: 0; color: var(--text-primary);">Explore International HD Categories</h2>
                    <a href="/directory" style="font-size: 0.85rem; font-weight: 700; color: var(--accent); text-decoration: none;">Browse Full Video Directory &amp; All 85 Categories &rarr;</a>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <a href="/category/amateur" class="video-tag">Amateur</a>
                    <a href="/category/milf" class="video-tag">MILF</a>
                    <a href="/category/pov" class="video-tag">POV</a>
                    <a href="/category/hd-porn-1080p" class="video-tag">Full HD 1080p</a>
                    <a href="/category/60-fps" class="video-tag">60 FPS</a>
                    <a href="/category/blonde" class="video-tag">Blonde</a>
                    <a href="/category/brunette" class="video-tag">Brunette</a>
                    <a href="/category/latina" class="video-tag">Latina</a>
                    <a href="/category/ebony" class="video-tag">Ebony</a>
                    <a href="/category/asian" class="video-tag">Asian</a>
                    <a href="/category/japanese" class="video-tag">Japanese</a>
                    <a href="/category/babe" class="video-tag">Babes</a>
                    <a href="/category/big-tits" class="video-tag">Big Tits</a>
                    <a href="/category/big-ass" class="video-tag">Big Ass</a>
                    <a href="/category/couple" class="video-tag">Couples</a>
                    <a href="/category/cosplay" class="video-tag">Cosplay</a>
                    <a href="/category/creampie" class="video-tag">Creampie</a>
                    <a href="/category/massage" class="video-tag">Massage</a>
                    <a href="/category/lingerie" class="video-tag">Lingerie</a>
                    <a href="/category/vr-porn" class="video-tag">VR Videos</a>
                </div>
            </nav>`;

async function fetchCleanInternationalVideos(targetCount = 24) {
    const endpoints = [
        'https://www.eporner.com/api/v2/video/search/?per_page=50&page=1&thumbsize=big&order=top-weekly&gay=0&lq=1&format=json',
        'https://www.eporner.com/api/v2/video/search/?per_page=50&page=1&thumbsize=big&order=most-popular&gay=0&lq=1&format=json',
        'https://www.eporner.com/api/v2/video/search/?per_page=50&page=2&thumbsize=big&order=most-popular&gay=0&lq=1&format=json'
    ];

    const seen = new Set();
    const collected = [];

    for (const url of endpoints) {
        if (collected.length >= targetCount) break;
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data || !Array.isArray(data.videos)) continue;

            for (const v of data.videos) {
                if (!v || !v.id || seen.has(v.id)) continue;
                if (!isInternationalFriendly(v)) continue;
                v.title = cleanVideoTitle(v.title);
                seen.add(v.id);
                collected.push(v);
                if (collected.length >= targetCount) break;
            }
        } catch (err) {
            console.warn('Warning fetching endpoint:', err.message);
        }
    }
    return collected;
}

async function prerenderHome() {
    console.log('Pre-rendering international popular videos for index.html...');
    const cleanVideos = await fetchCleanInternationalVideos(24);
    if (cleanVideos.length === 0) throw new Error('No clean international videos returned');

    const cardsHtml = cleanVideos.map((v, i) => generateCardHTML(v, i)).join('\n');
    let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // Fix hreflang in index.html to strictly target international English + x-default
    indexHtml = indexHtml.replace(
        /<!-- Hreflang[\s\S]*?<link rel="alternate" hreflang="x-default" href="https:\/\/www\.kumpulenak\.my\.id\/">/,
        `<!-- Hreflang — International English indexing -->\n    <link rel="alternate" hreflang="en" href="https://www.kumpulenak.my.id/">\n    <link rel="alternate" hreflang="x-default" href="https://www.kumpulenak.my.id/">`
    );

    // Fix WebSite JSON-LD inLanguage
    indexHtml = indexHtml.replace(/"inLanguage":\s*\["en",\s*"id"\]/, '"inLanguage": "en"');

    // Replace cardGrid contents (anchored to <!-- PAGINATION -->)
    const cardGridRegex = /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/;
    indexHtml = indexHtml.replace(
        cardGridRegex,
        `<div class="card-grid" id="cardGrid">\n${cardsHtml}\n            </div>\n\n            <!-- PAGINATION -->`
    );

    // Remove any existing seo-crawl-hub before re-inserting
    indexHtml = indexHtml.replace(/\s*<nav class="seo-crawl-hub"[\s\S]*?<\/nav>/g, '');

    // Insert seo-crawl-hub right after pagination div (and strictly before Adsterra Native Banner)
    indexHtml = indexHtml.replace(
        /(<!-- PAGINATION -->\s*<div class="pagination" id="pagination">[\s\S]*?<\/div>)/,
        `$1\n\n${SEO_CRAWL_HUB_HTML}`
    );

    // Ensure /directory link exists in footer
    if (!indexHtml.includes('href="/directory"')) {
        indexHtml = indexHtml.replace(
            '<a href="/">Home</a>',
            '<a href="/">Home</a>\n            <a href="/directory">Video Directory</a>'
        );
    }

    // Build ItemList JSON-LD
    const cardItems = cleanVideos.map(v => {
        const title = cleanVideoTitle(v.title || 'Untitled');
        const slug = slugify(title);
        return {
            title: title,
            url: `${BASE_URL}/v/${v.id}${slug ? '-' + slug : ''}`,
            image: (v.default_thumb && v.default_thumb.src) ? v.default_thumb.src : ''
        };
    });
    const itemListSchema = generateItemListSchema('Trending Viral HD Videos', 'Watch trending viral full HD 1080p videos and exclusive adult clips on kumpulenak.', cardItems);

    // Remove old ItemList if present
    indexHtml = indexHtml.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    // Insert ItemList right before <!-- Gallery Styles -->
    const itemListHtml = `\n    <!-- JSON-LD ItemList -->\n    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`;
    indexHtml = indexHtml.replace('<!-- Gallery Styles -->', `${itemListHtml}\n\n    <!-- Gallery Styles -->`);

    fs.writeFileSync(INDEX_HTML_PATH, indexHtml, 'utf8');
    console.log(`✅ Pre-rendered ${cleanVideos.length} international cards and updated ItemList schema in index.html`);
}

prerenderHome().catch(err => {
    console.error('Error pre-rendering index.html:', err);
    process.exit(1);
});
