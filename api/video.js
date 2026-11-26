'use strict';

const fs = require('fs');
const path = require('path');

// Cache templates in memory across warm serverless invocations
let videoTemplate = null;
const COMPACT_404_HTML = '<!DOCTYPE html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404 Video Not Found — kumpulenak</title><meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="/assets/css/gallery.css?v=5.5.2"></head><body><header class="header"><div class="header-inner"><a href="/" class="logo">kumpul<span>enak</span></a><nav class="page-nav" style="display:flex;gap:12px;"><a href="/" class="nav-back">Home</a><a href="/trending" class="nav-back">Top 100</a><a href="/directory" class="nav-back">Categories</a></nav></div></header><main class="video-page-container"><div class="error-state"><h2>404 — Video Not Found</h2><p>This video is unavailable or has been removed.</p><a href="/" class="back-btn">← Back to Home</a></div></main></body></html>';

function getVideoTemplate() {
    if (!videoTemplate) {
        const videoPath = path.join(__dirname, '..', 'video.html');
        videoTemplate = fs.existsSync(videoPath) ? fs.readFileSync(videoPath, 'utf8') : '';
    }
    return videoTemplate;
}

const HARMFUL_SUBSTRINGS = [
    'underage', 'preteen', 'jailbait', 'barely legal',
    'young girl', 'young boy', 'college girl', 'high school',
    'schoolgirl', 'school boy', 'school girl', 'child', 'minor',
    'teenager', 'loli', 'lolita', 'shota', 'pedophil',
    'esema', 'esemaa', 'bocil', 'pramuka', 'anak sd', 'anak smp', 'anak sma',
    'ibu ayah', 'orang tua', 'pelajar', 'siswi', 'perkosa', 'pemerkosaan',
    'dipaksa', 'kesakitan', 'menangis', 'nangis', 'sampe nangi',
    'non-consensual', 'forced sex', 'raped', 'raping', 'sedarah',
    'bestiality', 'zoophilia', 'animal sex', 'dead body', 'necro',
    'snuff', 'torture', 'drugged', 'unconscious', 'sleeping pill',
    'mabuk berat', 'pingsan', 'onlyfans leak', 'leaked tape'
];

const HARMFUL_WORD_REGEX = /\b(teen|teens|kid|kids|school|student|students|abg|sma|smp|smk|bocah|bocil|anak|anaknya|keponakan|kandung|adek|adik|paksa|rape|incest|loli|shota|minor|minors|underage|child|children|preteen|perkosa|sedarah)\b/i;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&quot;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
}

function repairMojibake(value) {
    let text = String(value || '');
    const score = candidate => (candidate.match(/[\u00C2-\u00F4][\u0080-\u00BF]|\uFFFD/g) || []).length;
    for (let pass = 0; pass < 3; pass++) {
        if (score(text) === 0 || [...text].some(char => char.codePointAt(0) > 255)) break;
        const repaired = Buffer.from(text, 'latin1').toString('utf8');
        if (score(repaired) >= score(text)) break;
        text = repaired;
    }
    return text.replace(/\u00C2+/g, ' ').replace(/\u00A0+/g, ' ');
}

function cleanFancyText(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = repairMojibake(decodeHtmlEntities(text));
    clean = clean.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
    clean = clean.replace(/[\uD835][\uDC00-\uDFFF]/g, ' ');
    clean = clean.normalize('NFC')
        .replace(/[\u0316-\u036F\u0483-\u0489\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/g, '')
        .replace(/[\u0300-\u0315]{2,}/g, '');
    clean = clean.replace(/\s*\d+(?:\.\d+)?[KMB]?\s*\d+\s*(?:sec(?:ond)?s?|min(?:ute)?s?|hours?|days?|weeks?|months?|years?)\s*ago\b.*$/i, '');
    clean = clean.replace(/\.(?:mp4|mkv|avi|mov|wmv|flv|webm)\b/gi, '');
    return clean.replace(/\s+/g, ' ').trim();
}

function isHarmfulVideo(video) {
    if (!video) return false;
    const rawTitle = String(video.title || video.name || '');
    const cleaned = cleanFancyText(rawTitle).toLowerCase();
    const kw = String(video.keywords || '').toLowerCase();
    const combined = `${cleaned} ${rawTitle.toLowerCase()} ${kw}`;
    for (const sub of HARMFUL_SUBSTRINGS) {
        if (combined.includes(sub)) return true;
    }
    return HARMFUL_WORD_REGEX.test(combined);
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
    "60-fps","ai","amateur","american","anal","asian","asmr","babe","bbw","bdsm","big-ass",
    "big-dick","big-tits","bisexual","blonde","blowjob","bondage","british","brunette","bukkake",
    "casting","compilation","cosplay","couple","creampie","cuckold","cumshot","czech","dance",
    "doctor","double-penetration","ebony","european","fat","fetish","fisting","footjob","for-women",
    "french","german","gloryhole","group-sex","handjob","hardcore","hd-porn-1080p","hd-sex","hentai",
    "homemade","hotel","hotwife","housewives","hq-porn","indian","indonesia","interracial","italian",
    "japanese","latina","lesbian","lingerie","live-cam","massage","masturbation","mature",
    "milf","nurses","office","older-men","orgy","outdoor","pawg","petite","pinay",
    "pornstar","pov","pregnant","public","redhead","romantic","russian","shemale","sleep","small-tits",
    "spanish","squirt","stepmom","stepsister","striptease","swinger","threesome","toys","uniform",
    "vintage","vr-porn","webcam"
]);

