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
    { slug: 'american', name: 'American / USA' },
    { slug: 'european', name: 'European' },
    { slug: 'british', name: 'British / UK' },
    { slug: 'german', name: 'German / Deutsch' },
    { slug: 'french', name: 'French' },
    { slug: 'amateur', name: 'Amateur' },
    { slug: 'milf', name: 'MILF' },
    { slug: 'pov', name: 'POV' },
    { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
    { slug: '60-fps', name: '60 FPS' },
    { slug: 'blonde', name: 'Blonde' },
    { slug: 'latina', name: 'Latina' },
    { slug: 'ebony', name: 'Ebony' },
    { slug: 'asian', name: 'Asian' },
    { slug: 'romantic', name: 'Romantic' }
];

function buildSeoTitle(rawTitle, categoryName, durationMin) {
    const clean = cleanFancyText(rawTitle || 'Trending HD Video');
    const targetMax = 60;
    const durSuffix = durationMin ? ` (${durationMin} Full HD)` : ' - Full HD 1080p Video';
    if ((clean + durSuffix).length <= targetMax) {
        return clean + durSuffix;
    }
    const hdSuffix = ' - Full HD Video';
    if ((clean + hdSuffix).length <= targetMax) {
        return clean + hdSuffix;
    }
    const catSuffix = ` | ${categoryName || 'HD Video'}`;
    if ((clean + catSuffix).length <= targetMax) {
        return clean + catSuffix;
    }
    if (clean.length <= targetMax) {
        return clean;
    }
    return clean.slice(0, targetMax - 3).trim() + '...';
}

function buildMetaDesc(rawTitle, categoryName, durationMin) {
    const clean = cleanFancyText(rawTitle || 'Trending Video');
    const catLabel = categoryName || 'Adult';
    const durLabel = durationMin ? ` (${durationMin})` : '';
    const base = `Watch ${clean}${durLabel} in 1080p Full HD free. Instant ${catLabel} streaming across the USA, UK & Europe with fast HTML5 playback and no sign-up.`;
    if (base.length > 158) {
        return base.slice(0, 155).trim() + '...';
    }
    return base;
}

function buildProgrammaticEditorial(title, primaryCatName, primaryCatSlug, durationMin, uploadISO, viewsCount, ratingVal, tagNames) {
    const topTags = (tagNames || []).slice(0, 5).join(', ') || primaryCatName;
    const summary1 = `Stream ${title} in crystal-clear 1080p Full HD on kumpulenak. Featured in our international ${primaryCatName} collection, this ${durationMin} release (published ${uploadISO}) has garnered ${viewsCount} views with a ${ratingVal}/5 community rating across viewers in the United States, United Kingdom, and Europe.`;
    const summary2 = `Delivered via low-latency US and European edge servers for adaptive HTML5 streaming on iOS, Android, and desktop browsers with zero registration. Browse related scenes tagged with ${topTags} or explore our Top 100 US & EU chart.`;

    const faq = [
        {
            question: `What is the duration and resolution of "${title}"?`,
            answer: `"${title}" has a full runtime of ${durationMin} and streams in adaptive high-definition (up to 1080p 60FPS Full HD) directly in your web browser with instant buffering.`
        },
        {
            question: `Which category and tags are featured in "${title}"?`,
            answer: `This video is cataloged under the ${primaryCatName} category and includes scenes related to ${topTags}. You can discover similar HD clips in our ${primaryCatName} collection, Top 100 US & EU chart, or complete Video Directory.`
        },
        {
            question: `Can viewers in the US, UK & Europe watch "${title}" free on mobile?`,
            answer: `Yes, kumpulenak streams "${title}" 100% free across the United States, United Kingdom, Germany, France, Spain, Italy, Canada, and worldwide on iPhone, iPad, Android, and desktop browsers with no account required.`
        }
    ];

    return { summary1, summary2, faq };
}

// Server-Side In-Memory Cache (Warm Lambdas)
const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min negative cache for 404s
const MAX_CACHE_ENTRIES = 500;

