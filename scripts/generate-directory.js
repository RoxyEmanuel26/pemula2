'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    ASSET_VERSION,
    EU_HUBS,
    RSS_LINK_TAG,
    OG_LOCALES_EN,
    buildHreflangBlock
} = require('./schema-helper');
const { cleanVideoTitle, isHarmfulContent, isUSEUFriendly } = require('./content-filter');

const ROOT_DIR = path.join(__dirname, '..');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const CATEGORY_DIR = path.join(ROOT_DIR, 'category');
const GALLERY_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'gallery.js');
const OUTPUT_PATH = path.join(ROOT_DIR, 'directory.html');

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function decodeXml(value) {
    return String(value ?? '')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}

function loadCategories() {
    const galleryJs = fs.readFileSync(GALLERY_JS_PATH, 'utf8');
    const match = galleryJs.match(/const KATEGORI_LIST = \[([\s\S]*?)\];/);
    if (!match) return [];
    const rawList = eval(`[${match[1]}]`);
    const seen = new Set();
    const list = [];
    for (const item of rawList) {
        if (!item || !item.slug || seen.has(item.slug)) continue;
        seen.add(item.slug);
        list.push({
            slug: item.slug,
            label: item.label || item.slug
        });
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
}

function extractCleanVideosFromShards(maxCount = 160) {
    if (!fs.existsSync(SITEMAPS_DIR)) return [];
    const shardFiles = fs.readdirSync(SITEMAPS_DIR)
        .filter(f => /^sitemap_video_\d{4}-\d{2}-\d{2}_\d+\.xml$/.test(f))
        .sort()
        .reverse();

    const collected = [];
    const seenIds = new Set();

    for (const file of shardFiles) {
        if (collected.length >= maxCount) break;
        const xml = fs.readFileSync(path.join(SITEMAPS_DIR, file), 'utf8');
        const urlBlocks = xml.match(/  <url>[\s\S]*?  <\/url>/g) || [];
        for (const block of urlBlocks) {
            if (collected.length >= maxCount) break;
            const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
            const titleMatch = block.match(/<video:title>([^<]+)<\/video:title>/);
            const thumbMatch = block.match(/<video:thumbnail_loc>([^<]+)<\/video:thumbnail_loc>/);
            const dateMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
            const durMatch = block.match(/<video:duration>(\d+)<\/video:duration>/);

            if (!locMatch || !titleMatch) continue;
            const loc = decodeXml(locMatch[1]);
            const pathUrl = loc.replace(BASE_URL, '');
            const idMatch = pathUrl.match(/^\/v\/([A-Za-z0-9]{6,32})(?:-|$)/);
            if (!idMatch) continue;
            const id = idMatch[1];
            if (seenIds.has(id)) continue;

            const rawTitle = decodeXml(titleMatch[1]);
            if (isHarmfulContent(rawTitle)) continue;
            const cleanedTitle = cleanVideoTitle(rawTitle);
            if (!isUSEUFriendly({ title: cleanedTitle })) continue;

            const sec = durMatch ? Number(durMatch[1]) : 0;
            const durationStr = sec > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'HD';
            const thumbUrl = thumbMatch ? decodeXml(thumbMatch[1]) : '';

            seenIds.add(id);
            collected.push({
                id,
                url: pathUrl,
                title: cleanedTitle,
                thumb: thumbUrl,
                date: dateMatch ? dateMatch[1] : '2026',
                duration: durationStr
            });
        }
    }
    return collected;
}

/**
 * Extracts category-matched US & EU cards from pre-rendered category/*.html files
 * so api/video.js can serve topically relevant Related Videos with 0 external HTTP calls!
 */
function buildCategoryAwareRelatedPool(fallbackVideos) {
    const priorityCategories = [
        'american', 'european', 'british', 'german', 'french', 'spanish', 'italian', 'czech',
        'amateur', 'milf', 'pov', 'hd-porn-1080p', '60-fps', 'blonde', 'brunette', 'latina',
        'ebony', 'babe', 'big-tits', 'big-ass', 'couple', 'romantic', 'mature', 'homemade'
    ];

    const categoriesMap = {};
    const allSeen = new Set();
    const allPool = [];

    for (const slug of priorityCategories) {
        const catPath = path.join(CATEGORY_DIR, `${slug}.html`);
        if (!fs.existsSync(catPath)) continue;
        const html = fs.readFileSync(catPath, 'utf8');
        const cardRegex = /<a href="(\/v\/([A-Za-z0-9]{6,32})[^"]*)" class="card"[^>]*>[\s\S]*?<img src="([^"]+)"[\s\S]*?<span class="card-date">📅 ([^<]+)<\/span>\s*<span class="card-views">👁 ([^<]+)<\/span>[\s\S]*?<h3 class="card-title">([^<]+)<\/h3>/g;
        const list = [];
        let m;
        while ((m = cardRegex.exec(html)) !== null && list.length < 14) {
            const id = m[2];
            const thumb = decodeXml(m[3]);
            const added = m[4].trim();
            const views = parseInt(m[5].replace(/,/g, ''), 10) || 12500;
            const title = cleanVideoTitle(decodeXml(m[6]));
            if (!isUSEUFriendly({ title })) continue;

            const durMatch = m[0].match(/<span class="badge-duration">([^<]+)<\/span>/);
            const rateMatch = m[0].match(/<span class="badge-rating">⭐ ([^<]+)<\/span>/);

            const entry = {
                id,
                title,
                added,
                length_min: durMatch ? durMatch[1] : 'HD',
                rate: rateMatch ? rateMatch[1] : '4.6',
                views,
                default_thumb: { src: thumb }
            };
            list.push(entry);
            if (!allSeen.has(id) && allPool.length < 72) {
                allSeen.add(id);
                allPool.push(entry);
            }
        }
        if (list.length > 0) {
            categoriesMap[slug] = list;
        }
    }

    // Backfill allPool from clean shard videos if needed
    for (const v of fallbackVideos) {
        if (allPool.length >= 72) break;
        if (allSeen.has(v.id)) continue;
        allSeen.add(v.id);
        allPool.push({
            id: v.id,
            title: v.title,
            added: v.date,
            length_min: v.duration,
            rate: '4.6',
            views: 15000,
            default_thumb: { src: v.thumb }
        });
    }

    return { categories: categoriesMap, all: allPool };
}

function generateDirectoryPage() {
    console.log('📂 Generating /directory.html (HTML Sitemap, 95 Categories & Category-Keyed Related Pool)...');
    const categories = loadCategories();
    const videos = extractCleanVideosFromShards(160);

    // Save category-keyed US/EU related videos pool (0 external API calls in api/video.js on Vercel Free Tier)
    const relatedPoolPath = path.join(ROOT_DIR, 'data', 'related-pool.json');
    const relatedPoolData = buildCategoryAwareRelatedPool(videos);
    fs.writeFileSync(relatedPoolPath, JSON.stringify(relatedPoolData, null, 2), 'utf8');

    const pageTitle = `US & EU HD Video Directory — ${categories.length} Categories | kumpulenak`;
    const pageDesc = `Explore all ${categories.length} curated 1080p Full HD adult video categories, 6 European language hubs, and daily trending US & EU releases free on kumpulenak.`;

    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {
                        '@type': 'ListItem',
                        'position': 1,
                        'name': 'Home',
                        'item': `${BASE_URL}/`
                    },
                    {
                        '@type': 'ListItem',
                        'position': 2,
                        'name': 'Video Directory & Categories',
                        'item': `${BASE_URL}/directory`
                    }
                ]
            },
            {
                '@type': 'CollectionPage',
                'name': pageTitle,
                'description': pageDesc,
                'url': `${BASE_URL}/directory`,
                'inLanguage': 'en',
                'isPartOf': {
                    '@type': 'WebSite',
                    'name': 'kumpulenak',
                    'url': BASE_URL
                }
            }
        ]
    };

    const euHubsHtml = EU_HUBS.map(hub =>
        `                <a href="${hub.path}" class="dir-cat-card" hreflang="${hub.code}">
                    <span class="dir-cat-name">${escapeHTML(hub.label)} (${hub.shortLabel})</span>
                    <span class="dir-cat-badge">EU HD</span>
                </a>`
    ).join('\n');

    const categoriesHtml = categories.map(cat =>
        `                <a href="/category/${escapeHTML(cat.slug)}" class="dir-cat-card">
                    <span class="dir-cat-name">${escapeHTML(cat.label)}</span>
                    <span class="dir-cat-badge">HD</span>
                </a>`
    ).join('\n');

    const videosHtml = videos.map(v =>
        `                <li class="dir-video-item">
                    <a href="${escapeHTML(v.url)}" class="dir-video-link">${escapeHTML(v.title)}</a>
                    <span class="dir-video-meta">⏱ ${escapeHTML(v.duration)} &bull; 📅 ${escapeHTML(v.date)}</span>
                </li>`
    ).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="referrer" content="no-referrer-when-downgrade">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(pageTitle)}</title>
    <meta name="description" content="${escapeHTML(pageDesc)}">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta name="rating" content="adult">
    <meta name="language" content="English">

    <link rel="canonical" href="${BASE_URL}/directory">
