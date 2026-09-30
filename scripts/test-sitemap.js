'use strict';

const assert = require('assert');
const {
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
    applyActiveCap
} = require('../generate_sitemap_fast');

function fixture(overrides = {}) {
    return {
        id: 'AbC123xyz90',
        title: 'Café & "Example" <Video>',
        added: '2026-09-29 12:34:56',
        length_sec: '321',
        embed: 'https://www.eporner.com/embed/AbC123xyz90/',
        default_thumb: { src: 'https://static.example.com/thumb.jpg' },
        ...overrides
    };
}

async function run() {
    assert.strictEqual(escapeXml(`A&B <C> "D" 'E'`), 'A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
    assert.strictEqual(slugify('  Café Déjà Vu!!!  '), 'cafe-deja-vu');
    assert.strictEqual(publicationDate('2026-09-29 12:34:56'), '2026-09-29');
    assert.strictEqual(publicationDate('not-a-date'), null);
    assert.strictEqual(publicationDate('2026-02-31 12:34:56'), null);
    assert.strictEqual(decodeHtmlEntities('Tom &amp; Jerry &#39;HD&#39;'), "Tom & Jerry 'HD'");
    assert.strictEqual(repairMojibake('GrabaciÃ³n privada'), 'Grabación privada');
    assert.strictEqual(repairMojibake('LÃÂ¢mpadas'), 'Lâmpadas');

    const video = normalizeVideo(fixture());
    assert(video);
    assert.strictEqual(video.duration, 321);
    assert.strictEqual(normalizeVideo(fixture({ id: '../bad' })), null);
    assert.strictEqual(normalizeVideo(fixture({ embed: 'http://insecure.example/video' })), null);
    assert.strictEqual(normalizeVideo(fixture({ default_thumb: null })), null);

    const xml = videoSitemap([videoNode(video)]);
    assert(xml.includes('<video:video>'));
    assert(xml.includes('Café &amp; &quot;Example&quot; &lt;Video&gt;'));
    assert(!xml.includes('<changefreq>'));
    assert(!xml.includes('<priority>'));
    const parsed = parseVideoNodes(xml);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].id, video.id);

    let calls = 0;
    const result = await fetchJsonWithRetry('https://example.test', {
        retries: 2,
        timeoutMs: 100,
        delayImpl: async () => {},
        fetchImpl: async () => {
            calls++;
            if (calls === 1) return { ok: false, status: 429 };
            return { ok: true, status: 200, json: async () => ({ videos: [] }) };
        }
    });
    assert.deepStrictEqual(result, { videos: [] });
    assert.strictEqual(calls, 2);

    calls = 0;
    await assert.rejects(() => fetchJsonWithRetry('https://example.test/not-found', {
        retries: 3,
        timeoutMs: 100,
        delayImpl: async () => {},
        fetchImpl: async () => {
            calls++;
            return { ok: false, status: 404 };
        }
    }), /tidak dapat dicoba ulang/);
    assert.strictEqual(calls, 1);
    assert.throws(() => validateApiPage({ videos: [] }, 1), /kosong/);
    assert.throws(() => validateApiPage({ error: true }, 1), /tidak valid/);

    const oversized = Array.from({ length: 45001 }, (_, index) => ({ id: String(index) }));
    const capped = applyActiveCap([], oversized);
    assert.strictEqual(capped.newVideos.length, 45000);
    assert.strictEqual(capped.newVideos[0].id, '0');
    assert.strictEqual(capped.newVideos.at(-1).id, '44999');

    console.log('Sitemap unit tests passed.');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