const POPULAR_CATEGORIES = [
    { slug: 'american', name: 'American' },
    { slug: 'european', name: 'European' },
    { slug: 'british', name: 'British' },
    { slug: 'german', name: 'German' },
    { slug: 'french', name: 'French' },
    { slug: 'amateur', name: 'Amateur' },
    { slug: 'milf', name: 'MILF' },
    { slug: 'pov', name: 'POV' },
    { slug: 'hd-porn-1080p', name: '1080p HD' },
    { slug: '60-fps', name: '60 FPS' }
];

const TAG_SYNONYMS = {
    '1080p': 'hd-porn-1080p', 'hd': 'hd-porn-1080p', 'full-hd': 'hd-porn-1080p', '4k': 'hd-porn-1080p',
    '60fps': '60-fps', 'jav': 'japanese', 'japan': 'japanese', 'hispanic': 'latina', 'latin': 'latina',
    'black': 'ebony', 'african': 'ebony', 'cougar': 'milf', 'mom': 'milf', 'mother': 'milf',
    'boobs': 'big-tits', 'busty': 'big-tits', 'tits': 'big-tits', 'booty': 'big-ass', 'ass': 'big-ass',
    'cam': 'webcam', 'camgirl': 'webcam', 'livecam': 'live-cam', 'wife': 'hotwife', 'couples': 'couple',
    'babes': 'babe', 'model': 'babe', 'vr': 'vr-porn', 'virtual-reality': 'vr-porn', 'indo': 'indonesia',
    'euro': 'european', 'europe': 'european', 'uk': 'british', 'england': 'british', 'english': 'british',
    'deutsch': 'german', 'germany': 'german', 'francais': 'french', 'france': 'french',
    'espanol': 'spanish', 'spain': 'spanish', 'italiano': 'italian', 'italy': 'italian',
    'usa': 'american', 'america': 'american', 'prague': 'czech', 'sensual': 'romantic', 'passionate': 'romantic'
};

function resolveTagCategory(rawTag) {
    const s = slugify(rawTag);
    if (!s) return null;
    if (KNOWN_CATEGORIES.has(s)) return s;
    if (TAG_SYNONYMS[s]) return TAG_SYNONYMS[s];
    for (const p of s.split('-')) {
        if (KNOWN_CATEGORIES.has(p)) return p;
        if (TAG_SYNONYMS[p]) return TAG_SYNONYMS[p];
    }
    return null;
}

function buildSeoTitle(rawTitle, categoryName, durationMin) {
    const clean = cleanFancyText(rawTitle || 'Trending HD Video');
    const targetMax = 60;
    const durSuffix = durationMin ? ` (${durationMin} HD)` : ' - 1080p HD';
    if ((clean + durSuffix).length <= targetMax) return clean + durSuffix;
    const catSuffix = ` | ${categoryName || 'HD'}`;
    if ((clean + catSuffix).length <= targetMax) return clean + catSuffix;
    if (clean.length <= targetMax) return clean;
    return clean.slice(0, targetMax - 3).trim() + '...';
}

