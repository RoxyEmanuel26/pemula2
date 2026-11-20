'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
    cleanVideoTitle,
    isHarmfulContent,
    isUSEUFriendly
} = require('./scripts/content-filter');
const { EU_HUBS } = require('./scripts/schema-helper');

const ROOT = __dirname;
const SITEMAPS_DIR = path.join(ROOT, 'sitemaps');
const STATE_FILE = path.join(ROOT, 'sitemap_state.json');
const INDEX_FILE = path.join(ROOT, 'sitemap_index.xml');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const SITEMAP_TXT_FILE = path.join(ROOT, 'sitemap.txt');
const RSS_FILE = path.join(ROOT, 'rss.xml');
const BASE_URL = 'https://www.kumpulenak.my.id';
const API_URL = 'https://www.eporner.com/api/v2/video/search/';
const INDEXNOW_KEY = 'e8f4a2b9c1d64e70a5f3b8c2d9e1f0a4';

const MAX_ACTIVE_URLS = Number(process.env.SITEMAP_MAX_URLS || 45000);
const MAX_FILE_URLS = Number(process.env.SITEMAP_SHARD_URLS || 5000);
const MAX_FLAT_VIDEO_URLS = 500;
const MAX_TXT_VIDEO_URLS = 1000;
const MAX_RSS_VIDEO_URLS = 100;
const MAX_FILE_BYTES = 45 * 1024 * 1024;
const RETENTION_DAYS = Number(process.env.SITEMAP_RETENTION_DAYS || 90);
const DAILY_PAGES = Number(process.env.SITEMAP_DAILY_PAGES || 100);
const BOOTSTRAP_MAX_PAGES = Number(process.env.SITEMAP_BOOTSTRAP_PAGES || 600);
const PER_PAGE = 100;
const CONCURRENCY = Number(process.env.SITEMAP_CONCURRENCY || 4);
const REQUEST_TIMEOUT_MS = Number(process.env.SITEMAP_TIMEOUT_MS || 15000);
const MAX_RETRIES = Number(process.env.SITEMAP_RETRIES || 4);

const STATIC_SITEMAPS = ['sitemap_pages.xml', 'sitemap_kategori.xml'];
const VIDEO_FILE_RE = /^sitemap_video_(\d{4}-\d{2}-\d{2})_(\d+)\.xml$/;

