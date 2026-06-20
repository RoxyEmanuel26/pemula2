const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION & METADATA OVERRIDES
// ============================================================================

const CUSTOM_METADATA = {
    'amateur': { title: 'Amateur & Homemade Adult Videos', desc: 'Watch the best amateur and homemade adult videos. Real couples and authentic action.' },
    'babe': { title: 'Hot Babes & Beautiful Girls', desc: 'Stream HD videos featuring the hottest babes, beautiful models, and stunning girls.' },
    'milf': { title: 'Premium MILF & Cougar Videos', desc: 'Browse our exclusive collection of MILF and mature women adult videos in full HD.' },
    'pov': { title: 'Immersive POV Adult Videos', desc: 'Experience the action firsthand with our top-rated Point of View (POV) videos.' },
    'blonde': { title: 'Hot Blonde Babes Videos', desc: 'Watch stunning blonde babes and gorgeous models in high quality HD.' },
    'ebony': { title: 'Beautiful Ebony Stars', desc: 'Discover beautiful ebony stars and hot black babes in premium adult scenes.' },
    'latina': { title: 'Hot Latina & Hispanic Babes', desc: 'Enjoy passionate adult videos featuring gorgeous Latina and Hispanic babes.' },
    'dance': { title: 'Hot Dance & Twerk Videos', desc: 'Watch sensual dance, twerk, and striptease videos in full high definition.' },
    'outdoor': { title: 'Public & Outdoor Sex Videos', desc: 'Thrilling outdoor and public sex adult videos for your viewing pleasure.' },
    'big-ass': { title: 'Big Ass & Booty Videos', desc: 'The best collection of big ass and huge booty adult videos on the web.' },
    'big-tits': { title: 'Big Tits & Busty Babes', desc: 'Stream HD videos of busty babes and big tits models.' },
    'couple': { title: 'Real Couples & Passionate Sex', desc: 'Watch real couples making love and passionate adult scenes.' },
    'cosplay': { title: 'Cosplay & Costume Roleplay', desc: 'Exciting cosplay, uniform, and costume roleplay adult videos.' },
    'live-cam': { title: 'Live Cam Shows & Recordings', desc: 'Recorded live cam shows and intimate webcam adult videos.' },
    'mature': { title: 'Mature Women & Older Ladies', desc: 'Premium adult videos featuring beautiful mature women and older ladies.' }
};

const API_BASE = 'https://www.eporner.com/api/v2/video/search/';
const API_PARAMS = {
    per_page: '24',
    page: '1',
    thumbsize: 'big',
    order: 'most-popular',
    gay: '0',
    lq: '1',
    format: 'json'
};

const HARMFUL_KEYWORDS = [
    'teen', 'teenager', 'underage', 'minor', 'child', 'kid',
    'young girl', 'young boy', 'loli', 'shota', 'preteen',
    'onlyfans', 'leaked', 'leak', 'student', 'school',
    'college girl', 'high school', 'jailbait', 'barely legal'
];

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

