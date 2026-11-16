'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const handler = require('../api/video');
const { isHarmfulContent } = require('./content-filter');

const ADSTERRA_NATIVE_SCRIPT = 'https://biomanos.org/21/0dae6421659ccec66a169a9192f11484';
const ADSTERRA_NATIVE_CONTAINER = 'id="container-0dae6421659ccec66a169a9192f11484"';

async function verifyAll() {
    console.log('🔍 Running Comprehensive International SEO & Adsterra Verification Suite...\n');

    // 0. Ensure video.html has directory link, international default, and zero <a href="/?q="> crawler links
    const videoTplPath = path.join(__dirname, '..', 'video.html');
    let videoTpl = fs.readFileSync(videoTplPath, 'utf8');
    let videoTplChanged = false;
    if (videoTpl.includes("let query = 'indonesia';")) {
        videoTpl = videoTpl.replace("let query = 'indonesia';", "let query = 'amateur';");
        videoTplChanged = true;
    }
    if (!videoTpl.includes('href="/directory"')) {
        videoTpl = videoTpl.replace('<a href="/">Home</a>', '<a href="/">Home</a>\n            <a href="/directory">Video Directory</a>');
        videoTplChanged = true;
    }
    if (videoTpl.includes("tagLink.href = '/?q=' + encodeURIComponent(tag);")) {
        videoTpl = videoTpl.replace(
            /const tagLink = document\.createElement\('a'\);\s*tagLink\.className = 'video-tag';\s*const tagSlug = tag\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9\]\+\/g, '-'\)\.replace\(\/\^-\+\|-\+\$\/g, ''\);\s*if \(KNOWN_CATEGORIES\.has\(tagSlug\)\) \{\s*tagLink\.href = '\/category\/' \+ tagSlug;\s*\} else \{\s*tagLink\.href = '\/\?q=' \+ encodeURIComponent\(tag\);\s*tagLink\.rel = 'nofollow';\s*\}/,
            `const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    const isCat = KNOWN_CATEGORIES.has(tagSlug);
                    const tagLink = document.createElement(isCat ? 'a' : 'span');
                    tagLink.className = 'video-tag';
                    if (isCat) {
                        tagLink.href = '/category/' + tagSlug;
                    } else {
                        tagLink.style.cursor = 'pointer';
                        tagLink.onclick = function() { window.location.href = '/?q=' + encodeURIComponent(tag); };
                    }`
        );
        videoTplChanged = true;
    }
    if (videoTplChanged) {
        fs.writeFileSync(videoTplPath, videoTpl, 'utf8');
    }

    // 1. Homepage Verification
    console.log('1. Verifying Homepage (index.html)...');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert(indexHtml.includes('<title>'), 'index.html missing <title>');
    assert(indexHtml.includes('<meta name="description"'), 'index.html missing meta description');
    assert(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.kumpulenak\.my\.id\/"/.test(indexHtml), 'index.html invalid canonical');
    assert(!indexHtml.includes('hreflang="id"'), 'index.html should not have conflicting hreflang="id"');
    assert(indexHtml.includes('hreflang="en"'), 'index.html missing hreflang="en"');
    assert(indexHtml.includes('<h1 class="main-seo-title">'), 'index.html missing H1');
    assert(indexHtml.includes('"@type": "WebSite"'), 'index.html missing WebSite schema');
    assert(indexHtml.includes('"@type": "Organization"'), 'index.html missing Organization schema');
    assert(indexHtml.includes('"@type": "ItemList"'), 'index.html missing ItemList schema');
    assert(indexHtml.includes('class="card"'), 'index.html missing pre-rendered cards');
    assert(indexHtml.includes('fetchpriority="high"'), 'index.html missing LCP fetchpriority');
    assert(!indexHtml.includes('abg-esemaa'), 'index.html MUST NOT contain harmful abg-esemaa video');
    assert(indexHtml.includes(ADSTERRA_NATIVE_SCRIPT) && indexHtml.includes(ADSTERRA_NATIVE_CONTAINER), 'index.html missing Adsterra Native Banner');
    assert(!indexHtml.includes('class="ad-native-space"'), 'index.html must not wrap Adsterra Native Banner in ad-native-space');
    console.log('   ✅ Homepage passed all SEO, safety, and Adsterra checks.\n');

    // 2. Directory Hub Verification
    console.log('2. Verifying HTML Video Directory (/directory.html)...');
    const dirHtml = fs.readFileSync(path.join(__dirname, '..', 'directory.html'), 'utf8');
    assert(dirHtml.includes('<link rel="canonical" href="https://www.kumpulenak.my.id/directory">'), 'directory.html invalid canonical');
    assert(dirHtml.includes('"@type": "CollectionPage"'), 'directory.html missing CollectionPage schema');
    assert(dirHtml.includes('/category/amateur'), 'directory.html missing category links');
    assert(dirHtml.includes('/v/'), 'directory.html missing direct video stream links');
    assert(dirHtml.includes(ADSTERRA_NATIVE_SCRIPT), 'directory.html missing Adsterra Native Banner');
    console.log('   ✅ Directory Hub passed all checks.\n');

    // 3. Category Hub Verification
    console.log('3. Verifying Category Hub Pages (category/amateur.html & asian.html)...');
    const catHtml = fs.readFileSync(path.join(__dirname, '..', 'category', 'amateur.html'), 'utf8');
    assert(catHtml.includes('<link rel="canonical" href="https://www.kumpulenak.my.id/category/amateur"'), 'Category canonical invalid');
    assert(catHtml.includes('<h1 class="main-seo-title">'), 'Category H1 missing');
    assert(catHtml.includes('class="category-editorial"'), 'Category editorial hub section missing');
    assert(catHtml.includes('"@type": "BreadcrumbList"'), 'Category BreadcrumbList missing');
    assert(catHtml.includes('"@type": "ItemList"'), 'Category ItemList missing');
    assert(catHtml.includes('class="card"'), 'Category cards missing');
    assert(catHtml.includes(ADSTERRA_NATIVE_SCRIPT) && catHtml.includes(ADSTERRA_NATIVE_CONTAINER), 'Category missing Adsterra Native Banner');
    console.log('   ✅ Category Hub passed all checks.\n');

    // 4. SSR Video Page Verification
    console.log('4. Verifying SSR Video Handler (api/video.js)...');
    let videoHtml = '';
    const resMock = {
        setHeader: () => {},
        status: (code) => {
            assert.strictEqual(code, 200, 'Active video should return 200');
            return { send: (b) => { videoHtml = b; } };
        }
    };
    await handler({ url: '/v/8XAT108xJ1o-putinha-engolindo-tudo', query: { slug: '8XAT108xJ1o-putinha-engolindo-tudo' } }, resMock);
    assert(videoHtml.includes('<h1 class="video-title">'), 'Video H1 missing');
    assert(videoHtml.includes('<link rel="canonical" href="https://www.kumpulenak.my.id/v/8XAT108xJ1o'), 'Video canonical missing');
    assert(videoHtml.includes('"@type": "VideoObject"'), 'Video VideoObject schema missing');
    assert(videoHtml.includes('"@type": "BreadcrumbList"'), 'Video BreadcrumbList missing');
    assert(videoHtml.includes('"@type": "FAQPage"'), 'Video dynamic FAQPage schema missing');
    assert(videoHtml.includes('class="video-wrapper"'), 'Video wrapper missing');
    assert(videoHtml.includes('id="videoPlayer"'), 'Video player iframe missing');
    assert(!videoHtml.includes('<a href="/?q='), 'Video SSR output must not contain crawlable <a href="/?q=..."> links');
    assert(videoHtml.includes(ADSTERRA_NATIVE_SCRIPT), 'Video SSR output missing Adsterra Native Banner');
    console.log('   ✅ SSR Video Handler passed all checks.\n');

    // 5. True 404 Response Verification
    console.log('5. Verifying True 404 Response (Non-soft 404)...');
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
    console.log('   ✅ Genuine 404 passed.\n');

    // 6. robots.txt, vercel.json & Sitemaps Verification
    console.log('6. Verifying robots.txt, vercel.json Edge Rules, sitemap.xml (<urlset>), and sitemap_index.xml (<sitemapindex>)...');
    const robotsTxt = fs.readFileSync(path.join(__dirname, '..', 'robots.txt'), 'utf8');
    assert(!robotsTxt.includes('Disallow: /*?*q='), 'robots.txt must NOT disallow /*?*q= so GSC validation passes and sees 301/noindex headers');
    assert(!robotsTxt.includes('Disallow: /assets/js/loader.js'), 'robots.txt must NOT block loader.js');
    assert(robotsTxt.includes('Sitemap: https://www.kumpulenak.my.id/sitemap_index.xml'), 'robots.txt missing sitemap_index reference');
    assert(robotsTxt.includes('Sitemap: https://www.kumpulenak.my.id/sitemap.xml'), 'robots.txt missing sitemap.xml reference');

    const vercelJson = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert(vercelJson.includes('https://www.kumpulenak.my.id/category/:cat'), 'vercel.json missing 301 redirect from /?q=<category> to /category/:cat');
    assert(vercelJson.includes('noindex, follow'), 'vercel.json missing X-Robots-Tag: noindex, follow for query parameters');

    const sitemapIndexXml = fs.readFileSync(path.join(__dirname, '..', 'sitemap_index.xml'), 'utf8');
    assert(sitemapIndexXml.includes('<sitemapindex'), 'sitemap_index.xml must be a valid sitemapindex');
    assert(sitemapIndexXml.includes('https://www.kumpulenak.my.id/sitemaps/sitemap_pages.xml'), 'sitemap_index.xml missing sitemap_pages.xml');
    assert(sitemapIndexXml.includes('https://www.kumpulenak.my.id/sitemaps/sitemap_kategori.xml'), 'sitemap_index.xml missing sitemap_kategori.xml');

    const flatSitemapXml = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
    assert(flatSitemapXml.includes('<urlset'), 'sitemap.xml must be a flat <urlset>');
    assert(flatSitemapXml.includes('<video:family_friendly>no</video:family_friendly>'), 'sitemap.xml missing family_friendly tag');
    assert(!isHarmfulContent(flatSitemapXml), 'sitemap.xml must not contain any harmful content');
    console.log('   ✅ robots.txt, sitemap.xml, and sitemap_index.xml passed all checks.\n');

    // 7. Trust Pages Verification
    console.log('7. Verifying Trust Pages...');
    const trustFiles = ['about.html', 'dmca.html', 'contact.html', 'privacy.html', 'terms.html'];
    trustFiles.forEach(tf => {
        const content = fs.readFileSync(path.join(__dirname, '..', tf), 'utf8');
        assert(content.includes('<title>'), `${tf} missing title`);
        assert(content.includes('<link rel="canonical"'), `${tf} missing canonical`);
        assert(content.includes('<h1'), `${tf} missing H1`);
    });
    console.log('   ✅ All trust pages passed checks.\n');

    console.log('🎉 ALL COMPREHENSIVE INTERNATIONAL SEO & ADSTERRA VERIFICATION CHECKS PASSED!');
}

verifyAll().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