function todayUtc(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function decodeXml(value) {
    return String(value ?? '')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
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

function publicationDate(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const parsed = new Date(`${match[1]}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.toISOString().slice(0, 10) !== match[1]) return null;
    if (parsed > new Date(Date.now() + 86400000)) return null;
    return match[1];
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
    return text;
}

function isHttpsUrl(value) {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function normalizeVideo(video) {
    if (!video || typeof video !== 'object') return null;
    const id = typeof video.id === 'string' ? video.id.trim() : '';
    const rawTitle = typeof video.title === 'string'
        ? repairMojibake(decodeHtmlEntities(video.title)).trim()
        : '';
    const title = cleanVideoTitle(rawTitle);
    const thumbnail = video.default_thumb && typeof video.default_thumb.src === 'string'
        ? video.default_thumb.src.trim()
        : '';
    const player = typeof video.embed === 'string' ? video.embed.trim() : '';
    const date = publicationDate(video.added);
    if (!/^[A-Za-z0-9]{6,32}$/.test(id) || !title || !date) return null;
    if (isHarmfulContent({ title: rawTitle, keywords: video.keywords })) return null;
    if (!isHttpsUrl(thumbnail) || !isHttpsUrl(player)) return null;
    return {
        id,
        title,
        thumbnail,
        player,
        date,
        duration: Math.max(0, Math.floor(Number(video.length_sec) || 0)),
        slug: slugify(title)
    };
}

function videoNode(video) {
    const suffix = video.slug ? `-${video.slug}` : '';
    const loc = `${BASE_URL}/v/${video.id}${suffix}`;
    const safeXmlTitle = video.title.slice(0, 100).trim();
    const durMin = video.duration > 0 ? ` (${Math.floor(video.duration / 60)}m ${video.duration % 60}s)` : '';
    const description = `Watch ${video.title}${durMin} in 1080p Full HD free across the USA, UK & Europe on kumpulenak.`.slice(0, 2048);
    const duration = video.duration > 0 ? `\n      <video:duration>${video.duration}</video:duration>` : '';
    return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${video.date}</lastmod>`,
        '    <video:video>',
        `      <video:thumbnail_loc>${escapeXml(video.thumbnail)}</video:thumbnail_loc>`,
        `      <video:title>${escapeXml(safeXmlTitle)}</video:title>`,
        `      <video:description>${escapeXml(description)}</video:description>`,
        `      <video:player_loc>${escapeXml(video.player)}</video:player_loc>${duration}`,
        `      <video:publication_date>${video.date}</video:publication_date>`,
        '      <video:family_friendly>no</video:family_friendly>',
        '    </video:video>',
        '  </url>'
    ].join('\n');
}

function videoSitemap(nodes) {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
        ...nodes,
        '</urlset>',
        ''
    ].join('\n');
}

function parseVideoNodes(xml) {
    const nodes = xml.match(/  <url>[\s\S]*?  <\/url>/g) || [];
    return nodes.map(raw => {
        const locMatch = raw.match(/<loc>([^<]+)<\/loc>/);
        const idMatch = locMatch && decodeXml(locMatch[1]).match(/\/v\/([A-Za-z0-9]{6,32})(?:-|$)/);
        return { raw, id: idMatch ? idMatch[1] : null };
    }).filter(item => item.id);
}

function sanitizeVideoNodeRaw(raw) {
    let normalized = String(raw || '').replace(/\r\n/g, '\n');
    const titleMatch = normalized.match(/<video:title>([^<]+)<\/video:title>/);
    const locMatch = normalized.match(/<loc>([^<]+)<\/loc>/);
    const rawTitle = titleMatch ? decodeXml(titleMatch[1]) : '';
    const locUrl = locMatch ? decodeXml(locMatch[1]) : '';
    if (isHarmfulContent(rawTitle) || isHarmfulContent(locUrl)) {
        return null;
    }

    const cleanedTitle = cleanVideoTitle(rawTitle);
    if (!cleanedTitle) return null;
    const cappedTitle = cleanedTitle.slice(0, 100).trim();

    let updated = normalized;
    if (cappedTitle !== rawTitle) {
        const newDesc = `Watch ${cleanedTitle} in 1080p Full HD free across the USA, UK & Europe on kumpulenak.`.slice(0, 2048);
        updated = updated
            .replace(/<video:title>[^<]*<\/video:title>/, `<video:title>${escapeXml(cappedTitle)}</video:title>`)
            .replace(/<video:description>[^<]*<\/video:description>/, `<video:description>${escapeXml(newDesc)}</video:description>`);
    }
    if (!updated.includes('<video:family_friendly>')) {
        updated = updated.replace(
            /(<video:publication_date>[^<]+<\/video:publication_date>)/,
            '$1\n      <video:family_friendly>no</video:family_friendly>'
        );
    }
    return updated;
}

function sanitizeExistingShards(shards) {
    const rewritten = [];
    let purgedNodes = 0;
    const keptShards = [];

    for (const shard of shards) {
        const sanitizedNodes = [];
        let changed = false;
        for (const node of shard.nodes) {
            const cleanRaw = sanitizeVideoNodeRaw(node.raw);
            if (!cleanRaw) {
                purgedNodes++;
                changed = true;
                continue;
            }
            if (cleanRaw !== node.raw) {
                changed = true;
            }
            sanitizedNodes.push({ id: node.id, raw: cleanRaw });
        }

        if (sanitizedNodes.length === 0) {
            if (fs.existsSync(shard.fullPath)) fs.unlinkSync(shard.fullPath);
            continue;
        }

        if (changed) {
            shard.nodes = sanitizedNodes;
            writeAtomic(shard.fullPath, videoSitemap(sanitizedNodes.map(n => n.raw)));
            rewritten.push(shard.name);
        }
        keptShards.push(shard);
    }

    return { shards: keptShards, rewritten, purgedNodes };
}

function writeAtomic(filePath, content) {
    const tempPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function gitLastmod(relativePath) {
    try {
        const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        return value ? value.slice(0, 10) : todayUtc();
    } catch {
        return todayUtc();
    }
}

function standardSitemap(nodes, withXhtml = false) {
    const ns = withXhtml
        ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        ns,
        ...nodes,
        '</urlset>',
        ''
    ].join('\n');
}

function buildXhtmlHubAlternates() {
    const links = [
        `    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/" />`,
        `    <xhtml:link rel="alternate" hreflang="en-US" href="${BASE_URL}/" />`,
        `    <xhtml:link rel="alternate" hreflang="en-GB" href="${BASE_URL}/" />`,
        `    <xhtml:link rel="alternate" hreflang="en-CA" href="${BASE_URL}/" />`,
        `    <xhtml:link rel="alternate" hreflang="en-AU" href="${BASE_URL}/" />`,
        `    <xhtml:link rel="alternate" hreflang="en-IE" href="${BASE_URL}/" />`
    ];
    for (const hub of EU_HUBS) {
        for (const hl of hub.hreflangs) {
            links.push(`    <xhtml:link rel="alternate" hreflang="${hl}" href="${BASE_URL}${hub.path}" />`);
        }
    }
    links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />`);
    return links.join('\n');
}

function generateStaticSitemaps() {
    const hubPaths = new Set(['/', ...EU_HUBS.map(h => h.path)]);
    const xhtmlBlock = buildXhtmlHubAlternates();

    const pages = [
        ['/', 'index.html'],
        ...EU_HUBS.map(h => [h.path, h.file]),
        ['/trending', 'trending.html'],
        ['/directory', 'directory.html'],
        ['/about', 'about.html'],
        ['/contact', 'contact.html'],
        ['/privacy', 'privacy.html'],
        ['/terms', 'terms.html'],
        ['/dmca', 'dmca.html'],
        ['/howto', 'howto.html']
    ];
    const pageNodesPlain = pages.map(([urlPath, source]) => [
        '  <url>',
        `    <loc>${BASE_URL}${urlPath}</loc>`,
        `    <lastmod>${gitLastmod(source)}</lastmod>`,
        '  </url>'
    ].join('\n'));
    const pageNodesWithHreflang = pages.map(([urlPath, source]) => {
        const baseLines = [
            '  <url>',
            `    <loc>${BASE_URL}${urlPath}</loc>`,
            `    <lastmod>${gitLastmod(source)}</lastmod>`
        ];
        if (hubPaths.has(urlPath)) {
            baseLines.push(xhtmlBlock);
        }
        baseLines.push('  </url>');
        return baseLines.join('\n');
    });
    writeAtomic(path.join(SITEMAPS_DIR, 'sitemap_pages.xml'), standardSitemap(pageNodesWithHreflang, true));

    const categoryFiles = fs.readdirSync(path.join(ROOT, 'category'))
        .filter(name => name.endsWith('.html'))
        .sort((a, b) => a.localeCompare(b));
    const categoryNodes = categoryFiles.map(name => {
        const slug = name.slice(0, -5);
        return [
            '  <url>',
            `    <loc>${BASE_URL}/category/${escapeXml(slug)}</loc>`,
            `    <lastmod>${gitLastmod(`category/${name}`)}</lastmod>`,
            '  </url>'
        ].join('\n');
    });
    writeAtomic(path.join(SITEMAPS_DIR, 'sitemap_kategori.xml'), standardSitemap(categoryNodes));

    return { pageNodes: pageNodesPlain, categoryNodes };
}

function collectInternationalVideosForFeeds(activeShards, limit) {
    const picked = [];
    const seenIds = new Set();
    const reversedShards = [...activeShards].reverse();
    for (const shard of reversedShards) {
        if (picked.length >= limit) break;
        for (const node of shard.nodes) {
            if (picked.length >= limit) break;
            if (seenIds.has(node.id)) continue;
            const locMatch = node.raw.match(/<loc>([^<]+)<\/loc>/);
            const titleMatch = node.raw.match(/<video:title>([^<]+)<\/video:title>/);
            const dateMatch = node.raw.match(/<lastmod>([^<]+)<\/lastmod>/);
            const descMatch = node.raw.match(/<video:description>([^<]+)<\/video:description>/);
            if (!locMatch || !titleMatch) continue;
            const title = decodeXml(titleMatch[1]);
            if (!isUSEUFriendly({ title })) continue;
            seenIds.add(node.id);
            picked.push({
                id: node.id,
                loc: decodeXml(locMatch[1]),
                title,
                date: dateMatch ? dateMatch[1] : todayUtc(),
                description: descMatch ? decodeXml(descMatch[1]) : `Watch ${title} in 1080p Full HD on kumpulenak.`
            });
        }
    }
    return picked;
}

function extractLocs(nodes) {
    return nodes
        .map(raw => {
            const m = raw.match(/<loc>([^<]+)<\/loc>/);
            return m ? decodeXml(m[1]) : null;
        })
        .filter(Boolean);
}

function buildFlatPrioritySitemap(pageNodes, categoryNodes, activeShards) {
    const topVideos = collectInternationalVideosForFeeds(activeShards, MAX_FLAT_VIDEO_URLS);
    const cleanVideoUrlNodes = topVideos.map(v => [
        '  <url>',
        `    <loc>${escapeXml(v.loc)}</loc>`,
        `    <lastmod>${v.date}</lastmod>`,
        '  </url>'
    ].join('\n'));

    return standardSitemap([
        ...pageNodes.map(n => n.replace(/\r\n/g, '\n')),
        ...categoryNodes.map(n => n.replace(/\r\n/g, '\n')),
        ...cleanVideoUrlNodes
    ]);
}

function buildPlainTextSitemap(pageNodes, categoryNodes, activeShards) {
    const staticLocs = [
        ...extractLocs(pageNodes),
        ...extractLocs(categoryNodes)
    ];
    const videoLocs = collectInternationalVideosForFeeds(activeShards, MAX_TXT_VIDEO_URLS).map(v => v.loc);
    return [...new Set([...staticLocs, ...videoLocs])].join('\n') + '\n';
}

function buildRssFeed(activeShards) {
    const items = collectInternationalVideosForFeeds(activeShards, MAX_RSS_VIDEO_URLS);
    const buildDate = new Date().toUTCString();
    const itemsXml = items.map(v => {
        const pubDate = new Date(`${v.date}T00:00:00Z`).toUTCString();
        return [
            '    <item>',
            `      <title>${escapeXml(v.title)}</title>`,
            `      <link>${escapeXml(v.loc)}</link>`,
            `      <guid isPermaLink="true">${escapeXml(v.loc)}</guid>`,
            `      <pubDate>${pubDate}</pubDate>`,
            `      <description>${escapeXml(v.description)}</description>`,
            '    </item>'
        ].join('\n');
    });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>kumpulenak — Latest US &amp; European 1080p Full HD Videos</title>',
        `    <link>${BASE_URL}/</link>`,
        '    <description>Daily updated Full HD 1080p adult video releases for the USA, UK &amp; Europe.</description>',
        '    <language>en-us</language>',
        `    <lastBuildDate>${buildDate}</lastBuildDate>`,
        `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
        ...itemsXml,
        '  </channel>',
        '</rss>',
        ''
    ].join('\n');
}

