const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const baseUrl = 'https://www.kumpulenak.my.id';
const perPage = 100;
const chunkSize = 49000;
const delayMs = 0;

// Format Date correctly: YYYY-MM-DDTHH:mm:ss+07:00
function getLocalDateString() {
    const d = new Date();
    d.setHours(d.getHours() + 7); // Fake WIB (UTC+7)
    return d.toISOString().replace(/\.\d{3}Z$/, '+07:00');
}
const dateStr = getLocalDateString();
const shortDateStr = dateStr.substring(0, 10);

console.log("\n============================================");
console.log("  kumpulenak Sitemap Generator v5.0 (Node)");
console.log("  FULL CRAWL - Stream Writer Mode");
console.log(`  Website: ${baseUrl}`);
console.log(`  Waktu: ${dateStr}`);
console.log("============================================\n");

const searchQueries = [
    'amateur', 'milf', 'pov', 'blonde', 'ebony', 'latina', 'hentai',
    'big ass', 'big tits', 'small tits', 'couple', 'blowjob', 'creampie', 'uncensored',
    'asian', 'japanese', 'korean', 'celebrity', 'homemade', 'massage', 'outdoor', 'webcam',
    'brunette', 'anal', 'threesome', 'lesbian', 'interracial', 'redhead', 'indian',
    'office', 'public', 'beach', 'hotel', 'shower', 'car', 'gym', 'babe', 'gangbang', 'panties',
    'socks', 'bbw', 'cosplay', 'yoga', 'dance', 'submissive'
];

const stateFile = path.join(__dirname, 'sitemap_state.json');
let state = {
    completedQueries: [],
    sitemapVideoFiles: [],
    grandTotalVideos: 0,
    grandTotalRequests: 0,
    grandTotalDupes: 0
};

if (fs.existsSync(stateFile)) {
    console.log("[INFO] Ditemukan file state sebelumnya. Melanjutkan proses yang tertunda...");
    try {
        const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        state = { ...state, ...saved };
    } catch (e) {
        console.error("Gagal membaca sitemap_state.json. Memulai dari awal.");
    }
}

