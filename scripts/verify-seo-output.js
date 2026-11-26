'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const handler = require('../api/video');
const { isHarmfulContent, isUSEUFriendly } = require('./content-filter');
const { EU_HUBS } = require('./schema-helper');

const ADSTERRA_NATIVE_SCRIPT = 'https://biomanos.org/21/0dae6421659ccec66a169a9192f11484';
const ADSTERRA_NATIVE_CONTAINER = 'id="container-0dae6421659ccec66a169a9192f11484"';
const ROOT = path.join(__dirname, '..');

function extractCardTitles(html) {
    return [...html.matchAll(/<h3 class="card-title">([\s\S]*?)<\/h3>/g)].map(m => m[1].trim());
}

function getTopLevelSchemaTypes(html) {
    const types = [];
    for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        const raw = m[1].trim();
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed['@type']) types.push(parsed['@type']);
        if (Array.isArray(parsed['@graph'])) {
            for (const g of parsed['@graph']) {
                if (g && g['@type']) types.push(g['@type']);
            }
        }
    }
    return types;
}

function checkBalancedDivs(html, label) {
    const body = (html.match(/<body[\s\S]*<\/body>/i) || [''])[0]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');
    const open = (body.match(/<div\b/gi) || []).length;
    const close = (body.match(/<\/div>/gi) || []).length;
    assert.strictEqual(open, close, `${label} has unbalanced <div> tags (open=${open}, close=${close})`);
}