function listVideoShards() {
    if (!fs.existsSync(SITEMAPS_DIR)) return [];
    return fs.readdirSync(SITEMAPS_DIR)
        .map(name => {
            const match = name.match(VIDEO_FILE_RE);
            if (!match) return null;
            const fullPath = path.join(SITEMAPS_DIR, name);
            return {
                name,
                date: match[1],
                sequence: Number(match[2]),
                fullPath,
                nodes: parseVideoNodes(fs.readFileSync(fullPath, 'utf8'))
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence);
}

function retryDelay(attempt) {
    return Math.min(1000 * (2 ** attempt), 10000) + Math.floor(Math.random() * 250);
}

async function fetchJsonWithRetry(url, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const delayImpl = options.delayImpl || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const retries = options.retries ?? MAX_RETRIES;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
        try {
            const response = await fetchImpl(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'kumpulenak-sitemap/6.0' }
            });
            if (response.ok) return await response.json();
            if (response.status !== 429 && response.status < 500) {
                const error = new Error(`HTTP ${response.status} (tidak dapat dicoba ulang)`);
                error.retryable = false;
                throw error;
            }
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (error.retryable === false) throw error;
            lastError = error;
        } finally {
            clearTimeout(timeout);
        }
        if (attempt < retries) await delayImpl(retryDelay(attempt));
    }
    throw new Error(`API gagal setelah ${retries + 1} percobaan: ${lastError ? lastError.message : 'unknown error'}`);
}

