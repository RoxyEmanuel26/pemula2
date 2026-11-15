'use strict';

const fs = require('fs');
const path = require('path');
const { generateBreadcrumbSchema, generateItemListSchema } = require('./schema-helper');
const { getCategoryEditorial } = require('./category-intros');
const { cleanVideoTitle, isHarmfulContent, isInternationalFriendly } = require('./content-filter');

// ============================================================================
// CONFIGURATION & METADATA OVERRIDES
// ============================================================================

const CUSTOM_METADATA = {
    'amateur': { title: 'Amateur & Homemade Adult Videos', desc: 'Watch the best amateur and homemade adult videos in full HD. Real couples, authentic bedroom clips, and daily viral releases on kumpulenak.' },
    'babe': { title: 'Hot Babes & Beautiful Models HD', desc: 'Stream full HD videos featuring the hottest babes, glamorous models, and stunning girls with fast playback on kumpulenak.' },
    'milf': { title: 'Premium MILF & Cougar HD Videos', desc: 'Browse our exclusive collection of MILF and experienced mature women adult videos in full 1080p HD resolution on kumpulenak.' },
    'pov': { title: 'Immersive First-Person POV Videos', desc: 'Experience the action firsthand with top-rated Point of View (POV) adult videos streamed in crystal-clear HD on kumpulenak.' },
    'blonde': { title: 'Gorgeous Blonde Babes HD Videos', desc: 'Watch stunning blonde babes and top international models in high quality 1080p HD streaming on kumpulenak.' },
    'ebony': { title: 'Beautiful Ebony Stars & HD Clips', desc: 'Discover beautiful ebony stars and trending black models in premium high-definition adult scenes on kumpulenak.' },
    'latina': { title: 'Passionate Latina & Hispanic Babes', desc: 'Enjoy passionate HD adult videos featuring gorgeous Latina and Hispanic performers with instant streaming on kumpulenak.' },
    'dance': { title: 'Sensual Dance & Twerk HD Videos', desc: 'Watch sensual dance, solo twerk, and striptease videos in full high definition with zero buffering on kumpulenak.' },
    'outdoor': { title: 'Outdoor & Public Adventure Videos', desc: 'Stream thrilling outdoor and beach adventure adult videos in high definition on kumpulenak.' },
    'big-ass': { title: 'Big Ass & Curvy Booty HD Videos', desc: 'Explore the best collection of curvy booty and big ass adult videos in 1080p HD on kumpulenak.' },
    'big-tits': { title: 'Busty Babes & Big Tits HD Videos', desc: 'Stream full HD videos of busty models and naturally curvy stars with fast loading on kumpulenak.' },
    'couple': { title: 'Real Couples & Romantic Intimacy', desc: 'Watch real couples and passionate intimate scenes in full high definition on kumpulenak.' },
    'cosplay': { title: 'Cosplay & Costume Roleplay HD', desc: 'Exciting cosplay, anime costume, and fantasy roleplay adult videos in 1080p HD on kumpulenak.' },
    'live-cam': { title: 'Recorded Webcam & Live Cam Shows', desc: 'Watch recorded live cam shows and solo interactive webcam performances in HD on kumpulenak.' },
    'mature': { title: 'Mature Women & Classic Elegance', desc: 'Premium adult videos featuring sophisticated mature women and older ladies in full HD on kumpulenak.' }
};

const API_BASE = 'https://www.eporner.com/api/v2/video/search/';
const API_PARAMS = {
    per_page: '40',
    page: '1',
    thumbsize: 'big',
    order: 'most-popular',
    gay: '0',
    lq: '1',
    format: 'json'
};

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const CATEGORY_DIR = path.join(ROOT_DIR, 'category');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const GALLERY_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'gallery.js');

if (!fs.existsSync(CATEGORY_DIR)) {
    fs.mkdirSync(CATEGORY_DIR, { recursive: true });
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
        return false;
    }
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

