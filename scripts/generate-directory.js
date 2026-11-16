'use strict';

const fs = require('fs');
const path = require('path');
const { cleanVideoTitle, isHarmfulContent, isInternationalFriendly } = require('./content-filter');

const ROOT_DIR = path.join(__dirname, '..');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const GALLERY_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'gallery.js');
const OUTPUT_PATH = path.join(ROOT_DIR, 'directory.html');
const BASE_URL = 'https://www.kumpulenak.my.id';

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
        .reverse(); // Newest shards first

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
            if (!isInternationalFriendly({ title: cleanedTitle })) continue;

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

function generateDirectoryPage() {
    console.log('📂 Generating /directory.html (HTML Sitemap & International Video Directory)...');
    const categories = loadCategories();
    const videos = extractCleanVideosFromShards(160);

    // Save static related videos pool so api/video.js needs ZERO extra external API calls on Vercel Free Tier
    const relatedPoolPath = path.join(ROOT_DIR, 'data', 'related-pool.json');
    const relatedPool = videos.slice(0, 48).map(v => ({
        id: v.id,
        title: v.title,
        added: v.date,
        length_min: v.duration,
        rate: '4.6',
        views: 12500,
        default_thumb: { src: v.thumb }
    }));
    fs.writeFileSync(relatedPoolPath, JSON.stringify(relatedPool, null, 2), 'utf8');

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
                'name': 'Full HD Adult Video Directory & 85+ International Categories | kumpulenak',
                'description': 'Browse the complete A-Z index of 85+ international HD video categories and latest trending viral releases on kumpulenak.',
                'url': `${BASE_URL}/directory`,
                'inLanguage': 'en'
            }
        ]
    };

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
    <title>Complete HD Video Directory &amp; All 85+ Categories | kumpulenak</title>
    <meta name="description" content="Explore the complete A-Z directory of 85+ full HD 1080p adult video categories and trending international video archives on kumpulenak.">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta name="rating" content="adult">
    <meta name="language" content="English">

    <link rel="canonical" href="https://www.kumpulenak.my.id/directory">
    <link rel="alternate" hreflang="en" href="https://www.kumpulenak.my.id/directory">
    <link rel="alternate" hreflang="x-default" href="https://www.kumpulenak.my.id/directory">

    <meta property="og:locale" content="en_US">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="kumpulenak">
    <meta property="og:title" content="Complete HD Video Directory &amp; All 85+ Categories | kumpulenak">
    <meta property="og:description" content="Explore the complete A-Z directory of 85+ full HD 1080p adult video categories and trending international video archives on kumpulenak.">
    <meta property="og:url" content="https://www.kumpulenak.my.id/directory">
    <meta property="og:image" content="https://www.kumpulenak.my.id/assets/icons/og-image.png">

    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">
    <link rel="manifest" href="/assets/icons/site.webmanifest">

    <link rel="stylesheet" href="/assets/css/gallery.css?v=5.4.0">
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
            <div class="logo" onclick="window.location='/'">kumpul<span>enak</span></div>
            <nav class="nav-tabs">
                <a href="/" class="nav-tab" style="text-decoration:none;">Popular</a>
                <a href="/directory" class="nav-tab active" style="text-decoration:none;">Directory</a>
                <a href="/category/hd-porn-1080p" class="nav-tab" style="text-decoration:none;">1080p HD</a>
            </nav>
        </div>
    </header>

    <div class="banner">
        <div class="banner-img ad-space" id="adBannerHeader" style="border: none;"></div>
    </div>
    <div class="banner" style="padding-top: 0;">
        <div class="banner-custom" id="adBannerCustom"></div>
    </div>

    <main class="dir-container">
        <nav class="breadcrumb-nav" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span class="sep">›</span>
            <span class="current" aria-current="page">Complete HD Video Directory</span>
        </nav>

        <h1 class="main-seo-title">Complete HD Video Directory &amp; International Categories</h1>
        <p class="main-seo-desc">Browse all ${categories.length} curated full HD 1080p categories and explore our latest indexed international video releases below. Every stream is optimized for instant mobile and desktop playback.</p>

        <section class="dir-section" aria-label="All Video Categories A-Z">
            <h2>All ${categories.length} International Categories (A–Z)</h2>
            <div class="dir-cat-grid">
${categoriesHtml}
            </div>
        </section>

<script async="async" data-cfasync="false" src="https://biomanos.org/21/0dae6421659ccec66a169a9192f11484"></script>
<div id="container-0dae6421659ccec66a169a9192f11484"></div>

        <section class="dir-section" aria-label="Latest Trending Videos Archive" style="margin-top: 24px;">
            <h2>Latest Featured International HD Videos (${videos.length} Direct Streams)</h2>
            <ul class="dir-video-list">
${videosHtml}
            </ul>
        </section>

        <div class="ad-space" id="adBannerContent" style="margin: 16px auto 0; background: transparent; border: none; text-align: center;"></div>
    </main>

    <footer class="footer">
        <div class="footer-links">
            <a href="/">Home</a>
            <a href="/directory">Video Directory</a>
            <a href="/about">About Us</a>
            <a href="/howto">How to Download</a>
            <a href="/contact">Contact</a>
            <a href="/dmca">DMCA</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
        </div>
        <p>All resources are shared by their respective owners. &copy; 2026 kumpulenak</p>
    </footer>

    <script src="/assets/js/loader.js?v=5.4.0" defer></script>
</body>
</html>
`;

    fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
    console.log(`✅ Generated /directory.html with ${categories.length} categories and ${videos.length} direct video links.`);
}

if (require.main === module) {
    generateDirectoryPage();
}

module.exports = { generateDirectoryPage };