function apiPageUrl(page, query = 'all', order = 'latest') {
    const params = new URLSearchParams({
        query,
        per_page: String(PER_PAGE),
        page: String(page),
        thumbsize: 'big',
        order,
        gay: '0',
        lq: '1',
        format: 'json'
    });
    return `${API_URL}?${params}`;
}

function validateApiPage(data, page) {
    if (!data || !Array.isArray(data.videos)) {
        throw new Error(`Respons API halaman ${page} tidak valid`);
    }
    if (data.videos.length === 0) {
        throw new Error(`Respons API halaman ${page} kosong; publikasi dibatalkan agar tidak memakai data parsial`);
    }
    return data.videos;
}

async function fetchPages(pageLimit, stopAtUnique = Infinity) {
    const videos = new Map();
    let requests = 0;

    // 1. Priority US & European high-CTR queries first (ensures rich US/EU discovery daily)
    const priorityQueries = ['american', 'european', 'british', 'german', 'french', 'spanish', 'italian', 'hd porn 1080p'];
    for (const q of priorityQueries) {
        if (videos.size >= stopAtUnique) break;
        try {
            const data = await fetchJsonWithRetry(apiPageUrl(1, q, 'latest'));
            requests++;
            if (data && Array.isArray(data.videos)) {
                for (const raw of data.videos) {
                    const video = normalizeVideo(raw);
                    if (video && isUSEUFriendly(video) && !videos.has(video.id)) {
                        videos.set(video.id, video);
                    }
                }
            }
        } catch (err) {
            console.warn(`[FETCH] Priority query "${q}" warning: ${err.message}`);
        }
    }

    // 2. Rolling latest stream
    for (let start = 1; start <= pageLimit && videos.size < stopAtUnique; start += CONCURRENCY) {
        const pages = Array.from({ length: Math.min(CONCURRENCY, pageLimit - start + 1) }, (_, index) => start + index);
        const results = await Promise.all(pages.map(async page => {
            const data = await fetchJsonWithRetry(apiPageUrl(page));
            requests++;
            return validateApiPage(data, page);
        }));
        for (const batch of results) {
            for (const raw of batch) {
                const video = normalizeVideo(raw);
                if (video && !videos.has(video.id)) videos.set(video.id, video);
            }
        }
        const completed = Math.min(start - 1 + pages.length, pageLimit);
        if (start === 1 || completed % 25 === 0) {
            console.log(`[FETCH] ${completed}/${pageLimit} halaman, ${videos.size} kandidat valid`);
        }
    }
    return { videos: [...videos.values()], requests };
}

