'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getCategoryEditorial } = require('./category-intros');
const { validateEnrichment, runEnrichmentPipeline, DATA_FILE } = require('./enrich-videos');
const handler = require('../api/video');

async function runTests() {
    console.log('Testing FASE 5: Hub Pages & Gemini Enrichment Pipeline...');

    // 1. Test Category Editorial Intros
    const amateurEditorial = getCategoryEditorial('amateur', 'Amateur');
    assert(amateurEditorial.heading.length > 5, 'Editorial heading missing');
    assert.strictEqual(amateurEditorial.paragraphs.length, 3, 'Amateur should have 3 paragraphs');

    const unknownEditorial = getCategoryEditorial('unknown-tag', 'Unknown Tag');
    assert(unknownEditorial.heading.includes('Unknown Tag'), 'Fallback editorial should include title');
    assert.strictEqual(unknownEditorial.paragraphs.length, 3, 'Fallback editorial should have 3 paragraphs');
    console.log('✅ Test 1 Passed: Category Editorial Intros working correctly');

    // 2. Test Validation Gate
    const validSample = {
        video_id: 'sample123',
        seo_title: 'Sensual Couple Romance in HD | kumpulenak',
        meta_description: 'Watch Sensual Couple Romance in full HD resolution for free on kumpulenak. Stream viral adult clips with fast loading and high quality.',
        summary: 'A beautifully filmed romantic encounter between two passionate partners enjoying intimate moments. Streamed with vibrant high definition clarity and natural lighting.',
        highlights: ['Full HD 1080p stream', 'Authentic couple performance', 'Instant mobile playback'],
        tags: ['couple', 'amateur', 'romantic'],
        faq: [
            { question: 'Is this video available in full HD?', answer: 'Yes, this video streams in crisp 1080p resolution.' },
            { question: 'Can I watch on mobile devices?', answer: 'Yes, the player is fully responsive across iOS and Android.' }
        ]
    };
    const validRes = validateEnrichment('Old Boring Title', validSample);
    assert.strictEqual(validRes.valid, true, 'Valid sample should pass validation');

    // Test rejection: title too long
    const invalidTitle = { ...validSample, seo_title: 'This title is way too long to pass Google search results title limits because it exceeds sixty characters easily' };
    assert.strictEqual(validateEnrichment('Old Boring Title', invalidTitle).valid, false, 'Long title must be rejected');

    // Test rejection: meta description too short
    const shortDesc = { ...validSample, meta_description: 'Too short.' };
    assert.strictEqual(validateEnrichment('Old Boring Title', shortDesc).valid, false, 'Short meta description must be rejected');

    // Test rejection: verbatim copy of raw title
    const copyTitle = { ...validSample, seo_title: 'Original Title' };
    assert.strictEqual(validateEnrichment('Original Title', copyTitle).valid, false, 'Identical title must be rejected');
    console.log('✅ Test 2 Passed: Quality gate and anti-duplication validation working strictly');

    // 3. Test Pipeline Dry-Run / Fallback
    const pipelineRes = await runEnrichmentPipeline({ dryRun: true });
    assert.strictEqual(pipelineRes.success, true, 'Pipeline must run safely in dry-run mode');
    console.log('✅ Test 3 Passed: Enrichment pipeline dry-run and fallback runs safely');

    // 4. Test Enriched Serving in api/video.js
    // Seed test video into data/enriched-videos.json temporarily
    const originalDb = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{}';
    const testDb = {
        '8XAT108xJ1o': {
            video_id: '8XAT108xJ1o',
            seo_title: 'Exclusive Viral Clip in Ultra HD | kumpulenak',
            meta_description: 'Watch Exclusive Viral Clip in full HD resolution for free on kumpulenak. Stream viral adult clips with fast loading, instant streaming, and no sign-up.',
            summary: 'An outstanding high-definition performance capturing authentic passion and energy.',
            highlights: ['Pristine 1080p stream', 'Fast mobile loading', 'Verified community rating'],
            tags: ['viral', 'trending', 'hd'],
            faq: [
                { question: 'Does this stream buffer on mobile?', answer: 'No, optimized CDN servers deliver instant playback.' }
            ],
            status: 'enriched',
            model: 'gemini-2.5-flash',
            generated_at: new Date().toISOString(),
            attempts: 1
        }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(testDb, null, 2), 'utf8');

    let statusEnriched = null;
    let bodyEnriched = '';
    const resEnriched = {
        setHeader: () => {},
        status: (code) => {
            statusEnriched = code;
            return { send: (b) => { bodyEnriched = b; } };
        }
    };
    await handler({ url: '/v/8XAT108xJ1o-putinha-engolindo-tudo', query: { slug: '8XAT108xJ1o-putinha-engolindo-tudo' } }, resEnriched);
    assert.strictEqual(statusEnriched, 200);
    assert(bodyEnriched.includes('Exclusive Viral Clip in Ultra HD | kumpulenak'), 'Should use enriched title');
    assert(bodyEnriched.includes('video-editorial-enriched'), 'Should include enriched HTML container');
    assert(bodyEnriched.includes('FAQPage'), 'Should include FAQPage schema in @graph');
    console.log('✅ Test 4 Passed: api/video.js correctly serves enriched metadata, HTML and FAQPage schema');

    // Restore original database
    fs.writeFileSync(DATA_FILE, originalDb, 'utf8');

    console.log('All FASE 5 tests passed successfully!');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
