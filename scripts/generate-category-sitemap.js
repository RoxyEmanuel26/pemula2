const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const GALLERY_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'gallery.js');

if (!fs.existsSync(SITEMAPS_DIR)) {
    fs.mkdirSync(SITEMAPS_DIR, { recursive: true });
}

if (!fs.existsSync(GALLERY_JS_PATH)) {
    console.error("❌ Cannot find gallery.js at " + GALLERY_JS_PATH);
    process.exit(1);
}

// Load categories dynamically from gallery.js
const galleryJs = fs.readFileSync(GALLERY_JS_PATH, 'utf-8');
const match = galleryJs.match(/const KATEGORI_LIST = \[([\s\S]*?)\];/);
if (!match) {
    console.error("❌ Failed to parse KATEGORI_LIST from gallery.js");
    process.exit(1);
}

const rawList = eval(`[${match[1]}]`);

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

const now = new Date().toISOString();

rawList.forEach(cat => {
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

console.log('✅ Generated ' + outputPath + ' with ' + rawList.length + ' categories.');