function pruneExpiredShards(shards, now = new Date()) {
    const cutoffDate = todayUtc(new Date(now.getTime() - RETENTION_DAYS * 86400000));
    const removed = [];
    const active = [];
    for (const shard of shards) {
        if (shard.date < cutoffDate) removed.push(shard);
        else active.push(shard);
    }
    return { active, removed };
}

function applyActiveCap(shards, newVideos) {
    let total = shards.reduce((sum, shard) => sum + shard.nodes.length, 0) + newVideos.length;
    const removed = [];
    const rewritten = [];
    while (total > MAX_ACTIVE_URLS && shards.length > 0) {
        const overflow = total - MAX_ACTIVE_URLS;
        const oldest = shards[0];
        if (oldest.nodes.length <= overflow) {
            shards.shift();
            removed.push(oldest);
            total -= oldest.nodes.length;
        } else {
            oldest.nodes = oldest.nodes.slice(overflow);
            writeAtomic(oldest.fullPath, videoSitemap(oldest.nodes.map(node => node.raw)));
            rewritten.push(oldest.name);
            total -= overflow;
        }
    }
    if (newVideos.length > MAX_ACTIVE_URLS) {
        newVideos.splice(MAX_ACTIVE_URLS);
    }
    return { shards, newVideos, removed, rewritten, total };
}

