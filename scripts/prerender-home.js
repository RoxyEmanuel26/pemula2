'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    OG_ALTERNATE_LOCALES,
    buildHreflangBlock,
    generateWebSiteSchema,
    generateOrganizationSchema,
    generateItemListSchema
} = require('./schema-helper');
const { cleanVideoTitle, isInternationalFriendly } = require('./content-filter');

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

const SEO_CRAWL_HUB_HTML = `            <nav class="seo-crawl-hub" aria-label="US &amp; European HD Video Categories" style="margin: 28px 0 20px; padding: 20px; background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <h2 style="font-size: 1rem; font-weight: 700; margin: 0; color: var(--text-primary);">Explore US, European &amp; International HD Categories</h2>
                    <div style="display: flex; gap: 14px; flex-wrap: wrap;">
                        <a href="/trending" style="font-size: 0.85rem; font-weight: 700; color: #ff6b9d; text-decoration: none;">🔥 Top 100 US &amp; EU Chart &rarr;</a>
                        <a href="/directory" style="font-size: 0.85rem; font-weight: 700; color: var(--accent); text-decoration: none;">Browse All 95 Categories &rarr;</a>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <a href="/category/american" class="video-tag">American / USA</a>
                    <a href="/category/european" class="video-tag">European</a>
                    <a href="/category/british" class="video-tag">British / UK</a>
                    <a href="/category/german" class="video-tag">German / Deutsch</a>
                    <a href="/category/french" class="video-tag">French / Français</a>
                    <a href="/category/spanish" class="video-tag">Spanish / Español</a>
                    <a href="/category/italian" class="video-tag">Italian / Italiano</a>
                    <a href="/category/czech" class="video-tag">Czech</a>
                    <a href="/category/russian" class="video-tag">Russian</a>
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
                    <a href="/category/romantic" class="video-tag">Romantic</a>
                    <a href="/category/big-tits" class="video-tag">Big Tits</a>
                    <a href="/category/big-ass" class="video-tag">Big Ass</a>
                    <a href="/category/couple" class="video-tag">Couples</a>
                    <a href="/category/cosplay" class="video-tag">Cosplay</a>
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
    console.log('Pre-rendering US & European international videos for index.html...');
    const cleanVideos = await fetchCleanInternationalVideos(24);
    if (cleanVideos.length === 0) throw new Error('No clean international videos returned');

    const cardsHtml = cleanVideos.map((v, i) => generateCardHTML(v, i)).join('\n');
    let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // Update geo meta & Hreflang Tier-1 US & EU cluster
    indexHtml = indexHtml.replace(
        /<meta name="geo\.region"[^>]*>\s*<meta name="geo\.placename"[^>]*>/,
        `<meta name="geo.region" content="US">\n    <meta name="geo.placename" content="United States, Europe, Global">`
    );
    indexHtml = indexHtml.replace(/<meta property="og:locale:alternate"[^>]*>\s*/g, '');
    indexHtml = indexHtml.replace(
        /<meta property="og:locale" content="en_US">/,
        `<meta property="og:locale" content="en_US">\n${OG_ALTERNATE_LOCALES}`
    );
    indexHtml = indexHtml.replace(
        /<!-- Hreflang[\s\S]*?(?:<link rel="alternate"[^>]*>\s*)+/,
        `${buildHreflangBlock('https://www.kumpulenak.my.id/')}\n    <link rel="alternate" type="application/rss+xml" title="kumpulenak US &amp; EU HD Video Feed" href="https://www.kumpulenak.my.id/rss.xml">\n\n    `
    );

    // Update WebSite and Organization JSON-LD schemas for US/EU reach
    const wsSchema = generateWebSiteSchema();
    const orgSchema = generateOrganizationSchema();
    indexHtml = indexHtml.replace(
        /<!-- JSON-LD Structured Data: WebSite \+ SearchAction -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<!-- JSON-LD Structured Data: WebSite + SearchAction -->\n    <script type="application/ld+json">\n${JSON.stringify(wsSchema, null, 4)}\n    </script>`
    );
    indexHtml = indexHtml.replace(
        /<!-- JSON-LD Structured Data: Organization -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<!-- JSON-LD Structured Data: Organization -->\n    <script type="application/ld+json">\n${JSON.stringify(orgSchema, null, 4)}\n    </script>`
    );

    // Replace cardGrid contents (anchored to <!-- PAGINATION -->)
    const cardGridRegex = /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/;
    indexHtml = indexHtml.replace(
        cardGridRegex,
        `<div class="card-grid" id="cardGrid">\n${cardsHtml}\n            </div>\n\n            <!-- PAGINATION -->`
    );

    // Remove any existing seo-crawl-hub before re-inserting
    indexHtml = indexHtml.replace(/\s*<nav class="seo-crawl-hub"[\s\S]*?<\/nav>/g, '');

    // Insert seo-crawl-hub right after pagination div (strictly before Adsterra Native Banner)
    indexHtml = indexHtml.replace(
        /(<!-- PAGINATION -->\s*<div class="pagination" id="pagination">[\s\S]*?<\/div>)/,
        `$1\n\n${SEO_CRAWL_HUB_HTML}`
    );

    // Ensure /trending and /directory links exist in footer
    if (!indexHtml.includes('href="/trending"')) {
        indexHtml = indexHtml.replace(
            '<a href="/">Home</a>',
            '<a href="/">Home</a>\n            <a href="/trending">Top 100 US &amp; EU</a>'
        );
    }
    if (!indexHtml.includes('href="/directory"')) {
        indexHtml = indexHtml.replace(
            '<a href="/trending">Top 100 US &amp; EU</a>',
            '<a href="/trending">Top 100 US &amp; EU</a>\n            <a href="/directory">Video Directory</a>'
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
    const itemListSchema = generateItemListSchema('Trending US & European HD Videos', 'Watch trending viral full HD 1080p videos and exclusive adult clips across US & Europe on kumpulenak.', cardItems);

    // Remove old ItemList if present
    indexHtml = indexHtml.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    // Insert ItemList right before <!-- Gallery Styles -->
    const itemListHtml = `\n    <!-- JSON-LD ItemList -->\n    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`;
    indexHtml = indexHtml.replace('<!-- Gallery Styles -->', `${itemListHtml}\n\n    <!-- Gallery Styles -->`);

    fs.writeFileSync(INDEX_HTML_PATH, indexHtml, 'utf8');
    console.log(`✅ Pre-rendered ${cleanVideos.length} US/EU international cards and updated ItemList/Hreflang schemas in index.html`);
}

prerenderHome().catch(err => {
    console.error('Error pre-rendering index.html:', err);
    process.exit(1);
});
