'use strict';

const fs = require('fs');
const path = require('path');
const { getCategoryEditorial } = require('./category-intros');

const CATEGORY_DIR = path.join(__dirname, '..', 'category');

function buildEditorialHTML(editorial) {
    const paragraphsHtml = editorial.paragraphs
        .map(p => `                <p>${p}</p>`)
        .join('\n');

    return `\n            <!-- Category Editorial Hub Content (SEO Fase 5A) -->
            <section class="category-editorial" aria-label="About this collection">
                <h2>${editorial.heading}</h2>
${paragraphsHtml}
            </section>\n`;
}

function processCategoryFile(filePath) {
    const filename = path.basename(filePath);
    const slug = filename.replace(/\.html$/, '');
    let html = fs.readFileSync(filePath, 'utf8');

    // Extract title from <h1 class="main-seo-title">...</h1>
    let title = slug.replace(/-/g, ' ');
    const h1Match = html.match(/<h1 class="main-seo-title">([\s\S]*?)<\/h1>/);
    if (h1Match) {
        title = h1Match[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
    }

    const editorial = getCategoryEditorial(slug, title);
    const editorialHtml = buildEditorialHTML(editorial);

    // Remove any existing category-editorial section if present
    html = html.replace(/\s*<!-- Category Editorial Hub Content[\s\S]*?<\/section>/g, '');

    // Insert right after <p class="main-seo-desc"> if present, otherwise right after <h1 class="main-seo-title">
    const descRegex = /(<p class="main-seo-desc" id="mainSeoDesc">[\s\S]*?<\/p>)/;
    if (descRegex.test(html)) {
        html = html.replace(descRegex, `$1${editorialHtml}`);
        fs.writeFileSync(filePath, html, 'utf8');
        return true;
    }

    const h1Regex = /(<h1 class="main-seo-title">[\s\S]*?<\/h1>)/;
    if (h1Regex.test(html)) {
        html = html.replace(h1Regex, `$1${editorialHtml}`);
        fs.writeFileSync(filePath, html, 'utf8');
        return true;
    }

    return false;
}

function main() {
    console.log('Injecting editorial introductory content into 85 category hub pages...');
    const files = fs.readdirSync(CATEGORY_DIR).filter(f => f.endsWith('.html'));

    let count = 0;
    files.forEach(file => {
        const fullPath = path.join(CATEGORY_DIR, file);
        if (processCategoryFile(fullPath)) {
            count++;
        }
    });

    console.log(`✅ Successfully injected unique editorial content into ${count} category hub pages!`);
}

main();
