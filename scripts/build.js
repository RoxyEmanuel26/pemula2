'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function run(scriptName) {
    console.log(`\n▶ Running ${scriptName}...`);
    execFileSync('node', [path.join(ROOT, scriptName)], {
        cwd: ROOT,
        stdio: 'inherit'
    });
}

try {
    console.log('🚀 Starting SEO Build Pipeline for kumpulenak...');

    // 1. Run unit tests
    run('scripts/test-sitemap.js');
    run('scripts/test-video-handler.js');

    // 2. Pre-render home cards
    run('scripts/prerender-home.js');

    console.log('\n✨ Build completed successfully! All checks passed.');
} catch (err) {
    console.error('\n❌ Build failed:', err.message);
    process.exit(1);
}
