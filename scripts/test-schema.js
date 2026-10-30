'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    generateWebSiteSchema,
    generateOrganizationSchema,
    generateBreadcrumbSchema,
    generateVideoSchema,
    generateItemListSchema
} = require('./schema-helper');

console.log('Testing Schema Helper (SEO FASE 3)...');

// 1. WebSite
const ws = generateWebSiteSchema();
assert.strictEqual(ws['@type'], 'WebSite');
assert.strictEqual(ws.potentialAction['@type'], 'SearchAction');
console.log('✅ WebSite Schema valid');

// 2. Organization
const org = generateOrganizationSchema();
assert.strictEqual(org['@type'], 'Organization');
assert.strictEqual(org.url, 'https://www.kumpulenak.my.id');
console.log('✅ Organization Schema valid');

// 3. BreadcrumbList
const bc = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://www.kumpulenak.my.id/' },
    { name: 'Amateur', url: 'https://www.kumpulenak.my.id/category/amateur' },
    { name: 'Test Video', url: 'https://www.kumpulenak.my.id/v/123-test' }
]);
assert.strictEqual(bc['@type'], 'BreadcrumbList');
assert.strictEqual(bc.itemListElement.length, 3);
assert.strictEqual(bc.itemListElement[1].position, 2);
assert.strictEqual(bc.itemListElement[1].name, 'Amateur');
console.log('✅ BreadcrumbList Schema valid');

// 4. VideoObject
const vo = generateVideoSchema({
    id: '8XAT108xJ1o',
    title: 'Hot Viral Clip',
    description: 'Watch Hot Viral Clip in full HD',
    thumbnailUrl: 'https://static.example.com/thumb.jpg',
    uploadDate: '2026-10-29',
    durationSec: 180,
    embedUrl: 'https://www.eporner.com/embed/8XAT108xJ1o/',
    views: 125000
});
assert.strictEqual(vo['@type'], 'VideoObject');
assert.strictEqual(vo.name, 'Hot Viral Clip');
assert.strictEqual(vo.duration, 'PT180S');
assert.strictEqual(vo.uploadDate, '2026-10-29T00:00:00Z');
assert.strictEqual(vo.interactionStatistic.userInteractionCount, 125000);
console.log('✅ VideoObject Schema valid');

// 5. ItemList
const il = generateItemListSchema('Amateur Videos', 'Watch the best amateur videos', [
    { title: 'Video 1', url: 'https://www.kumpulenak.my.id/v/1-vid', image: 'https://img.test/1.jpg' },
    { title: 'Video 2', url: 'https://www.kumpulenak.my.id/v/2-vid', image: 'https://img.test/2.jpg' }
]);
assert.strictEqual(il['@type'], 'ItemList');
assert.strictEqual(il.numberOfItems, 2);
assert.strictEqual(il.itemListElement[0].position, 1);
assert.strictEqual(il.itemListElement[0].name, 'Video 1');
console.log('✅ ItemList Schema valid');

// 6. Test sample category HTML files for valid embedded JSON-LD scripts
const sampleCategories = ['amateur.html', 'asian.html', 'milf.html'];
const catDir = path.join(__dirname, '..', 'category');

sampleCategories.forEach(catFile => {
    const filePath = path.join(catDir, catFile);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract all <script type="application/ld+json">...</script>
    const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let match;
    const typesFound = [];
    while ((match = scriptRegex.exec(content)) !== null) {
        const rawJson = match[1].trim();
        const parsed = JSON.parse(rawJson);
        const type = parsed['@type'] || (parsed['@graph'] ? 'Graph' : null);
        if (type) typesFound.push(type);
    }

    assert(typesFound.includes('BreadcrumbList'), `${catFile} missing BreadcrumbList`);
    assert(typesFound.includes('ItemList'), `${catFile} missing ItemList`);
    console.log(`✅ ${catFile} JSON-LD valid: types [${typesFound.join(', ')}]`);
});

console.log('All Schema Helper & Structured Data unit tests passed successfully!');