function buildMetaDesc(rawTitle, categoryName, durationMin) {
    const clean = cleanFancyText(rawTitle || 'Trending Video');
    const catLabel = categoryName || 'Adult';
    const durLabel = durationMin ? ` (${durationMin})` : '';
    const base = `Watch ${clean}${durLabel} in 1080p Full HD free. Instant ${catLabel} HTML5 streaming across USA, UK & Europe with zero sign-up.`;
    return base.length > 158 ? base.slice(0, 155).trim() + '...' : base;
}

function buildProgrammaticEditorial(title, primaryCatName, durationMin, uploadISO, viewsCount, ratingVal, tagNames) {
    const topTags = (tagNames || []).slice(0, 4).join(', ') || primaryCatName;
    const summary1 = `Stream ${title} in 1080p Full HD on kumpulenak. Cataloged under ${primaryCatName}, this ${durationMin} release (${uploadISO}) has ${viewsCount} views and a ${ratingVal}/5 rating across viewers in the USA, UK, and Europe.`;
    const faq = [
        {
            question: `What is the runtime and quality of "${title}"?`,
            answer: `"${title}" runs ${durationMin} and streams free in adaptive HTML5 up to 1080p Full HD on iOS, Android, and desktop.`
        },
        {
            question: `Which category and tags match "${title}"?`,
            answer: `This clip belongs to ${primaryCatName} (${topTags}). Browse more free 1080p HD releases in our ${primaryCatName} hub or Top 100 US & EU chart.`
        }
    ];
    return { summary1, faq };
}

// In-Memory Rendered HTML Cache (Warm Lambdas — avoids redundant API + template CPU)
const htmlCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_CACHE_ENTRIES = 800;

let staticRelatedPool = null;
function getStaticRelatedPool() {
    if (staticRelatedPool === null) {
        try {
            const p = path.join(__dirname, '..', 'data', 'related-pool.json');
            staticRelatedPool = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { categories: {}, all: [] };
        } catch {
            staticRelatedPool = { categories: {}, all: [] };
        }
    }
    return staticRelatedPool;
}

function getRelatedVideos(categorySlug, currentId) {
    const rawPool = getStaticRelatedPool();
    const isStructured = rawPool && !Array.isArray(rawPool) && Array.isArray(rawPool.all);
    const catList = (isStructured && rawPool.categories && Array.isArray(rawPool.categories[categorySlug]))
        ? rawPool.categories[categorySlug].filter(v => v && v.id !== currentId && !isHarmfulVideo(v))
        : [];
    const allList = (isStructured ? rawPool.all : (Array.isArray(rawPool) ? rawPool : []))
        .filter(v => v && v.id !== currentId && !isHarmfulVideo(v));

    const picked = catList.slice(0, 6);
    if (picked.length >= 6) return picked;

    const seen = new Set(picked.map(v => v.id));
    let hash = 0;
    const seed = String(currentId || categorySlug || 'default');
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    const start = allList.length > 0 ? Math.abs(hash) % allList.length : 0;
    for (let i = 0; i < allList.length && picked.length < 6; i++) {
        const c = allList[(start + i) % allList.length];
        if (!seen.has(c.id)) {
            seen.add(c.id);
            picked.push(c);
        }
    }
    return picked;
}

function renderRelatedCardsHtml(videos) {
    if (!videos || !videos.length) return '';
    return videos.map(v => {
        const rawTitle = cleanFancyText(v.title || 'Untitled Video');
        const safeTitle = escapeHtml(rawTitle);
        const slug = slugify(rawTitle);
        const cardUrl = `/v/${v.id}${slug ? '-' + slug : ''}`;
        const thumb = (v.default_thumb && v.default_thumb.src) ? v.default_thumb.src : '';
        const views = v.views ? Number(v.views).toLocaleString('en-US') : '0';
        const added = v.added ? v.added.slice(0, 10) : '';
        const duration = v.length_min || '';
        const rate = v.rate || '';
        const badges = (duration ? `<span class="badge-duration">${escapeHtml(duration)}</span>` : '') +
            (rate ? `<span class="badge-rating">⭐ ${escapeHtml(String(rate))}</span>` : '');
        return `<a href="${escapeHtml(cardUrl)}" class="card" aria-label="${safeTitle}"><div class="card-img-wrapper">${badges}<img src="${escapeHtml(thumb)}" alt="${safeTitle}" width="360" height="202" loading="lazy" decoding="async" class="loaded"></div><div class="card-meta"><div class="card-date-views"><span class="card-date">📅 ${escapeHtml(added)}</span><span class="card-views">👁 ${escapeHtml(views)}</span></div><h3 class="card-title">${safeTitle}</h3></div></a>`;
    }).join('');
}