function buildCategorySeoTitle(title) {
    const brand = ' | kumpulenak';
    const withSuffix = title + ' - Watch Free HD' + brand;
    if (withSuffix.length <= 60) return withSuffix;
    const shorter = title + ' - HD Videos' + brand;
    if (shorter.length <= 60) return shorter;
    return (title + brand).slice(0, 60);
}

function buildCategoryMetaDesc(title, customDesc) {
    if (customDesc && customDesc.length >= 115 && customDesc.length <= 158) {
        return customDesc;
    }
    const base = 'Watch top ' + title + ' in full 1080p HD resolution for free on kumpulenak. Stream trending 18+ clips with instant playback, daily updates, and no sign-up.';
    if (base.length > 155) return base.slice(0, 152) + '...';
    return base;
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }

            const data = await response.json();
            if (!data || !Array.isArray(data.videos)) {
                throw new Error('Invalid API response structure');
            }
            return data;
        } catch (error) {
            if (i === retries - 1) {
                console.error('All ' + retries + ' attempts failed for ' + url + ': ' + error.message);
                return null;
            }
            await new Promise(res => setTimeout(res, 1500));
        }
    }
}

async function fetchCategoryVideos(query, slug) {
    const params = new URLSearchParams({ ...API_PARAMS, query });
    const url = API_BASE + '?' + params.toString();
    const data = await fetchWithRetry(url);
    if (!data) return [];

    const safeVideos = data.videos.filter(v => !isHarmfulContent(v));
    if (slug !== 'indonesia') {
        const intl = safeVideos.filter(v => isInternationalFriendly(v));
        if (intl.length >= 12) {
            return intl.slice(0, 24);
        }
    }
    return safeVideos.slice(0, 24);
}

function generateCardHTML(video, index) {
    const title = cleanVideoTitle(video.title || 'Untitled');
    const safeTitle = escapeHTML(title);
    const slug = slugify(title);
    const videoUrl = '/v/' + video.id + (slug ? '-' + slug : '');
    const thumbUrl = (video.default_thumb && isSafeUrl(video.default_thumb.src)) ? video.default_thumb.src : '';
    const views = video.views ? Number(video.views).toLocaleString('en-US') : '0';
    const added = video.added ? video.added.slice(0, 10) : '';
    const length = video.length_min || '';
    const rate = video.rate || '';

    let badges = '';
    if (length) badges += '<span class="badge-duration">' + escapeHTML(length) + '</span>';
    if (rate) badges += '<span class="badge-rating">⭐ ' + escapeHTML(String(rate)) + '</span>';

    const isLcp = typeof index === 'number' && index < 2;
    const imgAttrs = isLcp
        ? 'width="360" height="202" fetchpriority="high" loading="eager" decoding="async"'
        : 'width="360" height="202" loading="lazy" decoding="async"';

    return (
        '<a href="' + escapeHTML(videoUrl) + '" class="card" aria-label="' + safeTitle + '">\n' +
        '    <div class="card-img-wrapper">\n' +
        '        ' + badges + '\n' +
        '        <img src="' + escapeHTML(thumbUrl) + '" alt="' + safeTitle + ' HD Video Thumbnail" ' + imgAttrs + ' onload="this.classList.add(\'loaded\')" onerror="this.classList.add(\'loaded\'); this.style.background=\'#333\';">\n' +
        '    </div>\n' +
        '    <div class="card-meta">\n' +
        '        <div class="card-date-views">\n' +
        '            <span class="card-date">📅 ' + escapeHTML(added) + '</span>\n' +
        '            <span class="card-views">👁 ' + escapeHTML(views) + '</span>\n' +
        '        </div>\n' +
        '        <h3 class="card-title">' + safeTitle + '</h3>\n' +
        '    </div>\n' +
        '</a>'
    );
}

