'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    RSS_LINK_TAG,
    OG_LOCALES_EN,
    buildHreflangBlock,
    generateCollectionPageSchema,
    generateBreadcrumbSchema,
    generateItemListSchema
} = require('./schema-helper');
const { cleanVideoTitle, isUSEUFriendly } = require('./content-filter');

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
    const queries = [
        { q: 'american', order: 'most-popular' },
        { q: 'european', order: 'most-popular' },
        { q: 'british', order: 'most-popular' },
        { q: 'german', order: 'most-popular' },
        { q: 'french', order: 'most-popular' },
        { q: 'spanish', order: 'most-popular' },
        { q: 'italian', order: 'most-popular' },
        { q: 'hd porn 1080p', order: 'top-weekly' },
        { q: '60 fps', order: 'most-popular' },
        { q: 'blonde', order: 'most-popular' },
        { q: 'milf', order: 'most-popular' },
        { q: 'pov', order: 'most-popular' },
        { q: 'amateur', order: 'most-popular' },
        { q: 'brunette', order: 'most-popular' },
        { q: 'babe', order: 'top-rated' }
    ];

    const seen = new Set();
    const collected = [];

    for (const item of queries) {
        if (collected.length >= 100) break;
        const url = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(item.q)}&per_page=20&page=1&thumbsize=big&order=${item.order}&gay=0&lq=1&format=json`;
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data || !Array.isArray(data.videos)) continue;
            let addedFromQuery = 0;
            for (const v of data.videos) {
                if (!v || !v.id || seen.has(v.id)) continue;
                if (!v.default_thumb || !v.default_thumb.src) continue;
                if (!isUSEUFriendly(v)) continue;
                v.title = cleanVideoTitle(v.title);
                seen.add(v.id);
                collected.push(v);
                addedFromQuery++;
                if (collected.length >= 100 || addedFromQuery >= 8) break;
            }
            await new Promise(r => setTimeout(r, 120));
        } catch (err) {
            console.warn(`Warning fetching trending query "${item.q}":`, err.message);
        }
    }

    // Sort by views descending so the Top 100 chart genuinely reflects highest-watched US/EU hits
    collected.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
    return collected.slice(0, 100);
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
                        <img src="${escapeHTML(thumbUrl)}" alt="${safeTitle} 1080p Full HD Thumbnail" ${imgAttrs} class="loaded" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
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
    console.log('🔥 Generating /trending.html (Top 100 100% US & European HD Chart)...');
    const videos = await fetchTop100USEUVideos();
    if (videos.length < 24) {
        throw new Error(`Expected >= 24 clean US/EU videos for /trending.html, got ${videos.length}`);
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
        /[ \t]*<!-- Hreflang[\s\S]*?(?:<link rel="alternate"[^>]*>\s*)+/,
        `${buildHreflangBlock(pageUrl)}\n${RSS_LINK_TAG}\n\n`
    );
    html = html.replace(/<meta property="og:locale:alternate"[^>]*>\s*/g, '');
    html = html.replace(
        /<meta property="og:locale" content="en_US">/,
        `<meta property="og:locale" content="en_US">\n${OG_LOCALES_EN}`
    );

    // Update LCP preload to trending #1 video thumb
    const lcpThumb = videos[0]?.default_thumb?.src || '';
    html = html.replace(/[ \t]*<link rel="preload" as="image"[^>]*>\s*/g, '');
    if (lcpThumb) {
        html = html.replace(
            '<!-- Preload Critical Resources -->',
            `<!-- Preload Critical Resources -->\n    <link rel="preload" as="image" href="${escapeHTML(lcpThumb)}" fetchpriority="high">`
        );
    }

    // Remove homepage-only WebSite & Organization schemas (keep CollectionPage + BreadcrumbList + ItemList)
    html = html.replace(/\s*<!-- JSON-LD Structured Data: WebSite \+ SearchAction -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    html = html.replace(/\s*<!-- JSON-LD Structured Data: Organization -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    html = html.replace(/\s*<!-- JSON-LD BreadcrumbList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    html = html.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    const collectionSchema = generateCollectionPageSchema(seoTitle, seoDesc, pageUrl, 'en');
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

    const schemasHtml = [
        '\n    <!-- JSON-LD CollectionPage -->',
        `    <script type="application/ld+json">\n${JSON.stringify(collectionSchema, null, 2)}\n    </script>`,
        '\n    <!-- JSON-LD BreadcrumbList -->',
        `    <script type="application/ld+json">\n${JSON.stringify(breadcrumbSchema, null, 2)}\n    </script>`,
        '\n    <!-- JSON-LD ItemList -->',
        `    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`
    ].join('\n');

    html = html.replace('<!-- Gallery Styles -->', `${schemasHtml}\n\n    <!-- Gallery Styles -->`);
    html = html.replace('<body>', '<body data-static-category="trending">');

    // Highlight Top 100 tab in header nav
    html = html.replace('<a href="/" class="nav-tab active" data-tab="popular">Popular</a>', '<a href="/" class="nav-tab" data-tab="popular">Popular</a>');
    html = html.replace('<a href="/trending" class="nav-tab" data-tab="trending">Top 100</a>', '<a href="/trending" class="nav-tab active" data-tab="trending">Top 100</a>');

    const visualBreadcrumb =
        '            <nav class="breadcrumb-nav" aria-label="Breadcrumb">\n' +
        '                <a href="/">Home</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <a href="/directory">Directory</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <span class="current" aria-current="page">Top 100 US &amp; EU Chart</span>\n' +
        '            </nav>\n';

    html = html.replace(/<h1 class="main-seo-title">.*?<\/h1>/s, visualBreadcrumb + '            <h1 class="main-seo-title">Top 100 US &amp; European Trending HD Videos</h1>');

    // Remove homepage-only language switcher bar from inner chart page
    html = html.replace(/\s*<!-- European & International Native Language Switcher -->\s*<nav class="eu-lang-bar"[\s\S]*?<\/nav>/g, '');

    const trendingIntro =
        '\n            <section class="category-editorial" aria-label="About Top 100 Chart">\n' +
        '                <h2>Most Watched 1080p HD Releases in the USA, UK &amp; Europe</h2>\n' +
        '                <p>Explore the definitive weekly Top 100 chart ranked by international popularity, viewer ratings, and high-definition streaming performance across the United States, United Kingdom, Germany, France, Spain, Italy, Netherlands, and Poland.</p>\n' +
        '                <p>All 100 featured clips deliver instant HTML5 mobile and desktop playback with zero account registration. Browse regional hubs like <a href="/category/american" style="color:var(--accent);">American</a>, <a href="/category/european" style="color:var(--accent);">European</a>, <a href="/category/british" style="color:var(--accent);">British</a>, <a href="/category/german" style="color:var(--accent);">German</a>, <a href="/category/french" style="color:var(--accent);">French</a>, and <a href="/category/spanish" style="color:var(--accent);">Spanish</a>, or switch to native European editions (<a href="/de" style="color:var(--accent);">Deutsch</a>, <a href="/fr" style="color:var(--accent);">Français</a>, <a href="/es" style="color:var(--accent);">Español</a>, <a href="/it" style="color:var(--accent);">Italiano</a>, <a href="/nl" style="color:var(--accent);">Nederlands</a>, <a href="/pl" style="color:var(--accent);">Polski</a>).</p>\n' +
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
    console.log(`✅ Generated /trending.html with ${videos.length} 100% US/EU top videos.`);
}

if (require.main === module) {
    generateTrendingPage().catch(err => {
        console.error('❌ Failed to generate trending.html:', err);
        process.exit(1);
    });
}

module.exports = { generateTrendingPage };