let enrichedDb = null;
function getEnrichedData(id) {
    if (enrichedDb === null) {
        try {
            const p = path.join(__dirname, '..', 'data', 'enriched-videos.json');
            enrichedDb = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
        } catch {
            enrichedDb = {};
        }
    }
    const item = enrichedDb[id];
    return (item && item.status === 'enriched') ? item : null;
}

function send404(res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=604800');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=604800');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(404).send(COMPACT_404_HTML);
}

function send200(res, html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=2592000');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=2592000');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(html);
}

const CATEGORY_PILLS_HTML = [
    '<a href="/trending" class="video-tag video-tag-hot">🔥 Top 100 US &amp; EU</a>',
    '<a href="/directory" class="video-tag video-tag-dir">📂 All 95 Categories</a>',
    ...POPULAR_CATEGORIES.map(c => `<a href="/category/${c.slug}" class="video-tag">${escapeHtml(c.name)}</a>`)
].join('');

module.exports = async function handler(req, res) {
    const rawVideoTpl = getVideoTemplate();
    const siteUrl = 'https://www.kumpulenak.my.id';

    const urlPath = req.url ? req.url.split('?')[0] : '';
    const querySlug = req.query ? (req.query.slug || req.query.path || req.query.id) : '';
    const candidate = querySlug || urlPath.replace(/^\/v\//, '') || '';

    const idMatch = candidate.match(/^([A-Za-z0-9]{6,32})(?:-|$)/);
    const videoId = idMatch ? idMatch[1] : null;

    if (!videoId) {
        return send404(res);
    }

    // Serve directly from warm Lambda rendered HTML cache (0ms CPU!)
    const cached = htmlCache.get(videoId);
    if (cached && Date.now() < cached.expires) {
        if (cached.notFound) return send404(res);
        // Check if enriched DB changed during tests
        const currentEnriched = getEnrichedData(videoId);
        if (Boolean(currentEnriched) === cached.wasEnriched) {
            return send200(res, cached.html);
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const apiUrl = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(videoId)}&format=json`;
        const apiRes = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!apiRes.ok) throw new Error(`API status ${apiRes.status}`);
        const data = await apiRes.json();

        if (!data || data.error || (Array.isArray(data) && data.length === 0) || !data.id || isHarmfulVideo(data)) {
            if (htmlCache.size >= MAX_CACHE_ENTRIES) htmlCache.delete(htmlCache.keys().next().value);
            htmlCache.set(videoId, { notFound: true, expires: Date.now() + NEGATIVE_CACHE_TTL_MS });
            return send404(res);
        }

        let primaryCatSlug = 'amateur';
        let primaryCatName = 'Amateur';
        const cleanTagList = [];
        if (data.keywords) {
            const rawTags = typeof data.keywords === 'string'
                ? data.keywords.split(',').map(t => t.trim())
                : (Array.isArray(data.keywords) ? data.keywords : []);
            for (const t of rawTags) {
                if (!t || isHarmfulVideo({ title: t })) continue;
                cleanTagList.push(t);
                const s = slugify(t);
                if (primaryCatSlug === 'amateur' && KNOWN_CATEGORIES.has(s)) {
                    primaryCatSlug = s;
                    primaryCatName = t.charAt(0).toUpperCase() + t.slice(1);
                }
            }
        }

        const durationSec = Math.max(0, Math.floor(Number(data.length_sec) || 0));
        const durationMin = data.length_min || `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
        const viewsCount = data.views ? Number(data.views).toLocaleString('en-US') : '0';
        const ratingVal = data.rate || '4.5';

        let uploadISO = new Date().toISOString().slice(0, 10);
        if (data.added) {
            const m = data.added.match(/^(\d{4}-\d{2}-\d{2})/);
            if (m) uploadISO = m[1];
        }

        const enriched = getEnrichedData(data.id);
        const title = cleanFancyText(data.title || 'Trending Video');
        const safeTitle = escapeHtml(title);
        const seoTitle = enriched ? enriched.seo_title : buildSeoTitle(title, primaryCatName, durationMin);
        const safeSeoTitle = escapeHtml(seoTitle);
        const desc = enriched ? enriched.meta_description : buildMetaDesc(title, primaryCatName, durationMin);
        const safeDesc = escapeHtml(desc);
        const slug = slugify(title);
        const finalSlug = `${data.id}${slug ? '-' + slug : ''}`;
        const canonicalUrl = `${siteUrl}/v/${finalSlug}`;

        const relatedVideos = getRelatedVideos(primaryCatSlug, data.id);
        const thumbUrl = (data.default_thumb && data.default_thumb.src) ? data.default_thumb.src : `${siteUrl}/assets/icons/og-image.png`;
        const embedUrl = data.embed || `https://www.eporner.com/embed/${data.id}/`;

        const programmatic = buildProgrammaticEditorial(title, primaryCatName, durationMin, uploadISO, viewsCount, ratingVal, cleanTagList);
        const activeFaq = (enriched && Array.isArray(enriched.faq) && enriched.faq.length > 0) ? enriched.faq : programmatic.faq;

        // Compact minified JSON-LD (@graph: BreadcrumbList + VideoObject + FAQPage — no regionsAllowed restriction)
        const jsonLdGraph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${siteUrl}/` },
                        { "@type": "ListItem", "position": 2, "name": primaryCatName, "item": `${siteUrl}/category/${primaryCatSlug}` },
                        { "@type": "ListItem", "position": 3, "name": title, "item": canonicalUrl }
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
                    "url": canonicalUrl,
                    "genre": primaryCatName,
                    "keywords": cleanTagList.slice(0, 10).join(', '),
                    "contentRating": "18+",
                    "isFamilyFriendly": false,
                    "inLanguage": "en",
                    "publisher": {
                        "@type": "Organization",
                        "name": "kumpulenak",
                        "url": siteUrl,
                        "logo": { "@type": "ImageObject", "url": `${siteUrl}/assets/icons/android-chrome-512x512.png`, "width": 512, "height": 512 }
                    },
                    "interactionStatistic": {
                        "@type": "InteractionCounter",
                        "interactionType": { "@type": "WatchAction" },
                        "userInteractionCount": Number(data.views || 0)
                    }
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": activeFaq.map(f => ({
                        "@type": "Question",
                        "name": f.question,
                        "acceptedAnswer": { "@type": "Answer", "text": f.answer }
                    }))
                }
            ]
        };

        const tagsHtml = cleanTagList.slice(0, 12).map(tag => {
            const matchedCat = resolveTagCategory(tag);
            if (matchedCat) return `<a href="/category/${matchedCat}" class="video-tag">${escapeHtml(tag)}</a>`;
            return `<span class="video-tag video-tag-btn" role="button" tabindex="0" onclick="window.location.href='/?q=${encodeURIComponent(tag)}'">${escapeHtml(tag)}</span>`;
        }).join('');

        const faqHtml = `<div class="video-faq"><h2>FAQ</h2>${activeFaq.map(f => `<div class="faq-item"><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`).join('')}</div>`;
        const specsHtml = `<div class="video-specs"><div><strong>Category</strong><a href="/category/${escapeHtml(primaryCatSlug)}">${escapeHtml(primaryCatName)}</a></div><div><strong>Runtime</strong><span>${escapeHtml(durationMin)}</span></div><div><strong>Quality</strong><span>1080p HD</span></div><div><strong>Rating</strong><span>⭐ ${escapeHtml(String(ratingVal))}/5</span></div></div>`;

        const editorialHtml = enriched
            ? `<div class="video-editorial-enriched">${enriched.summary ? `<p class="video-summary">${escapeHtml(enriched.summary)}</p>` : ''}${enriched.highlights && enriched.highlights.length ? `<div class="video-highlights"><h3>Key Highlights</h3><ul>${enriched.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>` : ''}${faqHtml}</div>`
            : `<div class="video-editorial-enriched"><p class="video-summary">${escapeHtml(programmatic.summary1)}</p>${faqHtml}</div>`;

        const preRenderedContainer =
            `<nav class="breadcrumb-nav" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">›</span><a href="/category/${escapeHtml(primaryCatSlug)}">${escapeHtml(primaryCatName)}</a><span class="sep">›</span><span class="current" aria-current="page">${safeTitle.slice(0, 45)}${safeTitle.length > 45 ? '...' : ''}</span></nav>` +
            `<a href="/" class="back-btn">← Back to Home</a>` +
            `<div class="video-wrapper"><iframe id="videoPlayer" src="${escapeHtml(embedUrl)}" width="1280" height="720" frameborder="0" allowfullscreen="true" scrolling="no" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>` +
            `<div class="video-details"><h1 class="video-title">${safeTitle}</h1>` +
            `<div class="video-meta"><span>⏱ ${escapeHtml(durationMin)}</span><span>👁 ${viewsCount} views</span><span>⭐ ${escapeHtml(String(ratingVal))}</span><span>📅 ${escapeHtml(uploadISO)}</span></div>` +
            `${specsHtml}${tagsHtml ? `<div class="video-tags">${tagsHtml}</div>` : ''}${editorialHtml}` +
            `<div class="video-popular-categories"><span class="video-popular-label">Explore Categories:</span><div class="video-tags">${CATEGORY_PILLS_HTML}</div></div></div>`;

        const watchHreflang =
            `<link rel="canonical" href="${canonicalUrl}">` +
            `<link rel="alternate" hreflang="en" href="${canonicalUrl}">` +
            `<link rel="alternate" hreflang="en-US" href="${canonicalUrl}">` +
            `<link rel="alternate" hreflang="en-GB" href="${canonicalUrl}">` +
            `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`;

        let html = rawVideoTpl;
        html = html.replace(/<title>.*?<\/title>/s, `<title>${safeSeoTitle}</title>`);
        html = html.replace(/<meta name="description"[\s\S]*?>/s, `<meta name="description" content="${safeDesc}">`);
        html = html.replace(/<meta name="robots"[\s\S]*?>/s, `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`);
        html = html.replace(/<link rel="canonical"[\s\S]*?>/s, watchHreflang);
        html = html.replace(/<meta id="ogTitle" property="og:title" content=".*?">/s, `<meta property="og:locale" content="en_US"><meta property="og:locale:alternate" content="en_GB"><meta id="ogTitle" property="og:title" content="${safeSeoTitle}">`);
        html = html.replace(/<meta id="ogDesc" property="og:description" content=".*?">/s, `<meta id="ogDesc" property="og:description" content="${safeDesc}">`);
        html = html.replace(/<meta id="ogImage" property="og:image" content=".*?">/s, `<meta id="ogImage" property="og:image" content="${escapeHtml(thumbUrl)}">`);
        html = html.replace(/<meta id="ogImageAlt" property="og:image:alt" content=".*?">/s, `<meta id="ogImageAlt" property="og:image:alt" content="${safeTitle} 1080p HD">`);
        html = html.replace(/<meta id="ogUrl" property="og:url" content=".*?">/s, `<meta id="ogUrl" property="og:url" content="${canonicalUrl}">`);
        html = html.replace(/<meta id="ogVideo" property="og:video" content=".*?">/s, `<meta id="ogVideo" property="og:video" content="${escapeHtml(embedUrl)}">`);
        html = html.replace(/<meta name="twitter:title" content=".*?">/s, `<meta name="twitter:title" content="${safeSeoTitle}">`);
        html = html.replace(/<meta name="twitter:description" content=".*?">/s, `<meta name="twitter:description" content="${safeDesc}">`);
        html = html.replace(/<meta id="twitterImage" name="twitter:image" content=".*?">/s, `<meta id="twitterImage" name="twitter:image" content="${escapeHtml(thumbUrl)}">`);
        html = html.replace('<script id="jsonLdScript" type="application/ld+json"></script>', `<script id="jsonLdScript" type="application/ld+json">${JSON.stringify(jsonLdGraph)}</script>`);
        html = html.replace('<div class="loader" id="videoLoader"></div>', preRenderedContainer);

        if (relatedVideos.length > 0) {
            const similarHtml = `<div class="video-page-container" id="similarVideosSection" style="margin-top:40px;display:block;"><h2 class="similar-title">Related Videos</h2><div class="card-grid" id="similarVideoGrid">${renderRelatedCardsHtml(relatedVideos)}</div></div>`;
            html = html.replace(/<!-- ===== SIMILAR VIDEOS ===== -->[\s\S]*?<div class="card-grid" id="similarVideoGrid"><\/div>\s*<\/div>/, similarHtml);
        }

        if (htmlCache.size >= MAX_CACHE_ENTRIES) htmlCache.delete(htmlCache.keys().next().value);
        htmlCache.set(videoId, { html, wasEnriched: Boolean(enriched), expires: Date.now() + CACHE_TTL_MS });

        return send200(res, html);
    } catch {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, no-cache');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        res.status(200).send(rawVideoTpl);
    }
};
