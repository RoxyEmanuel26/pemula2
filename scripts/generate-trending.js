'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    OG_ALTERNATE_LOCALES,
    buildHreflangBlock,
    generateBreadcrumbSchema,
    generateItemListSchema
} = require('./schema-helper');
const { cleanVideoTitle, isInternationalFriendly } = require('./content-filter');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const OUTPUT_PATH = path.join(ROOT_DIR, 'trending.html');

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

async function fetchTop100USEUVideos() {
    const endpoints = [
        'https://www.eporner.com/api/v2/video/search/?per_page=60&page=1&thumbsize=big&order=top-weekly&gay=0&lq=1&format=json',
        'https://www.eporner.com/api/v2/video/search/?per_page=60&page=1&thumbsize=big&order=top-monthly&gay=0&lq=1&format=json',
        'https://www.eporner.com/api/v2/video/search/?per_page=60&page=1&thumbsize=big&order=most-popular&gay=0&lq=1&format=json',
        'https://www.eporner.com/api/v2/video/search/?per_page=60&page=1&thumbsize=big&order=top-rated&gay=0&lq=1&format=json'
    ];

    const seen = new Set();
    const collected = [];

    for (const url of endpoints) {
        if (collected.length >= 100) break;
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
                if (collected.length >= 100) break;
            }
            await new Promise(r => setTimeout(r, 200));
        } catch (err) {
            console.warn('Warning fetching trending endpoint:', err.message);
        }
    }
    return collected;
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

    let badges = `<span class="badge-rating" style="top:8px;left:8px;bottom:auto;right:auto;background:rgba(255,42,95,0.9);color:#fff;">#${index + 1}</span>`;
    if (length) badges += `<span class="badge-duration">${escapeHTML(length)}</span>`;
    if (rate) badges += `<span class="badge-rating">⭐ ${escapeHTML(String(rate))}</span>`;

    const imgAttrs = index < 4
        ? 'width="360" height="202" fetchpriority="high" loading="eager" decoding="async"'
        : 'width="360" height="202" loading="lazy" decoding="async"';

    return `                <a href="${escapeHTML(videoUrl)}" class="card" aria-label="#${index + 1} ${safeTitle}">
                    <div class="card-img-wrapper">
                        ${badges}
                        <img src="${escapeHTML(thumbUrl)}" alt="${safeTitle} Full HD Thumbnail" ${imgAttrs} onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
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

async function generateTrendingPage() {
    console.log('🔥 Generating /trending.html (Top 100 US & European HD Videos Chart)...');
    const videos = await fetchTop100USEUVideos();
    if (videos.length < 24) {
        throw new Error(`Expected >= 24 clean videos for /trending.html, got ${videos.length}`);
    }

    const template = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const pageUrl = `${BASE_URL}/trending`;
    const seoTitle = 'Top 100 Trending US & European HD Videos | kumpulenak';
    const seoDesc = 'Watch the Top 100 most-watched and highest-rated 1080p Full HD adult videos trending across the United States, UK, and Europe on kumpulenak.';

    let html = template;
    html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHTML(seoTitle)}</title>`);
    html = html.replace(/<meta name="description"[\s\S]*?>/s, `<meta name="description" content="${escapeHTML(seoDesc)}">`);
    html = html.replace(/<meta property="og:title" content=".*?">/s, `<meta property="og:title" content="${escapeHTML(seoTitle)}">`);
    html = html.replace(/<meta property="og:description"[\s\S]*?>/s, `<meta property="og:description" content="${escapeHTML(seoDesc)}">`);
    html = html.replace(/<meta property="og:url" content=".*?">/s, `<meta property="og:url" content="${pageUrl}">`);
    html = html.replace(/<meta name="twitter:title" content=".*?">/s, `<meta name="twitter:title" content="${escapeHTML(seoTitle)}">`);
    html = html.replace(/<meta name="twitter:description"[\s\S]*?>/s, `<meta name="twitter:description" content="${escapeHTML(seoDesc)}">`);
    html = html.replace(/<link rel="canonical"[^>]*href=".*?">/s, `<link rel="canonical" id="canonicalLink" href="${pageUrl}">`);

    html = html.replace(
        /<!-- Hreflang[\s\S]*?(?:<link rel="alternate"[^>]*>\s*)+/,
        `${buildHreflangBlock(pageUrl)}\n\n    `
    );
    html = html.replace(/<meta property="og:locale:alternate"[^>]*>\s*/g, '');
    html = html.replace(
        /<meta property="og:locale" content="en_US">/,
        `<meta property="og:locale" content="en_US">\n${OG_ALTERNATE_LOCALES}`
    );

    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: 'Home', url: `${BASE_URL}/` },
        { name: 'Top 100 US & EU Trending', url: pageUrl }
    ]);

    const cardItems = videos.map(v => {
        const t = cleanVideoTitle(v.title || 'Untitled');
        const slug = slugify(t);
        return {
            title: t,
            url: `${BASE_URL}/v/${v.id}${slug ? '-' + slug : ''}`,
            image: (v.default_thumb && v.default_thumb.src) ? v.default_thumb.src : ''
        };
    });
    const itemListSchema = generateItemListSchema('Top 100 US & European HD Videos', seoDesc, cardItems);

    html = html.replace(/\s*<!-- JSON-LD BreadcrumbList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    html = html.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    const schemasHtml = [
        '\n    <!-- JSON-LD BreadcrumbList -->',
        `    <script type="application/ld+json">\n${JSON.stringify(breadcrumbSchema, null, 2)}\n    </script>`,
        '\n    <!-- JSON-LD ItemList -->',
        `    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`
    ].join('\n');

    html = html.replace('<!-- Gallery Styles -->', `${schemasHtml}\n\n    <!-- Gallery Styles -->`);
    html = html.replace('<body>', '<body data-static-category="trending">');

    const visualBreadcrumb =
        '            <nav class="breadcrumb-nav" aria-label="Breadcrumb">\n' +
        '                <a href="/">Home</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <a href="/directory">Directory</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <span class="current" aria-current="page">Top 100 US &amp; EU Chart</span>\n' +
        '            </nav>\n';

    html = html.replace(/<h1 class="main-seo-title">.*?<\/h1>/s, visualBreadcrumb + '            <h1 class="main-seo-title">Top 100 US &amp; European Trending HD Videos</h1>');

    const trendingIntro =
        '\n            <section class="category-editorial" aria-label="About Top 100 Chart">\n' +
        '                <h2>Most Watched 1080p HD Releases in the USA, UK &amp; Europe</h2>\n' +
        '                <p>Explore the definitive weekly Top 100 chart ranked by international popularity, viewer ratings, and high-definition streaming performance across the United States, United Kingdom, Germany, France, Spain, and Italy.</p>\n' +
        '                <p>All 100 featured clips deliver instant HTML5 mobile and desktop playback with zero account registration. Browse regional hubs like <a href="/category/american" style="color:var(--accent);">American</a>, <a href="/category/european" style="color:var(--accent);">European</a>, <a href="/category/british" style="color:var(--accent);">British</a>, <a href="/category/german" style="color:var(--accent);">German</a>, <a href="/category/french" style="color:var(--accent);">French</a>, and <a href="/category/spanish" style="color:var(--accent);">Spanish</a>.</p>\n' +
        '            </section>\n';

    html = html.replace(
        /<p class="main-seo-desc" id="mainSeoDesc">.*?<\/p>/s,
        `<p class="main-seo-desc" id="mainSeoDesc">${escapeHTML(seoDesc)}</p>${trendingIntro}`
    );
    html = html.replace(
        /<(?:div|h2) class="section-label" id="sectionLabel">.*?<\/(?:div|h2)>/s,
        `<h2 class="section-label" id="sectionLabel">🔥 Top ${videos.length} US &amp; European HD Videos</h2>`
    );

    const cardsHtml = videos.map((v, i) => generateCardHTML(v, i)).join('\n');
    html = html.replace(
        /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/s,
        `<div class="card-grid" id="cardGrid">\n${cardsHtml}\n            </div>\n\n            <!-- PAGINATION -->`
    );

    fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
    console.log(`✅ Generated /trending.html with ${videos.length} US/EU top videos.`);
}

if (require.main === module) {
    generateTrendingPage().catch(err => {
        console.error('❌ Failed to generate trending.html:', err);
        process.exit(1);
    });
}

module.exports = { generateTrendingPage };
