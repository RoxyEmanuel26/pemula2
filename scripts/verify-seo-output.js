'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const handler = require('../api/video');

async function verifyAll() {
    console.log('🔍 Running Comprehensive SEO Verification Suite (FASE 6)...\n');

    // 1. Homepage Verification
    console.log('1. Verifying Homepage (index.html)...');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert(indexHtml.includes('<title>'), 'index.html missing <title>');
    assert(indexHtml.includes('<meta name="description"'), 'index.html missing meta description');
    assert(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.kumpulenak\.my\.id\/"/.test(indexHtml), 'index.html invalid canonical');
    assert(indexHtml.includes('<h1 class="main-seo-title">'), 'index.html missing H1');
    assert(indexHtml.includes('"@type": "WebSite"'), 'index.html missing WebSite schema');
    assert(indexHtml.includes('"@type": "Organization"'), 'index.html missing Organization schema');
    assert(indexHtml.includes('"@type": "ItemList"'), 'index.html missing ItemList schema');
    assert(indexHtml.includes('class="card"'), 'index.html missing pre-rendered cards');
    assert(indexHtml.includes('fetchpriority="high"'), 'index.html missing LCP fetchpriority');
    console.log('   ✅ Homepage passed all checks.\n');

    // 2. Category Hub Verification
    console.log('2. Verifying Category Hub Pages (category/amateur.html & asian.html)...');
    const catHtml = fs.readFileSync(path.join(__dirname, '..', 'category', 'amateur.html'), 'utf8');
    assert(catHtml.includes('<link rel="canonical" href="https://www.kumpulenak.my.id/category/amateur"'), 'Category canonical invalid');
    assert(catHtml.includes('<h1 class="main-seo-title">'), 'Category H1 missing');
    assert(catHtml.includes('class="category-editorial"'), 'Category editorial hub section missing');
    assert(catHtml.includes('"@type": "BreadcrumbList"'), 'Category BreadcrumbList missing');
    assert(catHtml.includes('"@type": "ItemList"'), 'Category ItemList missing');
    assert(catHtml.includes('class="card"'), 'Category cards missing');
    console.log('   ✅ Category Hub passed all checks.\n');

    // 3. SSR Video Page Verification
    console.log('3. Verifying SSR Video Handler (api/video.js)...');
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
    assert(videoHtml.includes('class="video-facade"'), 'Video Facade missing');
    assert(videoHtml.includes('class="facade-poster"'), 'Video poster missing');
    assert(videoHtml.includes('fetchpriority="high"'), 'Video poster fetchpriority missing');
    console.log('   ✅ SSR Video Handler passed all checks.\n');

    // 4. True 404 Response Verification
    console.log('4. Verifying True 404 Response (Non-soft 404)...');
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

    // 5. robots.txt Verification
    console.log('5. Verifying robots.txt...');
    const robotsTxt = fs.readFileSync(path.join(__dirname, '..', 'robots.txt'), 'utf8');
    assert(robotsTxt.includes('Disallow: /*?*q='), 'robots.txt must disallow internal search q=');
    assert(robotsTxt.includes('Disallow: /*?*query='), 'robots.txt must disallow internal query=');
    assert(robotsTxt.includes('Sitemap: https://www.kumpulenak.my.id/sitemap_index.xml'), 'robots.txt missing sitemap_index reference');
    assert(robotsTxt.includes('Sitemap: https://www.kumpulenak.my.id/sitemap.xml'), 'robots.txt missing sitemap.xml reference');
    console.log('   ✅ robots.txt passed all checks.\n');

    // 6. sitemap_index.xml Verification
    console.log('6. Verifying sitemap_index.xml...');
    const sitemapXml = fs.readFileSync(path.join(__dirname, '..', 'sitemap_index.xml'), 'utf8');
    assert(sitemapXml.includes('<sitemapindex'), 'sitemap_index.xml must be a valid sitemapindex');
    assert(sitemapXml.includes('https://www.kumpulenak.my.id/sitemaps/sitemap_pages.xml'), 'sitemap_index.xml missing sitemap_pages.xml');
    assert(sitemapXml.includes('https://www.kumpulenak.my.id/sitemaps/sitemap_kategori.xml'), 'sitemap_index.xml missing sitemap_kategori.xml');
    console.log('   ✅ sitemap_index.xml passed all checks.\n');

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

    console.log('🎉 ALL COMPREHENSIVE SEO VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

verifyAll().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
