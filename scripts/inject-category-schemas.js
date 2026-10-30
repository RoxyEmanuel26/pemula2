'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    generateBreadcrumbSchema,
    generateItemListSchema
} = require('./schema-helper');

const CATEGORY_DIR = path.join(__dirname, '..', 'category');

function parseCardsFromHTML(html) {
    const cards = [];
    const cardRegex = /<a href="([^"]+)" class="card"[^>]*>[\s\S]*?<img src="([^"]+)"[^>]*>[\s\S]*?<h3 class="card-title">([\s\S]*?)<\/h3>/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const rawImg = match[2];
        const rawTitle = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`;
        cards.push({
            title: rawTitle,
            url: fullUrl,
            image: rawImg
        });
    }
    return cards;
}

function extractCategoryInfo(html, filename) {
    const slug = filename.replace(/\.html$/, '');
    
    // Extract title from <h1 class="main-seo-title">...</h1> or <title>
    let title = '';
    const h1Match = html.match(/<h1 class="main-seo-title">([\s\S]*?)<\/h1>/);
    if (h1Match) {
        title = h1Match[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
    } else {
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
        if (titleMatch) {
            title = titleMatch[1].split(' - ')[0].split(' | ')[0].trim();
        }
    }

    // Extract description
    let desc = '';
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    if (descMatch) {
        desc = descMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
    }

    const canonicalUrl = `${BASE_URL}/category/${slug}`;
    return { slug, title, desc, canonicalUrl };
}

function processCategoryFile(filePath) {
    const filename = path.basename(filePath);
    let html = fs.readFileSync(filePath, 'utf8');

    const info = extractCategoryInfo(html, filename);
    const cards = parseCardsFromHTML(html);

    // 1. Remove old/duplicate breadcrumb scripts
    // Remove injected <!-- Category Breadcrumb --> ... </script>
    html = html.replace(/\s*<!-- Category Breadcrumb -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    
    // Remove existing <!-- JSON-LD BreadcrumbList --> ... </script>
    html = html.replace(/\s*<!-- JSON-LD BreadcrumbList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    // Remove any existing <!-- JSON-LD ItemList --> ... </script>
    html = html.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    // 2. Build structured data
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: 'Home', url: `${BASE_URL}/` },
        { name: info.title, url: info.canonicalUrl }
    ]);

    const itemListSchema = generateItemListSchema(info.title, info.desc, cards);

    let schemasHtml = '\n    <!-- JSON-LD BreadcrumbList -->\n';
    schemasHtml += `    <script type="application/ld+json">\n${JSON.stringify(breadcrumbSchema, null, 2)}\n    </script>\n`;
    
    if (itemListSchema && itemListSchema.itemListElement.length > 0) {
        schemasHtml += '\n    <!-- JSON-LD ItemList -->\n';
        schemasHtml += `    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>\n`;
    }

    // Insert right after Organization script or before gallery.css
    if (html.includes('<!-- Gallery Styles -->')) {
        html = html.replace('<!-- Gallery Styles -->', `${schemasHtml}\n    <!-- Gallery Styles -->`);
    } else {
        html = html.replace('</head>', `${schemasHtml}\n</head>`);
    }

    fs.writeFileSync(filePath, html, 'utf8');
    return { filename, cardCount: cards.length };
}

function main() {
    console.log('Injecting JSON-LD BreadcrumbList and ItemList into category pages...');
    const files = fs.readdirSync(CATEGORY_DIR).filter(f => f.endsWith('.html'));
    console.log(`Found ${files.length} category files.`);

    let totalCards = 0;
    files.forEach(file => {
        const fullPath = path.join(CATEGORY_DIR, file);
        const res = processCategoryFile(fullPath);
        totalCards += res.cardCount;
    });

    console.log(`✅ Successfully updated ${files.length} category files with BreadcrumbList & ItemList! Total cards indexed in schema: ${totalCards}`);
}

main();