function cleanFancyText(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.replace(/[\uD835][\uDC00-\uDFFF]/g, ' '); 
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
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

function isHarmfulVideo(video) {
    const title = (video.title || video.name || '').toLowerCase();
    const keywords = (video.keywords || '').toLowerCase();
    const combined = title + ' ' + keywords;
    return HARMFUL_KEYWORDS.some(kw => combined.includes(kw));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log("Fetching: " + url + " (Attempt " + (i + 1) + "/" + retries + ")");
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error("HTTP error! status: " + response.status);
            }
            
            const data = await response.json();
            if (!data || !Array.isArray(data.videos)) {
                throw new Error('Invalid API response structure');
            }
            
            return data;
        } catch (error) {
            console.warn("Attempt " + (i + 1) + " failed: " + error.message);
            if (i === retries - 1) {
                console.error("All " + retries + " attempts failed for " + url);
                return null;
            }
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

async function fetchCategoryVideos(query) {
    const params = new URLSearchParams({ ...API_PARAMS, query });
    const url = API_BASE + "?" + params.toString();
    const data = await fetchWithRetry(url);
    
    if (!data) return [];
    
    return data.videos.filter(v => !isHarmfulVideo(v)).slice(0, 24);
}

function generateCardHTML(video) {
    const title = cleanFancyText(video.title || 'Untitled');
    const safeTitle = escapeHTML(title);
    const slug = title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().substring(0, 80);
    const videoUrl = "/v/" + video.id + "-" + slug;
    const thumbUrl = (video.default_thumb && isSafeUrl(video.default_thumb.src)) ? video.default_thumb.src : '';
    const views = video.views ? video.views.toLocaleString('en-US') : '0';
    const added = video.added ? video.added.slice(0, 10) : '';
    const length = video.length_min || '';
    const rate = video.rate || '';

    let badges = '';
    if (length) badges += "<span class=\"badge-duration\">" + escapeHTML(length) + "</span>";
    if (rate) badges += "<span class=\"badge-rating\">⭐ " + escapeHTML(rate) + "</span>";

    return "" +
    "<a href=\"" + escapeHTML(videoUrl) + "\" class=\"card\" aria-label=\"" + safeTitle + "\">\n" +
    "    <div class=\"card-img-wrapper\">\n" +
    "        " + badges + "\n" +
    "        <img src=\"" + escapeHTML(thumbUrl) + "\" alt=\"" + safeTitle + " thumbnail\" loading=\"lazy\" onload=\"this.classList.add('loaded')\" onerror=\"this.classList.add('loaded'); this.style.background='#333';\">\n" +
    "    </div>\n" +
    "    <div class=\"card-meta\">\n" +
    "        <div class=\"card-date-views\">\n" +
    "            <span class=\"card-date\">📅 " + escapeHTML(added) + "</span>\n" +
    "            <span class=\"card-views\">👁 " + escapeHTML(views) + "</span>\n" +
    "        </div>\n" +
    "        <h3 class=\"card-title\">" + safeTitle + "</h3>\n" +
    "    </div>\n" +
    "</a>";
}

function processTemplate(template, category, videos, allCategories) {
    let html = template;
    const siteUrl = 'https://www.kumpulenak.my.id';
    const categoryUrl = siteUrl + "/category/" + category.slug;
    
    html = html.replace(/<title>.*?<\/title>/s, "<title>" + category.title + " — kumpulenak Gallery</title>");
    html = html.replace(/<meta name="description"[\s\S]*?>/s, "<meta name=\"description\" content=\"" + category.desc + "\">");
    html = html.replace(/<meta property="og:title" content=".*?">/s, "<meta property=\"og:title\" content=\"" + category.title + " — kumpulenak\">");
    html = html.replace(/<meta property="og:description"[\s\S]*?>/s, "<meta property=\"og:description\" content=\"" + category.desc + "\">");
    html = html.replace(/<meta property="og:url" content=".*?">/s, "<meta property=\"og:url\" content=\"" + categoryUrl + "\">");
    html = html.replace(/<meta name="twitter:title" content=".*?">/s, "<meta name=\"twitter:title\" content=\"" + category.title + "\">");
    html = html.replace(/<meta name="twitter:description"[\s\S]*?>/s, "<meta name=\"twitter:description\" content=\"" + category.desc + "\">");
    html = html.replace(/<link rel="canonical" href=".*?">/s, "<link rel=\"canonical\" href=\"" + categoryUrl + "\">");
    
    const breadcrumbLd = "\n" +
    "    <!-- Category Breadcrumb -->\n" +
    "    <script type=\"application/ld+json\">\n" +
    "    {\n" +
    "        \"@context\": \"https://schema.org\",\n" +
    "        \"@type\": \"BreadcrumbList\",\n" +
    "        \"itemListElement\": [\n" +
    "            { \"@type\": \"ListItem\", \"position\": 1, \"name\": \"Home\", \"item\": \"" + siteUrl + "/\" },\n" +
    "            { \"@type\": \"ListItem\", \"position\": 2, \"name\": \"" + category.title + "\", \"item\": \"" + categoryUrl + "\" }\n" +
    "        ]\n" +
    "    }\n" +
    "    </script>\n" +
    "</head>";
    
    html = html.replace('</head>', breadcrumbLd);
    html = html.replace('<body>', "<body data-static-category=\"" + category.slug + "\">");
    html = html.replace(/<h1 class="main-seo-title">.*?<\/h1>/s, "<h1 class=\"main-seo-title\">" + category.title + "</h1>");
    html = html.replace(/<p class="main-seo-desc" id="mainSeoDesc">.*?<\/p>/s, "<p class=\"main-seo-desc\" id=\"mainSeoDesc\">" + category.desc + "</p>");
    html = html.replace(/<div class="section-label" id="sectionLabel">.*?<\/div>/s, "<div class=\"section-label\" id=\"sectionLabel\">" + category.title + "</div>");
    
    let cardsHtml = '';
    if (videos.length > 0) {
        cardsHtml = videos.map(generateCardHTML).join('\n                ');
    } else {
        cardsHtml = "<!-- API Fetch failed during build. gallery.js will attempt to fetch on client side -->";
    }
    
    html = html.replace(
        /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/s, 
        "<div class=\"card-grid\" id=\"cardGrid\">\n                " + cardsHtml + "\n            </div>\n\n            <!-- PAGINATION -->"
    );

    // Replace dynamic /?q= links in the static pages with proper static routing to category pages
    const navLinksRegex = /<a href="\/\?q=([a-z-]+)">.*?<\/a>/g;
    html = html.replace(navLinksRegex, (match, query) => {
        const cat = allCategories.find(c => c.query === query || c.slug === query);
        if (cat) {
            return "<a href=\"/category/" + cat.slug + "\">" + cat.title + "</a>";
        }
        return match;
    });

    return html;
}

async function main() {
    console.log('🚀 Starting Static Category Pages Generation...');
    
    if (!fs.existsSync(INDEX_HTML_PATH)) {
        console.error("❌ Cannot find index.html at " + INDEX_HTML_PATH);
        process.exit(1);
    }
    if (!fs.existsSync(GALLERY_JS_PATH)) {
        console.error("❌ Cannot find gallery.js at " + GALLERY_JS_PATH);
        process.exit(1);
    }

    // Load categories dynamically from gallery.js
    const galleryJs = fs.readFileSync(GALLERY_JS_PATH, 'utf-8');
    const match = galleryJs.match(/const KATEGORI_LIST = \[([\s\S]*?)\];/);
    if (!match) {
        console.error("❌ Failed to parse KATEGORI_LIST from gallery.js");
        process.exit(1);
    }

    const rawList = eval(`[${match[1]}]`);
    const allCategories = rawList.map(item => {
        const custom = CUSTOM_METADATA[item.slug];
        return {
            slug: item.slug,
            query: item.query,
            title: custom ? custom.title : `${item.label} Adult Videos`,
            desc: custom ? custom.desc : `Watch the best collection of ${item.label} adult videos on kumpulenak. Stream premium ${item.label} videos, hot scenes, and trending viral clips for free.`,
            label: item.label
        };
    });

    console.log(`📋 Loaded ${allCategories.length} categories from gallery.js`);
    
    const indexTemplate = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    
    for (const category of allCategories) {
        console.log("\n======================================");
        console.log("Processing Category: [" + category.title + "] (" + category.slug + ")");
        
        const videos = await fetchCategoryVideos(category.query);
        console.log("✅ Fetched " + videos.length + " videos for " + category.slug);
        
        const finalHtml = processTemplate(indexTemplate, category, videos, allCategories);
        
        const outputPath = path.join(CATEGORY_DIR, category.slug + ".html");
        fs.writeFileSync(outputPath, finalHtml, 'utf-8');
        
        console.log("💾 Saved " + outputPath);
    }
    
    console.log("\n🎉 Generation complete! " + allCategories.length + " category pages created in /category/");
}

main().catch(console.error);