async function verifyAll() {
    console.log('🔍 Running Comprehensive US & Europe SEO + Adsterra Verification Suite...\n');

    // 1. Homepage & Gallery JS Verification
    console.log('1. Verifying Homepage (index.html), CSS & Gallery JS...');
    const galleryJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'gallery.js'), 'utf8');
    assert(!galleryJs.includes("'contentUrl': 'https://www.kumpulenak.my.id/'"), 'gallery.js MUST NOT inject VideoObject with homepage contentUrl');
    assert(!galleryJs.includes("label: 'ID Indo'"), 'gallery.js MUST NOT show "ID Indo" sort button on US/EU site');
    assert(!galleryJs.includes('Video Leaks'), 'gallery.js MUST NOT inject policy-risk word "Leaks"');
    assert(galleryJs.includes('nofollow sponsored'), 'gallery.js promo link must include nofollow sponsored');

    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    checkBalancedDivs(indexHtml, 'index.html');
    assert(!indexHtml.includes('"@type": "VideoObject"'), 'index.html MUST NOT declare VideoObject on non-watch gallery page');
    assert(indexHtml.includes('<title>'), 'index.html missing <title>');
    assert(indexHtml.includes('<meta name="description"'), 'index.html missing meta description');
    assert(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.kumpulenak\.my\.id\/"/.test(indexHtml), 'index.html invalid canonical');
    assert(!indexHtml.includes('hreflang="id"'), 'index.html should not have conflicting hreflang="id"');
    assert(indexHtml.includes('hreflang="en-US"') && indexHtml.includes('hreflang="de-DE"') && indexHtml.includes('hreflang="fr-FR"') && indexHtml.includes('hreflang="es-ES"') && indexHtml.includes('hreflang="it-IT"') && indexHtml.includes('hreflang="nl-NL"') && indexHtml.includes('hreflang="pl-PL"'), 'index.html missing reciprocal EU/US hreflang cluster');
    assert(indexHtml.includes('application/rss+xml'), 'index.html missing RSS autodiscovery');
    assert(indexHtml.includes('<a href="/" class="logo"'), 'index.html logo must be a crawlable <a> tag');
    assert(indexHtml.includes('<a href="/trending" class="nav-tab"'), 'index.html header nav must have crawlable /trending link');
    assert(indexHtml.includes('href="/site.webmanifest"'), 'index.html must reference /site.webmanifest');
    assert(indexHtml.includes('"@type": "WebSite"'), 'index.html missing WebSite schema');
    assert(indexHtml.includes('"@type": "Organization"'), 'index.html missing Organization schema');
    assert(indexHtml.includes('"@type": "ItemList"'), 'index.html missing ItemList schema');
    assert(indexHtml.includes('rel="preload" as="image"'), 'index.html missing LCP image preload');
    assert(indexHtml.includes(ADSTERRA_NATIVE_SCRIPT) && indexHtml.includes(ADSTERRA_NATIVE_CONTAINER), 'index.html missing Adsterra Native Banner');
    assert(!indexHtml.includes('class="ad-native-space"'), 'index.html must not wrap Adsterra Native Banner in ad-native-space');

    const homeTitles = extractCardTitles(indexHtml);
    assert(homeTitles.length >= 20, `index.html expected >=20 cards, got ${homeTitles.length}`);
    for (const t of homeTitles) {
        assert(isUSEUFriendly({ title: t }), `index.html card title failed US/EU purity filter: ${t}`);
    }
    console.log(`   ✅ Homepage passed all SEO, 100% US/EU curation (${homeTitles.length}/${homeTitles.length} cards), balanced DOM & Adsterra checks.\n`);

    // 2. 6 Native-Language European Hubs Verification
    console.log('2. Verifying 6 Native European Language Hubs (/de, /fr, /es, /it, /nl, /pl)...');
    for (const hub of EU_HUBS) {
        const hubPath = path.join(ROOT, hub.file);
        assert(fs.existsSync(hubPath), `Missing EU hub file: ${hub.file}`);
        const html = fs.readFileSync(hubPath, 'utf8');
        checkBalancedDivs(html, hub.file);
        assert(html.includes(`<html lang="${hub.code}"`), `${hub.file} wrong html lang`);
        assert(html.includes(`<link rel="canonical" id="canonicalLink" href="https://www.kumpulenak.my.id${hub.path}"`), `${hub.file} invalid canonical`);
        assert(html.includes('hreflang="en-US"') && html.includes(`hreflang="${hub.code}"`) && html.includes('hreflang="x-default"'), `${hub.file} missing reciprocal hreflang`);
        assert(html.includes('"@type": "CollectionPage"'), `${hub.file} missing CollectionPage schema`);
        assert(html.includes('"@type": "FAQPage"'), `${hub.file} missing FAQPage schema`);
        assert(html.includes('"@type": "ItemList"'), `${hub.file} missing ItemList schema`);
        assert(!getTopLevelSchemaTypes(html).includes('WebSite'), `${hub.file} should not duplicate top-level homepage WebSite schema`);
        assert(html.includes('application/rss+xml'), `${hub.file} missing RSS link`);
        assert(html.includes(ADSTERRA_NATIVE_SCRIPT) && html.includes(ADSTERRA_NATIVE_CONTAINER), `${hub.file} missing Adsterra Native Banner`);
        assert(!html.includes('class="ad-native-space"'), `${hub.file} must not wrap Adsterra Native Banner`);
        const cards = extractCardTitles(html);
        assert(cards.length >= 16, `${hub.file} expected >=16 cards, got ${cards.length}`);
    }
    console.log('   ✅ All 6 Native EU Language Hubs passed reciprocal hreflang, schema, DOM & Adsterra checks.\n');

    // 3. Directory & Trending Hub Verification
    console.log('3. Verifying HTML Video Directory (/directory.html) & Top 100 US/EU Chart (/trending.html)...');
    const dirHtml = fs.readFileSync(path.join(ROOT, 'directory.html'), 'utf8');
    checkBalancedDivs(dirHtml, 'directory.html');
    const dirTitle = (dirHtml.match(/<title>([\s\S]*?)<\/title>/i) || ['', ''])[1].replace(/&amp;/g, '&');
    assert(dirTitle.length <= 65, `directory.html title too long (${dirTitle.length} chars)`);
    assert(dirHtml.includes('<link rel="canonical" href="https://www.kumpulenak.my.id/directory">'), 'directory.html invalid canonical');
    assert(dirHtml.includes('name="twitter:image"'), 'directory.html missing twitter:image');
    assert(dirHtml.includes('application/rss+xml'), 'directory.html missing RSS link');
    assert(dirHtml.includes('href="/de"') && dirHtml.includes('href="/fr"'), 'directory.html missing EU hub links');
    assert(dirHtml.includes(ADSTERRA_NATIVE_SCRIPT), 'directory.html missing Adsterra Native Banner');

    const trendHtml = fs.readFileSync(path.join(ROOT, 'trending.html'), 'utf8');
    checkBalancedDivs(trendHtml, 'trending.html');
    assert(trendHtml.includes('<link rel="canonical" id="canonicalLink" href="https://www.kumpulenak.my.id/trending">'), 'trending.html invalid canonical');
    assert(trendHtml.includes('"@type": "CollectionPage"'), 'trending.html missing CollectionPage schema');
    assert(!getTopLevelSchemaTypes(trendHtml).includes('WebSite'), 'trending.html should not duplicate top-level homepage WebSite schema');
    assert(trendHtml.includes(ADSTERRA_NATIVE_SCRIPT) && trendHtml.includes(ADSTERRA_NATIVE_CONTAINER), 'trending.html missing Adsterra Native Banner');
    const trendTitles = extractCardTitles(trendHtml);
    assert(trendTitles.length >= 60, `trending.html expected >=60 US/EU cards, got ${trendTitles.length}`);
    for (const t of trendTitles) {
        assert(isUSEUFriendly({ title: t }), `trending.html card failed US/EU purity filter: ${t}`);
    }
    console.log(`   ✅ Directory & Trending Top 100 Hub (${trendTitles.length} 100% US/EU cards) passed all checks.\n`);

    // 4. Category Hub Verification
    console.log('4. Verifying Category Hub Pages (amateur, european, british, german, french, american)...');
    for (const slug of ['amateur', 'european', 'british', 'german', 'french', 'american']) {
        const catHtml = fs.readFileSync(path.join(ROOT, 'category', `${slug}.html`), 'utf8');
        checkBalancedDivs(catHtml, `category/${slug}.html`);
        assert(catHtml.includes(`<link rel="canonical" id="canonicalLink" href="https://www.kumpulenak.my.id/category/${slug}"`), `${slug} canonical invalid`);
        assert(catHtml.includes('hreflang="en-US"'), `${slug} missing hreflang="en-US"`);
        assert(catHtml.includes('application/rss+xml'), `${slug} missing RSS link`);
        assert(catHtml.includes('"@type": "CollectionPage"'), `${slug} CollectionPage missing`);
        assert(catHtml.includes('"@type": "BreadcrumbList"'), `${slug} BreadcrumbList missing`);
        assert(catHtml.includes('"@type": "ItemList"'), `${slug} ItemList missing`);
        assert(catHtml.includes('"@type": "FAQPage"'), `${slug} FAQPage missing`);
        assert(!getTopLevelSchemaTypes(catHtml).includes('WebSite'), `${slug} should not duplicate top-level homepage WebSite schema`);
        assert(catHtml.includes(ADSTERRA_NATIVE_SCRIPT) && catHtml.includes(ADSTERRA_NATIVE_CONTAINER), `${slug} missing Adsterra Native Banner`);
    }
    console.log('   ✅ All checked US/EU Category Hubs passed all checks.\n');

    // 5. SSR Video Page Verification
    console.log('5. Verifying SSR Video Handler (api/video.js)...');
    let videoHtml = '';
    const resMock = {
        setHeader: () => {},
        status: (code) => {
            assert.strictEqual(code, 200, 'Active video should return 200');
            return { send: (b) => { videoHtml = b; } };
        }
    };
    await handler({ url: '/v/8XAT108xJ1o-putinha-engolindo-tudo', query: { slug: '8XAT108xJ1o-putinha-engolindo-tudo' } }, resMock);
    const videoBytes = Buffer.byteLength(videoHtml, 'utf8');
    assert(videoBytes < 22000, `Video SSR payload too large (${videoBytes} bytes); keep < 22KB to protect Vercel Fast Origin Transfer`);
    assert(videoHtml.includes('<h1 class="video-title">'), 'Video H1 missing');
    assert(/"@type"\s*:\s*"VideoObject"/.test(videoHtml), 'Video VideoObject schema missing');
    assert(!videoHtml.includes('"regionsAllowed"'), 'VideoObject must NOT restrict rich results with regionsAllowed');
    assert(videoHtml.includes('"publisher"'), 'VideoObject missing publisher Organization');
    assert(videoHtml.includes('name="twitter:image"'), 'Video page missing twitter:image');
    assert(videoHtml.includes('property="og:video"'), 'Video page missing og:video');
    assert(videoHtml.includes('id="videoPlayer"'), 'Video player iframe missing');
    assert(!videoHtml.includes('<a href="/?q='), 'Video SSR output must not contain crawlable <a href="/?q=..."> links');
    assert(videoHtml.includes(ADSTERRA_NATIVE_SCRIPT), 'Video SSR output missing Adsterra Native Banner');
    console.log(`   ✅ SSR Video Handler passed all checks (lean ${videoBytes} bytes).\n`);

    // 6. True 404 & Absolute CSS Verification
    console.log('6. Verifying True 404 Response & 404.html Absolute Asset Paths...');
    const html404 = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
    assert(!html404.includes('href="assets/'), '404.html MUST NOT use relative assets/ CSS path');
    assert(html404.includes('href="/assets/css/gallery.css'), '404.html must use absolute /assets/css path');
    let notFoundCode = null;
    const res404 = {
        setHeader: () => {},
        status: (code) => {
            notFoundCode = code;
            return { send: () => {} };
        }
    };
    await handler({ url: '/v/invalid_video_slug', query: {} }, res404);
    assert.strictEqual(notFoundCode, 404, 'Invalid video must return genuine HTTP 404');
    console.log('   ✅ Genuine 404 & absolute CSS passed.\n');

    // 7. robots.txt, vercel.json & Sitemaps Verification
    console.log('7. Verifying robots.txt, vercel.json Edge Rules, sitemaps & RSS...');
    const robotsTxt = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    assert(!robotsTxt.includes('Disallow: /*?*q='), 'robots.txt must NOT disallow /*?*q=');
    assert(robotsTxt.includes('Allow: /de') && robotsTxt.includes('Allow: /fr'), 'robots.txt missing EU hub allow rules');

    const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    assert.strictEqual(vercelConfig.trailingSlash, false, 'vercel.json must enforce trailingSlash: false');
    assert(vercelConfig.functions && vercelConfig.functions['api/video.js'] && vercelConfig.functions['api/video.js'].maxDuration <= 10, 'vercel.json must cap api/video.js maxDuration <= 10s');
    const botRewriteIdx = (vercelConfig.rewrites || []).findIndex(r => r.source === '/v/:path*' && r.destination === '/404.html');
    const apiRewriteIdx = (vercelConfig.rewrites || []).findIndex(r => r.source === '/v/:path*' && r.destination === '/api/video?slug=:path*');
    assert(botRewriteIdx >= 0 && botRewriteIdx < apiRewriteIdx, 'vercel.json must block scraper bots before /api/video rewrite');
    const botNoCacheHeader = (vercelConfig.headers || []).find(h => h.source === '/v/:path*' && h.has && h.has.some(c => c.key === 'user-agent') && (h.headers || []).some(hdr => hdr.key === 'Cache-Control' && hdr.value.includes('no-store')));
    assert(botNoCacheHeader, 'vercel.json must set Cache-Control: private, no-store on bot-blocked /v/ responses to prevent CDN cache poisoning');
    assert(vercelConfig.headers.some(h => h.source === '/'), 'vercel.json must have explicit "/" header rule');
    assert(vercelConfig.headers.some(h => h.has && h.has.some(q => q.key === 'page')), 'vercel.json must send noindex on ?page= parameter');
    for (const hBlock of vercelConfig.headers || []) {
        if (hBlock.source && hBlock.source.includes('sitemap') && hBlock.source.endsWith('.xml')) {
            const hasNoindex = (hBlock.headers || []).some(h => h.key.toLowerCase() === 'x-robots-tag');
            assert(!hasNoindex, `vercel.json must NOT send X-Robots-Tag header on ${hBlock.source}`);
        }
    }

    const pagesSitemap = fs.readFileSync(path.join(ROOT, 'sitemaps', 'sitemap_pages.xml'), 'utf8');
    assert(pagesSitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), 'sitemap_pages.xml missing xhtml hreflang namespace');
    assert(pagesSitemap.includes('https://www.kumpulenak.my.id/de'), 'sitemap_pages.xml missing /de hub');

    const flatSitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert(flatSitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'sitemap.xml must be pure standard <urlset>');
    assert(!flatSitemapXml.includes('\r'), 'sitemap.xml must use clean LF line endings');
    assert(!isHarmfulContent(flatSitemapXml), 'sitemap.xml must not contain harmful content');
    console.log('   ✅ Edge rules, robots.txt, and sitemaps passed all checks.\n');

    // 8. Trust Pages Verification
    console.log('8. Verifying Trust Pages (about, dmca, contact, privacy, terms, howto)...');
    const trustFiles = ['about.html', 'dmca.html', 'contact.html', 'privacy.html', 'terms.html', 'howto.html'];
    for (const tf of trustFiles) {
        const content = fs.readFileSync(path.join(ROOT, tf), 'utf8');
        checkBalancedDivs(content, tf);
        assert(!content.includes('href="assets/'), `${tf} must not use relative assets/ CSS paths`);
        assert(!/\*\*[^*<>]{2,80}\*\*/.test(content), `${tf} contains raw markdown **...**`);
        assert(!content.includes('"sameAs": []'), `${tf} contains empty sameAs array`);
        assert(content.includes('"@type": "BreadcrumbList"'), `${tf} missing BreadcrumbList schema`);
        assert(content.includes('name="twitter:image"'), `${tf} missing twitter:image`);
        assert(content.includes('application/rss+xml'), `${tf} missing RSS link`);
        assert(content.includes('<a href="/" class="logo"'), `${tf} logo must be crawlable <a>`);
        assert((content.match(/rel="manifest"/g) || []).length === 1, `${tf} must have exactly 1 manifest link`);
    }
    console.log('   ✅ All 6 trust pages passed E-E-A-T, schema, clean HTML & asset checks.\n');

    console.log('🎉 ALL COMPREHENSIVE US & EUROPE SEO + ADSTERRA VERIFICATION CHECKS PASSED!');
}

verifyAll().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