${buildHreflangBlock(`${BASE_URL}/directory`)}
${RSS_LINK_TAG}

    <meta property="og:locale" content="en_US">
${OG_LOCALES_EN}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="kumpulenak">
    <meta property="og:title" content="${escapeHTML(pageTitle)}">
    <meta property="og:description" content="${escapeHTML(pageDesc)}">
    <meta property="og:url" content="${BASE_URL}/directory">
    <meta property="og:image" content="${BASE_URL}/assets/icons/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="kumpulenak US &amp; EU HD Video Directory">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@kumpulenak">
    <meta name="twitter:title" content="${escapeHTML(pageTitle)}">
    <meta name="twitter:description" content="${escapeHTML(pageDesc)}">
    <meta name="twitter:image" content="${BASE_URL}/assets/icons/og-image.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet"></noscript>

    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">

    <link rel="stylesheet" href="/assets/css/gallery.css?v=${ASSET_VERSION}">
    <script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
    </script>
    <style>
        .dir-container { max-width: 1200px; margin: 32px auto; padding: 0 24px; }
        .dir-section { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 28px; margin-bottom: 32px; }
        .dir-section h2 { font-size: 1.35rem; font-weight: 800; margin-top: 0; margin-bottom: 16px; color: #fff; }
        .dir-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 12px; }
        .dir-cat-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.2s ease; }
        .dir-cat-card:hover { background: var(--accent); color: #fff; border-color: transparent; transform: translateY(-2px); }
        .dir-cat-badge { font-size: 0.7rem; padding: 2px 7px; border-radius: 99px; background: rgba(255,42,95,0.18); color: var(--accent); font-weight: 700; }
        .dir-cat-card:hover .dir-cat-badge { background: rgba(255,255,255,0.25); color: #fff; }
        .dir-video-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
        .dir-video-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 10px; }
        .dir-video-link { color: var(--text-primary); text-decoration: none; font-weight: 600; font-size: 0.9rem; line-height: 1.35; }
        .dir-video-link:hover { color: var(--accent); }
        .dir-video-meta { font-size: 0.78rem; color: var(--text-secondary); }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-inner">
            <a href="/" class="logo" aria-label="kumpulenak Home">kumpul<span>enak</span></a>
            <nav class="nav-tabs" aria-label="Primary Navigation">
                <a href="/" class="nav-tab">Popular</a>
                <a href="/trending" class="nav-tab">Top 100 US &amp; EU</a>
                <a href="/directory" class="nav-tab active">Directory</a>
                <a href="/category/hd-porn-1080p" class="nav-tab">1080p HD</a>
            </nav>
        </div>
    </header>

    <div class="banner">
        <div class="banner-img ad-space" id="adBannerHeader" style="border: none;"></div>
    </div>

    <main class="dir-container">
        <nav class="breadcrumb-nav" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span class="sep">›</span>
            <span class="current" aria-current="page">Complete HD Video Directory</span>
        </nav>

        <h1 class="main-seo-title">Complete US &amp; European HD Video Directory</h1>
        <p class="main-seo-desc">Browse all ${categories.length} curated 1080p Full HD categories, 6 European native-language hubs, and our latest indexed US &amp; EU releases below. Every stream is optimized for instant HTML5 mobile and desktop playback.</p>

        <section class="dir-section" aria-label="European Native Language Hubs">
            <h2>European Native-Language Editions</h2>
            <div class="dir-cat-grid">
                <a href="/" class="dir-cat-card" hreflang="en">
                    <span class="dir-cat-name">English (US / UK)</span>
                    <span class="dir-cat-badge">US/UK</span>
                </a>
${euHubsHtml}
            </div>
        </section>

        <section class="dir-section" aria-label="All Video Categories A-Z">
            <h2>All ${categories.length} International Categories (A–Z)</h2>
            <div class="dir-cat-grid">
${categoriesHtml}
            </div>
        </section>

<script async="async" data-cfasync="false" src="https://biomanos.org/21/0dae6421659ccec66a169a9192f11484"></script>
<div id="container-0dae6421659ccec66a169a9192f11484"></div>

        <section class="dir-section" aria-label="Latest Trending Videos Archive" style="margin-top: 24px;">
            <h2>Latest Featured US &amp; European HD Videos (${videos.length} Direct Streams)</h2>
            <ul class="dir-video-list">
${videosHtml}
            </ul>
        </section>

        <div class="ad-space" id="adBannerContent" style="margin: 16px auto 0; background: transparent; border: none; text-align: center;"></div>
    </main>

    <footer class="footer">
        <div class="footer-links">
            <a href="/">Home</a>
            <a href="/trending">Top 100 US &amp; EU</a>
            <a href="/directory">Video Directory</a>
            <a href="/de">Deutsch</a>
            <a href="/fr">Français</a>
            <a href="/es">Español</a>
            <a href="/it">Italiano</a>
            <a href="/nl">Nederlands</a>
            <a href="/pl">Polski</a>
            <a href="/about">About Us</a>
            <a href="/howto">Streaming Guide</a>
            <a href="/contact">Contact</a>
            <a href="/dmca">DMCA &amp; 2257</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
        </div>
        <p>All resources are shared by their respective owners. &copy; 2026 kumpulenak</p>
    </footer>

    <script src="/assets/js/loader.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>
`;

    fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
    console.log(`✅ Generated /directory.html (${categories.length} categories, ${videos.length} US/EU videos) & category-keyed related-pool.json (${Object.keys(relatedPoolData.categories).length} categories).`);
}

if (require.main === module) {
    generateDirectoryPage();
}

module.exports = { generateDirectoryPage };