function nextSequence(shards, date) {
    return shards.filter(shard => shard.date === date)
        .reduce((max, shard) => Math.max(max, shard.sequence), 0) + 1;
}

function createDailyShards(videos, existingShards, date) {
    const created = [];
    let sequence = nextSequence(existingShards, date);
    let offset = 0;
    while (offset < videos.length) {
        let chunk = videos.slice(offset, offset + MAX_FILE_URLS);
        let xml = videoSitemap(chunk.map(videoNode));
        while (Buffer.byteLength(xml) > MAX_FILE_BYTES && chunk.length > 1) {
            chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
            xml = videoSitemap(chunk.map(videoNode));
        }
        const name = `sitemap_video_${date}_${sequence}.xml`;
        const fullPath = path.join(SITEMAPS_DIR, name);
        writeAtomic(fullPath, xml);
        created.push({ name, date, sequence, fullPath, nodes: parseVideoNodes(xml) });
        offset += chunk.length;
        sequence++;
    }
    return created;
}

function buildIndex(shards, changedNames = new Set()) {
    const entries = [];
    for (const name of STATIC_SITEMAPS) {
        entries.push({ name, lastmod: gitLastmod(`sitemaps/${name}`) });
    }
    for (const shard of shards) {
        entries.push({
            name: shard.name,
            lastmod: changedNames.has(shard.name) ? todayUtc() : gitLastmod(`sitemaps/${shard.name}`)
        });
    }
    const nodes = entries.map(item => [
        '  <sitemap>',
        `    <loc>${BASE_URL}/sitemaps/${escapeXml(item.name)}</loc>`,
        `    <lastmod>${item.lastmod}</lastmod>`,
        '  </sitemap>'
    ].join('\n'));
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...nodes,
        '</sitemapindex>',
        ''
    ].join('\n');
}

async function pingIndexNow(urls) {
    if (!urls || urls.length === 0) return { submitted: 0, status: 'skipped' };
    const batch = urls.slice(0, 1000);
    const payload = {
        host: 'www.kumpulenak.my.id',
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: batch
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        return { submitted: batch.length, status: res.status };
    } catch (err) {
        return { submitted: 0, status: `warning: ${err.message}` };
    } finally {
        clearTimeout(timeout);
    }
}