// Static Related Pool (Zero-network-cost on Vercel Free Tier — category-matched US & EU videos)
let staticRelatedPool = null;
function getStaticRelatedPool() {
    if (staticRelatedPool === null) {
        try {
            const p = path.join(__dirname, '..', 'data', 'related-pool.json');
            if (fs.existsSync(p)) {
                staticRelatedPool = JSON.parse(fs.readFileSync(p, 'utf8'));
            } else {
                staticRelatedPool = { categories: {}, all: [] };
            }
        } catch {
            staticRelatedPool = { categories: {}, all: [] };
        }
    }
    return staticRelatedPool;
}

// Related Videos In-Memory Cache
const relatedCache = new Map();
const RELATED_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_RELATED_ENTRIES = 200;

async function getRelatedVideos(categorySlug, currentId) {
    // 1. Use bundled category-keyed static pool first (0ms latency, 0 external API calls, ultra-frugal for Vercel Free Tier)
    const rawPool = getStaticRelatedPool();
    const isStructured = rawPool && !Array.isArray(rawPool) && Array.isArray(rawPool.all);
    const catList = (isStructured && rawPool.categories && Array.isArray(rawPool.categories[categorySlug]))
        ? rawPool.categories[categorySlug].filter(v => v && v.id !== currentId && !isHarmfulVideo(v))
        : [];
    const allList = (isStructured ? rawPool.all : (Array.isArray(rawPool) ? rawPool : []))
        .filter(v => v && v.id !== currentId && !isHarmfulVideo(v));

    if (catList.length >= 12) {
        return catList.slice(0, 12);
    }
    if (catList.length > 0 || allList.length >= 12) {
        const picked = [...catList];
        const seen = new Set(picked.map(v => v.id));
        let hash = 0;
        const seed = String(currentId || categorySlug || 'default');
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        }
        const start = allList.length > 0 ? Math.abs(hash) % allList.length : 0;
        for (let i = 0; i < allList.length && picked.length < 12; i++) {
            const candidate = allList[(start + i) % allList.length];
            if (!seen.has(candidate.id)) {
                seen.add(candidate.id);
                picked.push(candidate);
            }
        }
        if (picked.length >= 8) return picked.slice(0, 12);
    }

    // 2. Fallback to cached API only if static pool is empty
    const query = categorySlug || 'amateur';
    const cached = relatedCache.get(query);
    if (cached && Date.now() < cached.expires) {
        return (cached.videos || []).filter(v => v && v.id !== currentId && !isHarmfulVideo(v)).slice(0, 12);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const url = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=16&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.videos)) {
                const safeVideos = data.videos.filter(v => v && !isHarmfulVideo(v));
                if (relatedCache.size >= MAX_RELATED_ENTRIES) {
                    const oldest = relatedCache.keys().next().value;
                    relatedCache.delete(oldest);
                }
                relatedCache.set(query, {
                    videos: safeVideos,
                    expires: Date.now() + RELATED_CACHE_TTL_MS
                });
                return safeVideos.filter(v => v.id !== currentId).slice(0, 12);
            }
        }
    } catch {
        // Non-blocking fallback
    }
    return [];
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

        let badges = '';
        if (duration) badges += `<span class="badge-duration">${escapeHtml(duration)}</span>`;
        if (rate) badges += `<span class="badge-rating">⭐ ${escapeHtml(String(rate))}</span>`;

        return `
            <a href="${escapeHtml(cardUrl)}" class="card" aria-label="${safeTitle}">
                <div class="card-img-wrapper">
                    ${badges}
                    <img src="${escapeHtml(thumb)}" alt="${safeTitle} HD Video Thumbnail" width="360" height="202" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
                </div>
                <div class="card-meta">
                    <div class="card-date-views">
                        <span class="card-date">📅 ${escapeHtml(added)}</span>
                        <span class="card-views">👁 ${escapeHtml(views)}</span>
                    </div>
                    <h3 class="card-title">${safeTitle}</h3>
                </div>
            </a>`.trim();
    }).join('\n');
}

