const fs = require('fs');
const path = require('path');

const CATEGORIES = [
    { slug: 'amateur' },
    { slug: 'babe' },
    { slug: 'milf' },
    { slug: 'pov' },
    { slug: 'blonde' },
    { slug: 'ebony' },
    { slug: 'latina' },
    { slug: 'dance' },
    { slug: 'outdoor' },
    { slug: 'big-ass' },
    { slug: 'big-tits' },
    { slug: 'couple' },
    { slug: 'cosplay' },
    { slug: 'live-cam' },
    { slug: 'mature' }
];

const ROOT_DIR = path.join(__dirname, '..');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');

if (!fs.existsSync(SITEMAPS_DIR)) {
    fs.mkdirSync(SITEMAPS_DIR, { recursive: true });
}

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

const now = new Date().toISOString();

CATEGORIES.forEach(cat => {
    xml += '  <url>\n';
    xml += `    <loc>https://www.kumpulenak.my.id/category/${cat.slug}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.9</priority>\n';
    xml += '  </url>\n';
});

xml += '</urlset>';

const outputPath = path.join(SITEMAPS_DIR, 'sitemap_kategori.xml');
fs.writeFileSync(outputPath, xml, 'utf8');

console.log('✅ Generated ' + outputPath);
