'use strict';

const assert = require('assert');
const handler = require('../api/video');

async function testHandler() {
    console.log('Testing api/video.js...');

    // Test 1: Invalid ID returns 404
    let status404 = null;
    let body404 = '';
    const res404 = {
        setHeader: () => {},
        status: (code) => {
            status404 = code;
            return { send: (b) => { body404 = b; } };
        }
    };
    await handler({ url: '/v/invalid!id', query: {} }, res404);
    assert.strictEqual(status404, 404, 'Invalid ID should return 404');
    console.log('✅ Test 1 Passed: Invalid ID returns 404');

    // Test 2: Deleted video returns 404
    let statusDeleted = null;
    const resDeleted = {
        setHeader: () => {},
        status: (code) => {
            statusDeleted = code;
            return { send: () => {} };
        }
    };
    await handler({ url: '/v/IZkMawC9vj9', query: { slug: 'IZkMawC9vj9' } }, resDeleted);
    assert.strictEqual(statusDeleted, 404, 'Deleted video should return 404');
    console.log('✅ Test 2 Passed: Deleted video returns 404 (eliminates Soft 404s)');

    // Test 3: Active valid video returns 200 with pre-rendered HTML
    let status200 = null;
    let body200 = '';
    const headers200 = {};
    const res200 = {
        setHeader: (k, v) => { headers200[k] = v; },
        status: (code) => {
            status200 = code;
            return { send: (b) => { body200 = b; } };
        }
    };
    await handler({ url: '/v/8XAT108xJ1o-putinha-engolindo-tudo', query: { slug: '8XAT108xJ1o-putinha-engolindo-tudo' } }, res200);
    assert.strictEqual(status200, 200, 'Valid video should return 200');
    assert(body200.includes('VideoObject'), 'HTML should contain VideoObject JSON-LD schema');
    assert(body200.includes('<h1 class="video-title">'), 'HTML should contain <h1> video title');
    assert(body200.includes('https://www.kumpulenak.my.id/v/8XAT108xJ1o'), 'HTML should contain canonical link');
    assert.strictEqual(headers200['Referrer-Policy'], 'no-referrer-when-downgrade');
    console.log('✅ Test 3 Passed: Active video returns complete pre-rendered HTML with VideoObject and <h1>');

    console.log('All api/video.js tests passed!');
}

testHandler().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