let enrichedDb = null;
function getEnrichedData(id) {
    if (enrichedDb === null) {
        try {
            const p = path.join(__dirname, '..', 'data', 'enriched-videos.json');
            if (fs.existsSync(p)) {
                enrichedDb = JSON.parse(fs.readFileSync(p, 'utf8'));
            } else {
                enrichedDb = {};
            }
        } catch {
            enrichedDb = {};
        }
    }
    const item = enrichedDb[id];
    return (item && item.status === 'enriched') ? item : null;
}

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

            // Eporner returns empty array [] or data.error if not found or deleted, or block harmful videos with 404
            if (!data || data.error || (Array.isArray(data) && data.length === 0) || !data.id || isHarmfulVideo(data)) {
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

        // Find primary category and clean tags
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

        // Fetch related videos concurrently from primary category
        const relatedVideos = await getRelatedVideos(primaryCatSlug, data.id);

        const thumbUrl = (data.default_thumb && data.default_thumb.src) ? data.default_thumb.src : `${siteUrl}/assets/icons/og-image.png`;
        const embedUrl = data.embed || `https://www.eporner.com/embed/${data.id}/`;

        // Build programmatic long-tail editorial + FAQ fallback so ALL 45,000+ videos have rich content
        const programmatic = buildProgrammaticEditorial(
            title,
            primaryCatName,
            primaryCatSlug,
            durationMin,
            uploadISO,
            viewsCount,
            ratingVal,
            cleanTagList
        );
        const activeFaq = (enriched && Array.isArray(enriched.faq) && enriched.faq.length > 0)
            ? enriched.faq
            : programmatic.faq;

        // Build Rich Results Schema (@graph: BreadcrumbList + VideoObject + FAQPage)
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
                    "url": canonicalUrl,
                    "genre": primaryCatName,
                    "keywords": cleanTagList.slice(0, 12).join(', '),
                    "contentRating": "18+",
                    "isFamilyFriendly": false,
                    "inLanguage": "en",
                    "publisher": {
                        "@type": "Organization",
                        "name": "kumpulenak",
                        "url": siteUrl,
                        "logo": {
                            "@type": "ImageObject",
                            "url": `${siteUrl}/assets/icons/android-chrome-512x512.png`,
                            "width": 512,
                            "height": 512
                        }
                    },
                    "interactionStatistic": {
                        "@type": "InteractionCounter",
                        "interactionType": { "@type": "WatchAction" },
                        "userInteractionCount": Number(data.views || 0)
                    },
                    "potentialAction": {
                        "@type": "WatchAction",
                        "target": canonicalUrl
                    }
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": activeFaq.map(f => ({
                        "@type": "Question",
                        "name": f.question,
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": f.answer
                        }
                    }))
                }
            ]
        };

        // Smart Tag-to-Category Resolver (eliminates crawlable /?q= links while strengthening internal /category/ linking)
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
            const parts = s.split('-');
            for (const p of parts) {
                if (KNOWN_CATEGORIES.has(p)) return p;
                if (TAG_SYNONYMS[p]) return TAG_SYNONYMS[p];
            }
            return null;
        }

        // Build tags HTML (zero <a href="/?q=..."> links for crawlers)
        const tagsHtml = cleanTagList.map(tag => {
            const matchedCat = resolveTagCategory(tag);
            if (matchedCat) {
                return `<a href="/category/${matchedCat}" class="video-tag">${escapeHtml(tag)}</a>`;
            }
            return `<span class="video-tag" role="button" tabindex="0" onclick="window.location.href='/?q=${encodeURIComponent(tag)}'" style="cursor:pointer;">${escapeHtml(tag)}</span>`;
        }).join(' ');

        // Category navigation chips + Trending + Directory links
        const categoryPillsHtml = [
            `<a href="/trending" class="video-tag" style="border-color: #ff6b9d; font-weight: 700;">🔥 Top 100 US &amp; EU</a>`,
            `<a href="/directory" class="video-tag" style="border-color: var(--accent); font-weight: 700;">📂 All 95 Categories</a>`,
            ...POPULAR_CATEGORIES.map(c => `<a href="/category/${c.slug}" class="video-tag">${escapeHtml(c.name)}</a>`)
        ].join(' ');

        const faqHtml = `<div class="video-faq" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <h2 style="font-size: 1.05rem; margin: 0 0 12px; color: #fff;">Frequently Asked Questions</h2>
                    ${activeFaq.map(f => `<div class="faq-item" style="margin-bottom: 12px;"><h3 style="font-size: 0.92rem; margin: 0 0 4px; color: var(--text-primary);">${escapeHtml(f.question)}</h3><p style="font-size: 0.85rem; margin: 0; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(f.answer)}</p></div>`).join('')}
                </div>`;

        const specsHtml = `<div class="video-specs" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 16px 0; padding: 14px; background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 12px; font-size: 0.82rem;">
                    <div><strong style="color: var(--text-secondary); display: block;">Category</strong><a href="/category/${escapeHtml(primaryCatSlug)}" style="color: var(--accent); text-decoration: none; font-weight: 600;">${escapeHtml(primaryCatName)}</a></div>
                    <div><strong style="color: var(--text-secondary); display: block;">Runtime</strong><span>${escapeHtml(durationMin)} (${durationSec}s)</span></div>
                    <div><strong style="color: var(--text-secondary); display: block;">Quality</strong><span>Full HD 1080p</span></div>
                    <div><strong style="color: var(--text-secondary); display: block;">Regions</strong><span>USA, UK &amp; Europe HD</span></div>
                    <div><strong style="color: var(--text-secondary); display: block;">Rating</strong><span>⭐ ${escapeHtml(String(ratingVal))} / 5.0</span></div>
                </div>`;

        // Pre-rendered video container HTML with DIRECT IFRAME
        const preRenderedContainer = `
            <nav class="breadcrumb-nav" aria-label="Breadcrumb">
                <a href="/">Home</a>
                <span class="sep">›</span>
                <a href="/category/${escapeHtml(primaryCatSlug)}">${escapeHtml(primaryCatName)}</a>
                <span class="sep">›</span>
                <span class="current" aria-current="page">${safeTitle.slice(0, 45)}${safeTitle.length > 45 ? '...' : ''}</span>
            </nav>
            <a href="/" class="back-btn">← Back to Home</a>
            <div class="video-wrapper">
                <iframe 
                    id="videoPlayer"
                    src="${escapeHtml(embedUrl)}" 
                    width="1280"
                    height="720"
                    frameborder="0" 
                    allowfullscreen="true" 
                    scrolling="no" 
                    title="${safeTitle}" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
            </div>
            <div class="video-details">
                <h1 class="video-title">${safeTitle}</h1>
                <div class="video-meta">
                    <span>⏱ ${escapeHtml(durationMin)}</span>
                    <span>👁 ${viewsCount} views</span>
                    <span>⭐ ${escapeHtml(String(ratingVal))} rating</span>
                    <span>📅 ${escapeHtml(uploadISO)}</span>
                </div>
                ${specsHtml}
                ${tagsHtml ? `<div class="video-tags">${tagsHtml}</div>` : ''}
                ${enriched ? `
                <div class="video-editorial-enriched" style="margin-top: 16px;">
                    ${enriched.summary ? `<p class="video-summary">${escapeHtml(enriched.summary)}</p>` : ''}
                    ${enriched.highlights && enriched.highlights.length ? `<div class="video-highlights"><h3>Key Highlights</h3><ul>${enriched.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>` : ''}
                    ${faqHtml}
                </div>` : `
                <div class="video-editorial-enriched" style="margin-top: 16px; line-height: 1.6; color: var(--text-secondary); font-size: 0.92rem;">
                    <p class="video-summary" style="margin: 0 0 10px;">${escapeHtml(programmatic.summary1)}</p>
                    <p style="margin: 0;">${escapeHtml(programmatic.summary2)}</p>
                    ${faqHtml}
                </div>`}
                <div class="video-popular-categories" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <span style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 8px; font-weight: 600;">Explore Categories:</span>
                    <div class="video-tags">${categoryPillsHtml}</div>
                </div>
            </div>
        `;

        let html = rawVideoTpl;

        // Replace metadata
        html = html.replace(/<title>.*?<\/title>/s, `<title>${safeSeoTitle}</title>`);
        html = html.replace(/<meta name="description"[\s\S]*?>/s, `<meta name="description" content="${safeDesc}">`);
        html = html.replace(/<meta name="robots"[\s\S]*?>/s, `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`);
        const watchHreflang = [
            `<link rel="canonical" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en-US" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en-GB" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en-CA" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en-AU" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="en-IE" href="${canonicalUrl}">`,
            `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`
        ].join('\n    ');
        html = html.replace(/<link rel="canonical"[\s\S]*?>/s, watchHreflang);

        // Replace Open Graph
        html = html.replace(
            /<meta id="ogTitle" property="og:title" content=".*?">/s,
            `<meta property="og:locale" content="en_US">\n    <meta property="og:locale:alternate" content="en_GB">\n    <meta property="og:locale:alternate" content="en_CA">\n    <meta property="og:locale:alternate" content="en_AU">\n    <meta property="og:locale:alternate" content="en_IE">\n    <meta id="ogTitle" property="og:title" content="${safeSeoTitle}">`
        );
        html = html.replace(/<meta id="ogDesc" property="og:description" content=".*?">/s, `<meta id="ogDesc" property="og:description" content="${safeDesc}">`);
        html = html.replace(/<meta id="ogImage" property="og:image" content=".*?">/s, `<meta id="ogImage" property="og:image" content="${escapeHtml(thumbUrl)}">`);
        html = html.replace(/<meta id="ogImageAlt" property="og:image:alt" content=".*?">/s, `<meta id="ogImageAlt" property="og:image:alt" content="${safeTitle} 1080p HD Video Thumbnail">`);
        html = html.replace(/<meta id="ogUrl" property="og:url" content=".*?">/s, `<meta id="ogUrl" property="og:url" content="${canonicalUrl}">`);
        html = html.replace(/<meta id="ogVideo" property="og:video" content=".*?">/s, `<meta id="ogVideo" property="og:video" content="${escapeHtml(embedUrl)}">`);

        // Replace Twitter
        html = html.replace(/<meta name="twitter:title" content=".*?">/s, `<meta name="twitter:title" content="${safeSeoTitle}">`);
        html = html.replace(/<meta name="twitter:description" content=".*?">/s, `<meta name="twitter:description" content="${safeDesc}">`);
        html = html.replace(/<meta id="twitterImage" name="twitter:image" content=".*?">/s, `<meta id="twitterImage" name="twitter:image" content="${escapeHtml(thumbUrl)}">`);

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

        // Pre-render Similar / Related Videos Section in SSR
        if (relatedVideos && relatedVideos.length > 0) {
            const relatedCardsHtml = renderRelatedCardsHtml(relatedVideos);
            const similarHtml = `
            <!-- ===== SIMILAR VIDEOS ===== -->
            <div class="video-page-container" id="similarVideosSection" style="margin-top: 40px; display: block;">
                <h2 class="similar-title">Related Videos</h2>
                <div class="card-grid" id="similarVideoGrid">
                    ${relatedCardsHtml}
                </div>
            </div>`;
            html = html.replace(/<!-- ===== SIMILAR VIDEOS ===== -->[\s\S]*?<div class="card-grid" id="similarVideoGrid"><\/div>\s*<\/div>/, similarHtml);
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000');
        res.setHeader('CDN-Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=2592000');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=2592000');
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