function validateSitemaps(options = {}) {
    const errors = [];
    const index = fs.existsSync(INDEX_FILE) ? fs.readFileSync(INDEX_FILE, 'utf8') : '';
    if (!index.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
        errors.push('sitemap_index.xml tidak memiliki deklarasi XML UTF-8');
    }
    if (/<(?:changefreq|priority)>/.test(index)) errors.push('Indeks mengandung tag deprecated');
    const references = [...index.matchAll(/<loc>https:\/\/www\.kumpulenak\.my\.id\/sitemaps\/([^<]+)<\/loc>/g)]
        .map(match => decodeXml(match[1]));
    for (const required of STATIC_SITEMAPS) {
        if (!references.includes(required)) errors.push(`Indeks tidak mereferensikan ${required}`);
    }
    if (references.includes('sitemap_tags.xml')) errors.push('Indeks masih mereferensikan sitemap_tags.xml');

    // Validate flat priority /sitemap.xml (pure standard <urlset> with LF line endings)
    const flatSitemap = fs.existsSync(SITEMAP_FILE) ? fs.readFileSync(SITEMAP_FILE, 'utf8') : '';
    if (!flatSitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
        errors.push('sitemap.xml tidak memiliki deklarasi XML UTF-8');
    }
    if (!flatSitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') || !flatSitemap.includes('</urlset>')) {
        errors.push('sitemap.xml harus berupa standard <urlset> murni');
    }
    if (flatSitemap.includes('\r')) {
        errors.push('sitemap.xml mengandung CRLF (\\r); gunakan LF murni');
    }

    // Validate plain-text sitemap (/sitemap.txt) and RSS feed (/rss.xml)
    const txtSitemap = fs.existsSync(SITEMAP_TXT_FILE) ? fs.readFileSync(SITEMAP_TXT_FILE, 'utf8') : '';
    if (!txtSitemap.includes(`${BASE_URL}/trending`)) {
        errors.push('sitemap.txt tidak valid atau belum berisi URL utama');
    }
    const rssFeed = fs.existsSync(RSS_FILE) ? fs.readFileSync(RSS_FILE, 'utf8') : '';
    if (!rssFeed.includes('<rss version="2.0"') || !rssFeed.includes('</rss>')) {
        errors.push('rss.xml bukan RSS 2.0 feed yang valid');
    }

    const allIds = new Set();
    let videoUrls = 0;
    for (const name of references) {
        const filePath = path.join(SITEMAPS_DIR, name);
        if (!fs.existsSync(filePath)) {
            errors.push(`Referensi indeks tidak ditemukan: ${name}`);
            continue;
        }
        const xml = fs.readFileSync(filePath, 'utf8');
        const count = (xml.match(/<url>/g) || []).length;
        if (Buffer.byteLength(xml) > MAX_FILE_BYTES) errors.push(`${name} melebihi 45 MB`);
        if (count > MAX_ACTIVE_URLS) errors.push(`${name} melebihi 45.000 URL`);
        if (/<(?:changefreq|priority)>/.test(xml)) errors.push(`${name} mengandung changefreq/priority`);
        if (!xml.includes('</urlset>')) errors.push(`${name} tidak menutup urlset`);
        if (VIDEO_FILE_RE.test(name)) {
            const nodes = parseVideoNodes(xml);
            if (nodes.length !== count) errors.push(`${name} memiliki URL video yang tidak canonical`);
            for (const node of nodes) {
                for (const tag of ['video:thumbnail_loc', 'video:title', 'video:description', 'video:player_loc', 'video:publication_date', 'video:family_friendly']) {
                    if (!node.raw.includes(`<${tag}>`)) errors.push(`${name}: ${node.id} tidak memiliki ${tag}`);
                }
                if (allIds.has(node.id)) errors.push(`Duplikat video ID: ${node.id}`);
                allIds.add(node.id);
            }
            videoUrls += nodes.length;
        }
    }
    if (videoUrls > MAX_ACTIVE_URLS) errors.push(`Total video ${videoUrls} melebihi batas ${MAX_ACTIVE_URLS}`);
    if (!options.allowEmpty && videoUrls === 0) errors.push('Tidak ada URL video aktif');
    if (errors.length) throw new Error(`Validasi sitemap gagal:\n- ${errors.join('\n- ')}`);
    return { files: references.length, videoUrls, uniqueVideoIds: allIds.size };
}

function removeFiles(shards) {
    for (const shard of shards) {
        if (fs.existsSync(shard.fullPath)) fs.unlinkSync(shard.fullPath);
    }
}