function processTemplate(template, category, videos, allCategories) {
    let html = template;
    const siteUrl = 'https://www.kumpulenak.my.id';
    const categoryUrl = siteUrl + '/category/' + category.slug;

    const seoTitle = buildCategorySeoTitle(category.title);
    const seoDesc = buildCategoryMetaDesc(category.title, category.desc);

    html = html.replace(/<title>.*?<\/title>/s, '<title>' + escapeHTML(seoTitle) + '</title>');
    html = html.replace(/<meta name="description"[\s\S]*?>/s, '<meta name="description" content="' + escapeHTML(seoDesc) + '">');
    html = html.replace(/<meta property="og:title" content=".*?">/s, '<meta property="og:title" content="' + escapeHTML(seoTitle) + '">');
    html = html.replace(/<meta property="og:description"[\s\S]*?>/s, '<meta property="og:description" content="' + escapeHTML(seoDesc) + '">');
    html = html.replace(/<meta property="og:url" content=".*?">/s, '<meta property="og:url" content="' + categoryUrl + '">');
    html = html.replace(/<meta name="twitter:title" content=".*?">/s, '<meta name="twitter:title" content="' + escapeHTML(seoTitle) + '">');
    html = html.replace(/<meta name="twitter:description"[\s\S]*?>/s, '<meta name="twitter:description" content="' + escapeHTML(seoDesc) + '">');
    html = html.replace(/<link rel="canonical"[^>]*href=".*?">/s, '<link rel="canonical" href="' + categoryUrl + '">');

    // Replace homepage hreflang tags with category-specific international hreflang tags
    html = html.replace(
        /<!-- Hreflang[\s\S]*?-->\s*(<link rel="alternate"[\s\S]*?>\s*)+/g,
        '<!-- Hreflang — International English indexing -->\n    <link rel="alternate" hreflang="en" href="' + categoryUrl + '">\n    <link rel="alternate" hreflang="x-default" href="' + categoryUrl + '">\n\n    '
    );

    // Remove any existing BreadcrumbList & ItemList from template
    html = html.replace(/\s*<!-- JSON-LD BreadcrumbList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    html = html.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: 'Home', url: siteUrl + '/' },
        { name: 'Video Directory', url: siteUrl + '/directory' },
        { name: category.title, url: categoryUrl }
    ]);

    const cardItems = videos.map(v => {
        const title = cleanVideoTitle(v.title || 'Untitled');
        const slug = slugify(title);
        return {
            title: title,
            url: siteUrl + '/v/' + v.id + (slug ? '-' + slug : ''),
            image: (v.default_thumb && isSafeUrl(v.default_thumb.src)) ? v.default_thumb.src : ''
        };
    });

    const itemListSchema = generateItemListSchema(category.title, seoDesc, cardItems);

    let schemasHtml = '\n    <!-- JSON-LD BreadcrumbList -->\n';
    schemasHtml += '    <script type="application/ld+json">\n' + JSON.stringify(breadcrumbSchema, null, 2) + '\n    </script>\n';
    if (itemListSchema && itemListSchema.itemListElement.length > 0) {
        schemasHtml += '\n    <!-- JSON-LD ItemList -->\n';
        schemasHtml += '    <script type="application/ld+json">\n' + JSON.stringify(itemListSchema, null, 2) + '\n    </script>\n';
    }

    if (html.includes('<!-- Gallery Styles -->')) {
        html = html.replace('<!-- Gallery Styles -->', schemasHtml + '\n    <!-- Gallery Styles -->');
    } else {
        html = html.replace('</head>', schemasHtml + '\n</head>');
    }
    html = html.replace('<body>', '<body data-static-category="' + category.slug + '">');
    const visualBreadcrumb =
        '            <nav class="breadcrumb-nav" aria-label="Breadcrumb">\n' +
        '                <a href="/">Home</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <a href="/directory">Categories</a>\n' +
        '                <span class="sep">›</span>\n' +
        '                <span class="current" aria-current="page">' + escapeHTML(category.title) + '</span>\n' +
        '            </nav>\n';

    html = html.replace(/<h1 class="main-seo-title">.*?<\/h1>/s, visualBreadcrumb + '            <h1 class="main-seo-title">' + escapeHTML(category.title) + '</h1>');
    const editorial = getCategoryEditorial(category.slug, category.title);
    const editorialParagraphs = editorial.paragraphs.map(p => '                <p>' + escapeHTML(p) + '</p>').join('\n');
    const editorialSection =
        '\n            <!-- Category Editorial Hub Content (SEO Fase 5A) -->\n' +
        '            <section class="category-editorial" aria-label="About this collection">\n' +
        '                <h2>' + escapeHTML(editorial.heading) + '</h2>\n' +
        editorialParagraphs + '\n' +
        '            </section>\n';

    html = html.replace(/<p class="main-seo-desc" id="mainSeoDesc">.*?<\/p>/s, '<p class="main-seo-desc" id="mainSeoDesc">' + escapeHTML(seoDesc) + '</p>' + editorialSection);
    html = html.replace(/<(?:div|h2) class="section-label" id="sectionLabel">.*?<\/(?:div|h2)>/s, '<h2 class="section-label" id="sectionLabel">' + escapeHTML(category.title) + '</h2>');

    let cardsHtml = '';
    if (videos.length > 0) {
        cardsHtml = videos.map((v, i) => generateCardHTML(v, i)).join('\n                ');
    } else {
        cardsHtml = '<!-- API Fetch failed during build. gallery.js will attempt to fetch on client side -->';
    }

    html = html.replace(
        /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/s,
        '<div class="card-grid" id="cardGrid">\n                ' + cardsHtml + '\n            </div>\n\n            <!-- PAGINATION -->'
    );

    // Replace dynamic /?q= links in the static pages with proper static routing to category pages
    const navLinksRegex = /<a href="\/\?q=([a-z-]+)">.*?<\/a>/g;
    html = html.replace(navLinksRegex, (match, query) => {
        const cat = allCategories.find(c => c.query === query || c.slug === query);
        if (cat) {
            return '<a href="/category/' + cat.slug + '">' + cat.title + '</a>';
        }
        return match;
    });

    return html;
}

