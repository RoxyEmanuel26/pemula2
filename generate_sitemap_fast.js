'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SITEMAPS_DIR = path.join(ROOT, 'sitemaps');
const STATE_FILE = path.join(ROOT, 'sitemap_state.json');
const INDEX_FILE = path.join(ROOT, 'sitemap_index.xml');
const BASE_URL = 'https://www.kumpulenak.my.id';
const API_URL = 'https://www.eporner.com/api/v2/video/search/';

const MAX_ACTIVE_URLS = Number(process.env.SITEMAP_MAX_URLS || 45000);
const MAX_FILE_URLS = Number(process.env.SITEMAP_SHARD_URLS || 5000);
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
    const score = candidate => (candidate.match(/[\u00C2-\u00F4][\u0080-\u00BF]|�/g) || []).length;
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
    const title = typeof video.title === 'string'
        ? repairMojibake(decodeHtmlEntities(video.title)).trim()
        : '';
    const thumbnail = video.default_thumb && typeof video.default_thumb.src === 'string'
        ? video.default_thumb.src.trim()
        : '';
    const player = typeof video.embed === 'string' ? video.embed.trim() : '';
    const date = publicationDate(video.added);
    if (!/^[A-Za-z0-9]{6,32}$/.test(id) || !title || !date) return null;
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
    const description = `Watch ${video.title} in full HD for free on kumpulenak.`.slice(0, 2048);
    const duration = video.duration > 0 ? `\n      <video:duration>${video.duration}</video:duration>` : '';
    return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${video.date}</lastmod>`,
        '    <video:video>',
        `      <video:thumbnail_loc>${escapeXml(video.thumbnail)}</video:thumbnail_loc>`,
        `      <video:title>${escapeXml(video.title)}</video:title>`,
        `      <video:description>${escapeXml(description)}</video:description>`,
        `      <video:player_loc>${escapeXml(video.player)}</video:player_loc>${duration}`,
        `      <video:publication_date>${video.date}</video:publication_date>`,
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

function standardSitemap(nodes) {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...nodes,
        '</urlset>',
        ''
    ].join('\n');
}

function generateStaticSitemaps() {
    const pages = [
        ['/', 'index.html'],
        ['/about', 'about.html'],
        ['/contact', 'contact.html'],
        ['/privacy', 'privacy.html'],
        ['/terms', 'terms.html'],
        ['/dmca', 'dmca.html'],
        ['/howto', 'howto.html']
    ];
    const pageNodes = pages.map(([urlPath, source]) => [
        '  <url>',
        `    <loc>${BASE_URL}${urlPath}</loc>`,
        `    <lastmod>${gitLastmod(source)}</lastmod>`,
        '  </url>'
    ].join('\n'));
    writeAtomic(path.join(SITEMAPS_DIR, 'sitemap_pages.xml'), standardSitemap(pageNodes));

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

function apiPageUrl(page) {
    const params = new URLSearchParams({
        query: 'all',
        per_page: String(PER_PAGE),
        page: String(page),
        thumbsize: 'small',
        order: 'latest',
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
        // API pages are ordered newest-first; retain the leading candidates.
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
                for (const tag of ['video:thumbnail_loc', 'video:title', 'video:description', 'video:player_loc', 'video:publication_date']) {
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
    generateStaticSitemaps();
    const retention = pruneExpiredShards(listVideoShards());
    removeFiles(retention.removed);
    let activeShards = retention.active;
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
    const changedNames = new Set([...created.map(item => item.name), ...capped.rewritten]);
    writeAtomic(INDEX_FILE, buildIndex(activeShards, changedNames));
    const validation = validateSitemaps({ allowEmpty: false });
    const summary = {
        version: 1,
        lastSuccessfulAt: new Date().toISOString(),
        mode,
        requests: fetched.requests,
        candidates: fetched.videos.length,
        added: capped.newVideos.length,
        duplicates: duplicateCount,
        expiredShardsRemoved: retention.removed.length,
        capacityShardsRemoved: capped.removed.length,
        shardsCreated: created.length,
        activeShards: activeShards.length,
        activeVideoUrls: validation.videoUrls
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
    if (!['--daily', '--bootstrap'].includes(arg)) {
        throw new Error('Gunakan --daily, --bootstrap, atau --validate');
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