async function generate(mode) {
    fs.mkdirSync(SITEMAPS_DIR, { recursive: true });
    const { pageNodes, categoryNodes } = generateStaticSitemaps();
    const retention = pruneExpiredShards(listVideoShards());
    removeFiles(retention.removed);

    // Sanitize all existing shards (purges harmful URLs, cleans Zalgo/junk, ensures family_friendly=no)
    const sanitized = sanitizeExistingShards(retention.active);
    let activeShards = sanitized.shards;

    if (mode === 'sanitize-only') {
        const capped = applyActiveCap(activeShards, []);
        activeShards = capped.shards;
        removeFiles(capped.removed);
        const changedNames = new Set([...sanitized.rewritten, ...capped.rewritten]);
        const indexContent = buildIndex(activeShards, changedNames);
        const flatContent = buildFlatPrioritySitemap(pageNodes, categoryNodes, activeShards);
        const txtContent = buildPlainTextSitemap(pageNodes, categoryNodes, activeShards);
        const rssContent = buildRssFeed(activeShards);
        writeAtomic(INDEX_FILE, indexContent);
        writeAtomic(SITEMAP_FILE, flatContent);
        writeAtomic(SITEMAP_TXT_FILE, txtContent);
        writeAtomic(RSS_FILE, rssContent);
        const validation = validateSitemaps({ allowEmpty: false });
        console.log(`[SANITIZE] Purged ${sanitized.purgedNodes} harmful URLs across ${sanitized.rewritten.length} shards. Active URLs: ${validation.videoUrls}`);
        return validation;
    }

    const existingIds = new Set(activeShards.flatMap(shard => shard.nodes.map(node => node.id)));
    const pageLimit = mode === 'bootstrap' ? BOOTSTRAP_MAX_PAGES : DAILY_PAGES;
    const stopAt = mode === 'bootstrap' ? MAX_ACTIVE_URLS : Infinity;
    const fetched = await fetchPages(pageLimit, stopAt);
    const newVideos = fetched.videos.filter(video => !existingIds.has(video.id));
    const duplicateCount = fetched.videos.length - newVideos.length;
    const date = todayUtc();
    const capped = applyActiveCap(activeShards, newVideos);
    activeShards = capped.shards;
    removeFiles(capped.removed);
    const created = createDailyShards(capped.newVideos, activeShards, date);
    activeShards = [...activeShards, ...created]
        .sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence);
    const changedNames = new Set([...created.map(item => item.name), ...capped.rewritten, ...sanitized.rewritten]);
    const indexContent = buildIndex(activeShards, changedNames);
    const flatContent = buildFlatPrioritySitemap(pageNodes, categoryNodes, activeShards);
    const txtContent = buildPlainTextSitemap(pageNodes, categoryNodes, activeShards);
    const rssContent = buildRssFeed(activeShards);
    writeAtomic(INDEX_FILE, indexContent);
    writeAtomic(SITEMAP_FILE, flatContent);
    writeAtomic(SITEMAP_TXT_FILE, txtContent);
    writeAtomic(RSS_FILE, rssContent);
    const validation = validateSitemaps({ allowEmpty: false });

    // Ping IndexNow for instant indexing on Bing, Yandex, DuckDuckGo, Naver, Seznam
    const urlsToPing = [
        `${BASE_URL}/`,
        ...EU_HUBS.map(h => `${BASE_URL}${h.path}`),
        `${BASE_URL}/trending`,
        `${BASE_URL}/directory`,
        `${BASE_URL}/category/european`,
        `${BASE_URL}/category/british`,
        `${BASE_URL}/category/german`,
        `${BASE_URL}/category/french`,
        `${BASE_URL}/category/spanish`,
        `${BASE_URL}/category/italian`,
        `${BASE_URL}/category/american`,
        ...capped.newVideos.filter(v => isUSEUFriendly(v)).slice(0, 500).map(v => `${BASE_URL}/v/${v.id}${v.slug ? '-' + v.slug : ''}`)
    ];
    const indexNowResult = await pingIndexNow(urlsToPing);

    const summary = {
        version: 2,
        lastSuccessfulAt: new Date().toISOString(),
        mode,
        requests: fetched.requests,
        candidates: fetched.videos.length,
        added: capped.newVideos.length,
        duplicates: duplicateCount,
        harmfulPurged: sanitized.purgedNodes,
        expiredShardsRemoved: retention.removed.length,
        capacityShardsRemoved: capped.removed.length,
        shardsCreated: created.length,
        activeShards: activeShards.length,
        activeVideoUrls: validation.videoUrls,
        indexNow: indexNowResult
    };
    writeAtomic(STATE_FILE, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`[DONE] ${JSON.stringify(summary)}`);
    return summary;
}

async function main() {
    const arg = process.argv[2] || '--daily';
    if (arg === '--validate') {
        console.log(JSON.stringify(validateSitemaps({ allowEmpty: process.argv.includes('--allow-empty') }), null, 2));
        return;
    }
    if (arg === '--sanitize') {
        await generate('sanitize-only');
        return;
    }
    if (!['--daily', '--bootstrap'].includes(arg)) {
        throw new Error('Gunakan --daily, --bootstrap, --sanitize, atau --validate');
    }
    await generate(arg.slice(2));
}

module.exports = {
    escapeXml,
    slugify,
    publicationDate,
    decodeHtmlEntities,
    repairMojibake,
    normalizeVideo,
    videoNode,
    videoSitemap,
    parseVideoNodes,
    fetchJsonWithRetry,
    validateApiPage,
    validateSitemaps,
    applyActiveCap
};

if (require.main === module) {
    main().catch(error => {
        console.error(`[ERROR] ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}