async function main() {
    console.log('🚀 Starting Static Category Pages Generation...');

    if (!fs.existsSync(INDEX_HTML_PATH)) {
        console.error('❌ Cannot find index.html at ' + INDEX_HTML_PATH);
        process.exit(1);
    }
    if (!fs.existsSync(GALLERY_JS_PATH)) {
        console.error('❌ Cannot find gallery.js at ' + GALLERY_JS_PATH);
        process.exit(1);
    }

    const galleryJs = fs.readFileSync(GALLERY_JS_PATH, 'utf-8');
    const match = galleryJs.match(/const KATEGORI_LIST = \[([\s\S]*?)\];/);
    if (!match) {
        console.error('❌ Failed to parse KATEGORI_LIST from gallery.js');
        process.exit(1);
    }

    const rawList = eval(`[${match[1]}]`);
    const allCategories = rawList.map(item => {
        const custom = CUSTOM_METADATA[item.slug];
        return {
            slug: item.slug,
            query: item.query,
            title: custom ? custom.title : `${item.label} HD Adult Videos`,
            desc: custom ? custom.desc : `Watch the best collection of ${item.label} adult videos in full 1080p HD on kumpulenak. Stream premium ${item.label} clips, trending international scenes, and daily updates for free.`,
            label: item.label
        };
    });

    console.log(`📋 Loaded ${allCategories.length} categories from gallery.js`);

    const indexTemplate = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

    // Process in concurrent batches of 6 to make regeneration fast
    const BATCH_SIZE = 6;
    for (let i = 0; i < allCategories.length; i += BATCH_SIZE) {
        const batch = allCategories.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (category) => {
            const videos = await fetchCategoryVideos(category.query, category.slug);
            const finalHtml = processTemplate(indexTemplate, category, videos, allCategories);
            const outputPath = path.join(CATEGORY_DIR, category.slug + '.html');
            fs.writeFileSync(outputPath, finalHtml, 'utf-8');
            console.log(`✅ [${category.slug}] Saved (${videos.length} clean videos)`);
        }));
    }

    console.log('\n🎉 Generation complete! ' + allCategories.length + ' category pages created in /category/');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
