'use strict';

const fs = require('fs');
const path = require('path');
const { generateItemListSchema, BASE_URL } = require('./schema-helper');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');

const HARMFUL_KEYWORDS = [
    'teen', 'teenager', 'underage', 'minor', 'child', 'kid',
    'young girl', 'young boy', 'loli', 'shota', 'preteen',
    'onlyfans', 'leaked', 'leak', 'student', 'school',
    'college girl', 'high school', 'jailbait', 'barely legal'
];

function cleanFancyText(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.replace(/[\uD835][\uDC00-\uDFFF]/g, ' '); 
    return clean.replace(/\s+/g, ' ').trim();
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isHarmfulVideo(video) {
    const title = (video.title || video.name || '').toLowerCase();
    const keywords = (video.keywords || '').toLowerCase();
    const combined = title + ' ' + keywords;
    return HARMFUL_KEYWORDS.some(kw => combined.includes(kw));
}

function generateCardHTML(video) {
    const title = cleanFancyText(video.title || 'Untitled');
    const safeTitle = escapeHTML(title);
    const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
    const videoUrl = `/v/${video.id}${slug ? '-' + slug : ''}`;
    const thumbUrl = (video.default_thumb && video.default_thumb.src) ? video.default_thumb.src : '';
    const views = video.views ? Number(video.views).toLocaleString('en-US') : '0';
    const added = video.added ? video.added.slice(0, 10) : '';
    const length = video.length_min || '';
    const rate = video.rate || '';

    let badges = '';
    if (length) badges += `<span class="badge-duration">${escapeHTML(length)}</span>`;
    if (rate) badges += `<span class="badge-rating">⭐ ${escapeHTML(String(rate))}</span>`;

    return `                <a href="${escapeHTML(videoUrl)}" class="card" aria-label="${safeTitle}">
                    <div class="card-img-wrapper">
                        ${badges}
                        <img src="${escapeHTML(thumbUrl)}" alt="${safeTitle} thumbnail" width="360" height="202" loading="lazy" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
                    </div>
                    <div class="card-meta">
                        <div class="card-date-views">
                            <span class="card-date">📅 ${escapeHTML(added)}</span>
                            <span class="card-views">👁 ${escapeHTML(views)}</span>
                        </div>
                        <h3 class="card-title">${safeTitle}</h3>
                    </div>
                </a>`;
}

async function prerenderHome() {
    console.log('Pre-rendering popular videos for index.html...');
    const url = 'https://www.eporner.com/api/v2/video/search/?per_page=30&page=1&thumbsize=big&order=most-popular&gay=0&lq=1&format=json';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.videos)) throw new Error('Invalid API response');

    const cleanVideos = data.videos.filter(v => !isHarmfulVideo(v)).slice(0, 24);
    if (cleanVideos.length === 0) throw new Error('No clean videos returned');

    const cardsHtml = cleanVideos.map(generateCardHTML).join('\n');
    let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // Replace cardGrid contents (anchored to <!-- PAGINATION --> to avoid terminating on nested </div>)
    const cardGridRegex = /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/;
    indexHtml = indexHtml.replace(
        cardGridRegex,
        `<div class="card-grid" id="cardGrid">\n${cardsHtml}\n            </div>\n\n            <!-- PAGINATION -->`
    );

    // Build ItemList JSON-LD
    const cardItems = cleanVideos.map(v => {
        const title = cleanFancyText(v.title || 'Untitled');
        const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
        return {
            title: title,
            url: `${BASE_URL}/v/${v.id}${slug ? '-' + slug : ''}`,
            image: (v.default_thumb && v.default_thumb.src) ? v.default_thumb.src : ''
        };
    });
    const itemListSchema = generateItemListSchema('Trending Viral Videos', 'Trending viral videos and exclusive adult content on kumpulenak.', cardItems);

    // Remove old ItemList if present
    indexHtml = indexHtml.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    // Insert ItemList right before <!-- Gallery Styles -->
    const itemListHtml = `\n    <!-- JSON-LD ItemList -->\n    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`;
    indexHtml = indexHtml.replace('<!-- Gallery Styles -->', `${itemListHtml}\n\n    <!-- Gallery Styles -->`);

    fs.writeFileSync(INDEX_HTML_PATH, indexHtml, 'utf8');
    console.log(`✅ Pre-rendered ${cleanVideos.length} cards and updated ItemList schema in index.html`);
}

prerenderHome().catch(err => {
    console.error('Error pre-rendering index.html:', err);
    process.exit(1);
});