function saveState() {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

function updateMasterIndex() {
    console.log("      -> Memperbarui sitemap_index.xml (Master Index)...");
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    const staticMaps = ['sitemap_pages.xml', 'sitemap_kategori.xml', 'sitemap_tags.xml'];
    for (const m of staticMaps) {
        xml += `  <sitemap>\n    <loc>${baseUrl}/sitemaps/${m}</loc>\n    <lastmod>${dateStr}</lastmod>\n  </sitemap>\n`;
    }
    for (const m of state.sitemapVideoFiles) {
        xml += `  <sitemap>\n    <loc>${baseUrl}/sitemaps/${m}</loc>\n    <lastmod>${dateStr}</lastmod>\n  </sitemap>\n`;
    }
    xml += `</sitemapindex>`;
    fs.writeFileSync(path.join(__dirname, 'sitemap_index.xml'), xml, 'utf8');
}

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function generateStaticSitemaps() {
    console.log("[SITEMAP] Membuat sitemap statis (pages, kategori, tags)...");
    
    // sitemap_pages.xml
    const pagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.kumpulenak.my.id/</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.00</priority>
    <xhtml:link rel="alternate" hreflang="id" href="https://www.kumpulenak.my.id/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://www.kumpulenak.my.id/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.kumpulenak.my.id/"/>
  </url>
  <url><loc>https://www.kumpulenak.my.id/about</loc><lastmod>${dateStr}</lastmod><changefreq>yearly</changefreq><priority>0.50</priority></url>
  <url><loc>https://www.kumpulenak.my.id/contact</loc><lastmod>${dateStr}</lastmod><changefreq>yearly</changefreq><priority>0.40</priority></url>
  <url><loc>https://www.kumpulenak.my.id/privacy</loc><lastmod>${dateStr}</lastmod><changefreq>yearly</changefreq><priority>0.40</priority></url>
  <url><loc>https://www.kumpulenak.my.id/terms</loc><lastmod>${dateStr}</lastmod><changefreq>yearly</changefreq><priority>0.40</priority></url>
  <url><loc>https://www.kumpulenak.my.id/dmca</loc><lastmod>${dateStr}</lastmod><changefreq>yearly</changefreq><priority>0.40</priority></url>
  <url><loc>https://www.kumpulenak.my.id/howto</loc><lastmod>${dateStr}</lastmod><changefreq>monthly</changefreq><priority>0.60</priority></url>
</urlset>`;
    fs.writeFileSync(path.join(__dirname, 'sitemaps', 'sitemap_pages.xml'), pagesXml, 'utf8');

    // sitemap_kategori.xml
    console.log("      -> Menjalankan node scripts/generate-category-sitemap.js...");
    try {
        execSync('node scripts/generate-category-sitemap.js', { stdio: 'inherit' });
    } catch (e) {
        console.log("Error saat menjalankan generate-category-sitemap.js", e.message);
    }

    // sitemap_tags.xml
    const tags = ['amateur', 'babe', 'milf', 'dance', 'pov', 'blonde', 'ebony', 'latina', 'hentai', 'big ass', 'big tits', 'couple', 'cosplay', 'blowjob', 'creampie', 'uncensored'];
    let tagsXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const t of tags) {
        const url = `${baseUrl}/?q=${encodeURIComponent(t)}`;
        tagsXml += `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.75</priority>\n  </url>\n`;
    }
    tagsXml += `</urlset>`;
    fs.writeFileSync(path.join(__dirname, 'sitemaps', 'sitemap_tags.xml'), tagsXml, 'utf8');
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    if (!fs.existsSync(path.join(__dirname, 'sitemaps'))) {
        fs.mkdirSync(path.join(__dirname, 'sitemaps'));
    }

    generateStaticSitemaps();
    updateMasterIndex();

    console.log("\n[API] Memulai FULL CRAWL...");
    console.log(`      ${searchQueries.length} kategori | Delay: ${delayMs} ms/request\n`);

    const globalTitleSet = new Set();

    for (const query of searchQueries) {
        if (state.completedQueries.includes(query)) {
            console.log(`  [${query}] Sudah selesai di sesi sebelumnya. Lewati...\n`);
            continue;
        }

        const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '_');
        const fileNameBase = `sitemap_video_${safeQuery}`;

        console.log(`  [${query}] Fetching...`);
        let page = 1;
        let totalPages = 1;
        let dupeCount = 0;
        let categoryVideoCount = 0;

        let currentChunkIndex = 0;
        let currentChunkVideoCount = 0;
        let xmlStream = null;

        function startNewStream() {
            if (xmlStream) {
                xmlStream.write("</urlset>\n");
                xmlStream.end();
            }
            let currentFileName = `${fileNameBase}.xml`;
            if (currentChunkIndex > 0) {
                currentFileName = `${fileNameBase}_${currentChunkIndex + 1}.xml`;
            }
            const fullPath = path.join(__dirname, 'sitemaps', currentFileName);
            xmlStream = fs.createWriteStream(fullPath, { encoding: 'utf8' });
            xmlStream.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`);
            
            state.sitemapVideoFiles.push(currentFileName);
            console.log(`      -> ${currentFileName} dibuat.`);
        }

        const seenIds = new Set();

        while (page <= totalPages) {
            const apiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&thumbsize=small&order=most-popular&format=json`;

            try {
                const response = await fetchJSON(apiUrl);
                state.grandTotalRequests++;

                if (page === 1 && response.total_pages) {
                    totalPages = parseInt(response.total_pages) || 1;
                    console.log(`         Tersedia: ${response.total_count} video (${totalPages} halaman)`);
                }

                if (response.videos && response.videos.length > 0) {
                    for (const v of response.videos) {
                        if (seenIds.has(v.id)) continue;
                        
                        const titleLower = (v.title || '').toLowerCase().trim();
                        if (globalTitleSet.has(titleLower)) {
                            dupeCount++;
                            continue;
                        }

                        let slug = (v.title || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
                        if (slug.length > 80) slug = slug.substring(0, 80).replace(/-+$/, '');

                        let addedDate = shortDateStr;
                        if (v.added && v.added.length >= 10) addedDate = v.added.substring(0, 10);
                        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(addedDate)) addedDate = shortDateStr;

                        const duration = parseInt(v.length_sec) || 0;
                        const thumbnail = v.default_thumb ? v.default_thumb.src : '';
                        const embed = v.embed || '';

                        seenIds.add(v.id);
                        globalTitleSet.add(titleLower);

                        if (!xmlStream) {
                            startNewStream();
                        } else if (currentChunkVideoCount >= chunkSize) {
                            currentChunkIndex++;
                            currentChunkVideoCount = 0;
                            startNewStream();
                        }

                        const videoUrl = `${baseUrl}/v/${v.id}-${slug}`;
                        let node = `  <url>\n    <loc>${escapeXml(videoUrl)}</loc>\n    <lastmod>${addedDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.70</priority>\n`;

                        if (v.title && thumbnail && embed) {
                            const escTitle = escapeXml(v.title);
                            const desc = escapeXml(`Nonton video bokep ${v.title} gratis di kumpulenak. Streaming cepat tanpa buffer.`);
                            node += `    <video:video>\n`;
                            node += `      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>\n`;
                            node += `      <video:title>${escTitle}</video:title>\n`;
                            node += `      <video:description>${desc}</video:description>\n`;
                            node += `      <video:player_loc>${escapeXml(embed)}</video:player_loc>\n`;
                            if (duration > 0) node += `      <video:duration>${duration}</video:duration>\n`;
                            node += `      <video:publication_date>${addedDate}</video:publication_date>\n`;
                            node += `    </video:video>\n`;
                        }
                        node += `  </url>\n`;

                        xmlStream.write(node);
                        currentChunkVideoCount++;
                        categoryVideoCount++;
                    }

                    if (page % 10 === 0) {
                        console.log(`         Halaman ${page}/${totalPages}... (${categoryVideoCount} unik)`);
                    }
                } else {
                    break;
                }
            } catch (err) {
                console.log(`         [!] Error halaman ${page}, skip...`, err.message);
                await sleep(2000);
            }

            page++;
            if (delayMs > 0) await sleep(delayMs);
        }

        if (xmlStream) {
            xmlStream.write("</urlset>\n");
            xmlStream.end();
        }

        state.grandTotalDupes += dupeCount;
        state.grandTotalVideos += categoryVideoCount;

        console.log(`      Total video baru  : ${categoryVideoCount}`);
        console.log(`      Total duplikat diskip: ${dupeCount}`);

        state.completedQueries.push(query);
        saveState();
        updateMasterIndex();

        console.log("");
    }

    console.log("============================================");
    console.log("  SEMUA SELESAI!");
    console.log("============================================");
    console.log(`  Video sitemaps       : ${state.sitemapVideoFiles.length} file`);
    console.log(`  Total video unik     : ${state.grandTotalVideos}`);
    console.log(`  API requests         : ${state.grandTotalRequests}`);
    console.log("  sitemap_index.xml    : master (Siap didaftarkan ke Google!)");
    console.log("============================================\n");

    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }
}

run();
