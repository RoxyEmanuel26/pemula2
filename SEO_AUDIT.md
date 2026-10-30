# Audit SEO Teknis Menyeluruh: kumpulenak.my.id
**Tanggal Audit:** 31 Oktober 2026  
**Auditor:** Senior Technical SEO Engineer & Full-Stack Developer  
**Status Kode/Branch:** `seo-overhaul` (berbasis `origin/main` commit terbaru)  
**Tujuan:** Mengidentifikasi akar masalah mengapa website selama 10+ bulan online memiliki hampir 0 pengunjung dari Google, serta menyusun peta jalan perbaikan menyeluruh tanpa merusak skrip iklan pihak ketiga atau fitur yang sudah berjalan.

---

## 1. Arsitektur, Framework & Mode Rendering Tiap Jenis Halaman

### Ringkasan Arsitektur
- **Teknologi Utama:** Vanilla JavaScript (ES6+), HTML5 Semantik, CSS3 murni (Modern Dark UI). Tanpa framework (No React/Vue/Next.js/Nuxt).
- **Hosting & Infrastruktur:** Vercel (Edge/Origin Serverless Static Web Hosting) + Cloudflare (CDN, DNS & WAF proxy).
- **Metode Routing:** Vercel Rewrites (`vercel.json`) dengan `cleanUrls: true`.

### Mode Rendering & Analisis HTML Awal (Critical Crawl Test)

| Jenis Halaman | Route / URL Pattern | Mode Rendering | Title di HTML Awal? | Meta Desc di HTML Awal? | Konten Utama / Video di HTML Awal? | Kesimpulan Indexability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Beranda (Home)** | `/` | **CSR Murni** (Client-Side Rendering) | ✅ Ada (Statis) | ✅ Ada (Statis) | ❌ **KOSONG** (Container `#cardGrid` kosong; baru diisi `gallery.js` via browser fetch API) | **Buruk**. Bot melihat halaman kosong tanpa konten video. |
| **Halaman Video** | `/v/:id-:slug` (via `video.html`) | **CSR Murni** | ❌ **GENERIC / DEFAULT** (`kumpulenak — Watch Trending Viral Video`) | ❌ **GENERIC / DEFAULT** (`Watch trending viral adult videos...`) | ❌ **KOSONG** (Hanya loader `<div class="loader"></div>`; judul, video player, meta diisi browser JS) | **KRITIS**. 45.000+ URL video di sitemap memiliki Title, Description, dan Body yang 100% IDENTIK di raw HTML. Google menganggapnya Duplicate Content / Soft 404. |
| **Kategori (85 Halaman)** | `/category/:slug` | **SSG Parsial** (Static Site Generation via `scripts/generate-categories.js`) | ✅ Ada & Unik | ✅ Ada & Unik | ⚠️ **PARSIAL** (Ada 24 card awal di HTML awal, tetapi teks pengantar editorial sangat minim/tipis, pagination berbasis JS click) | **Sedang-Baik**. Halaman paling berpotensi di-crawl saat ini, namun masih kekurangan konten kontekstual unik. |
| **Halaman Legal & Panduan** | `/about`, `/contact`, `/dmca`, `/howto`, `/privacy`, `/terms` | **SSG Murni** (HTML Statis) | ✅ Ada & Unik | ✅ Ada & Unik | ✅ **LENGKAP** (Artikel & teks hukum ada di raw HTML) | **Sempurna**. Namun ini bukan halaman target pencarian video utama. |
| **Halaman 404** | `/404` (dan rute tidak terdaftar) | **SSG Murni** | ✅ Ada | ✅ Ada | ✅ Lengkap | ⚠️ **MASALAH PADA RUTE VIDEO**: Rute `/v/id-palsu` tetap mengembalikan status **HTTP 200** karena rewrite Vercel mengarah ke `video.html`. |

---

## 2. Daftar Route dan Pola URL

1. **Beranda:**
   - Pola: `https://www.kumpulenak.my.id/`
   - File fisik: `index.html`
2. **Halaman Video:**
   - Pola Kanonik: `https://www.kumpulenak.my.id/v/{id}-{slug}` (contoh: `/v/IZkMawC9vj9-she-s-too-small-for-this`)
   - Pola ID Saja (Legacy/Alias): `/v/{id}` atau `/video.html?id={id}`
   - Aturan Vercel: `"source": "/v/:path*", "destination": "/video"`
3. **Halaman Kategori (85 file):**
   - Pola: `https://www.kumpulenak.my.id/category/{slug}` (contoh: `/category/amateur`, `/category/japanese`)
   - File fisik: `category/{slug}.html` (dilayani tanpa ekstensi karena `cleanUrls: true`)
4. **Pencarian Internal & Filter Query:**
   - Pola: `https://www.kumpulenak.my.id/?q={query}`
   - Menjalankan pencarian dinamis di beranda melalui `gallery.js`.
5. **Halaman Informasi & Legalitas (6 halaman):**
   - `/about`, `/contact`, `/dmca`, `/howto`, `/privacy`, `/terms`

---

## 3. Mekanisme Pengambilan Data API Pihak Ketiga

1. **Endpoint API:**
   - Provider: Eporner API v2 (`https://www.eporner.com/api/v2/video/search/` dan `.../api/v2/video/id/`).
2. **Lokasi Eksekusi:**
   - **Di Browser Klien (Runtime):** Setiap pengunjung atau crawler yang membuka halaman video atau beranda melakukan request HTTP `fetch()` langsung dari browser ke server Eporner.
   - **Di Node.js (Build / Background):** Script `generate_sitemap_fast.js` dan `scripts/generate-categories.js` menarik data langsung dari API melalui Node.js CLI saat build/cron.
3. **Mekanisme Caching:**
   - Di sisi browser: Hanya in-memory variable JavaScript sementara (`window._apiCache`). Saat tab ditutup atau halaman di-refresh, cache hilang.
   - Di sisi server/origin: **TIDAK ADA CACHE SERVER**. Tidak ada database lokal, Redis, atau edge-cache untuk payload video individual.
4. **Rate Limit & Resiko:**
   - Eporner menerapkan rate limit berbasis IP. Jika Googlebot atau ratusan pengguna melakukan fetch serentak dari browser, request berisiko terkena throttling (HTTP 429) atau timeout (5-10 detik batas WRS Googlebot), yang menyebabkan rendering JavaScript Google gagal total.

---

## 4. Status Audit Elemen SEO On-Page & Teknis

| Elemen Teknis | Status | Kondisi Aktual & Temuan Lapangan |
| :--- | :--- | :--- |
| **robots.txt** | ⚠️ **SALAH / BERMASALAH** | File ada, namun **tidak memblokir parameter pencarian internal** (`/?q=*`). Akibatnya Googlebot merayapi ribuan URL pencarian tipis tanpa henti. |
| **sitemap_index.xml** | ✅ **ADA & VALID** | Memiliki sitemap index dengan 11 pecahan video sitemap (~45.000 URL), 1 sitemap kategori, dan 1 sitemap pages. Format Google Video XML sudah sesuai standar. |
| **Tag `<title>`** | ❌ **SALAH / KRITIS DI VIDEO** | Di `video.html`, title awal berupa teks statis generic. Di kategori sudah unik. Di beranda sudah ada. |
| **Meta Description** | ❌ **SALAH / KRITIS DI VIDEO** | Di `video.html`, meta description awal berupa teks statis generic. Di kategori sudah ada. |
| **Canonical Tag** | ❌ **SALAH / MENGANDUNG BUG** | 1. Pada `index.html`, script baris 71-77 menyuntikkan canonical ke `/?q=query` jika ada parameter pencarian. Ini menyebabkan URL pencarian mengklaim dirinya kanonik!<br>2. Pada `404.html`, canonical justru diarahkan ke homepage (`/`), yang membingungkan Googlebot. |
| **Open Graph & Twitter Card** | ⚠️ **PARSIAL** | Di beranda & kategori sudah lengkap. Di `video.html`, nilai `og:title`, `og:image`, `og:url` kosong di HTML awal dan baru diisi via JS. |
| **Heading Structure (H1-H6)** | ⚠️ **SALAH** | 1. Di `video.html`, **H1 sama sekali tidak ada di raw HTML**.<br>2. Di `category/*.html`, struktur melompat langsung dari H1 ke H3 (melewati H2). |
| **Alt Gambar** | ⚠️ **PARSIAL** | Di kategori alt sudah cukup baik (`... thumbnail`). Di video terkait (`similar videos`) alt hanya berupa string kaku `"Thumbnail"`. |
| **JSON-LD Structured Data** | ⚠️ **SALAH / TIDAK LENGKAP** | 1. `WebSite` dan `Organization` sudah ada di beranda.<br>2. `VideoObject` di `video.html` **kosong di HTML awal** (`<script id="jsonLdScript"></script>`).<br>3. `ItemList` **belum ada** di halaman kategori.<br>4. Tag `<link rel="alternate" hreflang>` di halaman kategori salah alamat (mengarah ke homepage, bukan ke URL kategori terkait). |
| **Status Kode 404** | ❌ **SALAH (SOFT 404 PADA VIDEO)** | Permintaan URL `/v/id-video-palsu` dilayani oleh Vercel rewrite ke `video.html` dengan kode **HTTP 200 OK**. JavaScript kemudian menampilkan pesan error, menciptakan gelombang **Soft 404** di Google Search Console. |
| **Protokol HTTPS & www** | ⚠️ **BELUM DIKUNCI DI VERCEL** | Domain kanonik menggunakan `www.kumpulenak.my.id`, namun belum ada aturan redirect 301 paksa dari `kumpulenak.my.id` (non-www) ke `www.kumpulenak.my.id` di dalam `vercel.json`. |
| **Halaman Legalitas** | ✅ **ADA & LENGKAP** | About, Contact, DMCA, Privacy Policy, Terms of Service sudah tersedia dan ditautkan di footer. |

---

## 5. Audit Crawlability Navigasi & Pagination

1. **Tab Menu Utama:**
   - Tombol `Popular`, `Viral`, `Categories` menggunakan elemen `<button class="nav-tab">` dengan event `click`. **Tidak memiliki atribut `<a href>`**.
   - **Dampak:** Googlebot tidak bisa mengikuti navigasi tab ke halaman kategori atau viral dari header.
2. **Pagination:**
   - Dibuat melalui fungsi `createBtn()` di `gallery.js`:
     ```javascript
     var btn = document.createElement('button');
     btn.className = className;
     btn.addEventListener('click', function() { goToPage(pageNum); });
     ```
   - **Dampak Kritis:** Pagination 100% menggunakan elemen `<button>` dengan event listener JavaScript. Googlebot **TIDAK MENGKLIK BUTTON** untuk menelusuri halaman 2, 3, 4, dst. Semua video di halaman pagination berikutnya tidak dapat dijangkau oleh bot melalui tautan internal!
3. **Tautan di `<noscript>` Beranda:**
   - Tautan kategori di dalam `<noscript>` beranda menggunakan pola query: `<a href="/?q=amateur">` bukan `<a href="/category/amateur">`. Bot yang membaca noscript dialihkan ke parameter pencarian, bukan ke landing page kategori statis.

---

## 6. Potensi Duplikasi Konten & URL Bloat

1. **Parameter Query Pencarian Internal (`/?q=...`):**
   - Setiap tag video di `video.html` mengarah ke `/?q={tag}`.
   - Karena `robots.txt` tidak memblokir `/?q=`, dan script canonical di `index.html` melegalkan `/?q=...` sebagai self-canonical, Google Search Console kebanjiran ribuan URL pencarian duplikat dengan konten tipis (*Index Bloat*).
2. **Ketiadaan Canonical Kategori Tanpa Slash vs Slash:**
   - Perlu dipastikan Vercel `cleanUrls: true` mengarahkan `/category/amateur/` ke `/category/amateur` secara 301 otomatis.
3. **Duplicate Content Eksternal dari API:**
   - Ribuan situs dewasa lain juga mengonsumsi API Eporner dengan judul, deskripsi, thumbnail, dan durasi yang sama persis.
   - Tanpa adanya pengayaan konten unik (editorial intro, FAQ, ringkasan, highlights), Google menganggap halaman video sebagai konten bersindikat bernilai rendah (*Low-Value Scraped/Syndicated Content*).

---

## 7. Masalah Kinerja & Core Web Vitals (CWV)

1. **Embed Video Tanpa Facade (Beban Terbesar LCP & TBT):**
   - Begitu API merespons di `video.html`, elemen `<iframe>` langsung dimuat dari server pihak ketiga (`iframe.src = video.embed`).
   - Iframe ini mengunduh player pihak ketiga, skrip pelacak, dan buffer video awal secara otomatis, menghancurkan skor LCP (Largest Contentful Paint) dan Total Blocking Time (TBT).
2. **Layout Shift (CLS):**
   - Tag `<img>` pada card video tidak memiliki atribut `width` dan `height` eksplisit atau aspect-ratio yang terkunci, memicu pergeseran tata letak saat gambar thumbnail selesai dimuat.
3. **Konfigurasi Cache Header di `vercel.json` Kurang Tepat:**
   - Rule cache kategori menggunakan pattern `"/category/(.*).html"`. Namun dengan `cleanUrls: true`, browser meminta `/category/amateur` (tanpa `.html`), sehingga header cache tidak aktif pada URL bersih.
   - Header `Referrer-Policy: no-referrer-when-downgrade` terlewat pada rule route video `/v/:path*`.

---

## 8. Rekapitulasi Daftar Temuan & Prioritas Perbaikan

Daftar temuan diurutkan dari dampak paling mematikan bagi SEO hingga perbaikan minor:

| No | Tingkat Dampak | Masalah Utama | Penjelasan Dampak | Estimasi Usaha |
| :---: | :---: | :--- | :--- | :---: |
| **1** | **KRITIS** | **Halaman Video 100% Client-Side Rendering (CSR)** | 45.000+ URL di sitemap memiliki Title, Description, H1, dan konten yang identik/kosong di raw HTML awal. Google mendeteksi ribuan halaman duplikat kosong. | **Tinggi** (Perlu SSG / Server Pre-render atau Snapshot) |
| **2** | **KRITIS** | **Pagination Menggunakan `<button>` JS** | Bot tidak dapat merayapi halaman 2, 3, 4, dst. Seluruh katalog video tersembunyi dari perayapan tautan internal. | **Sedang** (Ubah ke `<a href="?page=X">` atau clean URL) |
| **3** | **KRITIS** | **Index Bloat & Kanonisasi URL Pencarian `/?q=`** | Parameter pencarian terindeks dan menjadi duplikat tipis karena canonical tag salah disuntikkan. | **Rendah-Sedang** (Noindex pencarian, blokir di robots.txt, perbaiki canonical) |
| **4** | **KRITIS** | **Soft-404 pada Rute Video Tidak Ditemukan** | Rute video yang dihapus atau id salah tetap mengembalikan HTTP 200 via Vercel rewrite. | **Sedang** |
| **5** | **TINGGI** | **Konten Tipis & Duplikat API (Tanpa Diferensiasi)** | Data video dan kategori 100% sama dengan situs kompetitor API Eporner. Tanpa teks unik, Google menolak memberi ranking. | **Tinggi** (Pipeline Pengayaan Konten & Hub Kategori Unik) |
| **6** | **TINGGI** | **Video Embed Tanpa Facade** | Iframe dimuat langsung, merusak LCP, konsumsi memori, dan skor Core Web Vitals. | **Sedang** (Implementasi poster click-to-play) |
| **7** | **TINGGI** | **Hreflang & Structured Data Video/ItemList Hilang di Raw HTML** | Tag hreflang mengarah salah ke beranda; schema VideoObject tidak ada di raw HTML. | **Sedang** |
| **8** | **SEDANG** | **Navigasi Tab Menggunakan Button Tanpa Link Crawlable** | Bot tidak menemukan tautan ke 85 halaman kategori dari navigasi utama. | **Rendah** |
| **9** | **SEDANG** | **Layout Shift (CLS) Gambar Thumbnail** | Dimensi gambar tidak eksplisit pada grid card. | **Rendah** |
| **10** | **RENDAH** | **Ketidaksesuaian Pattern Header di `vercel.json`** | Pattern match regex `.html` tidak mengenai URL `cleanUrls`. | **Rendah** |

---

## Rekomendasi Solusi & Rencana Tindak Lanjut Fase 1

Untuk menyelesaikan akar masalah 10 bulan nihil trafik, **Fase 1 (Fondasi Crawling dan Indexing)** harus difokuskan pada:
1. Memperbaiki `robots.txt` (blokir crawling pencarian `/?q=`, izinkan halaman statis & kategori).
2. Memperbaiki canonical di `index.html` dan `video.html` agar tidak pernah mengkanonisasikan parameter query `?q=`.
3. Mengubah tautan pagination dan kategori agar menggunakan `<a href>` asli yang ramah Googlebot.
4. Memperbaiki pencocokan header di `vercel.json` untuk `cleanUrls` dan memastikan pengalihan kanonik www / non-www.
5. Menyiapkan mekanisme penanganan HTML awal untuk halaman video (apakah melalui pre-rendering SSG batch berkala atau dynamic rendering).

---
*Laporan Audit Selesai. Menunggu persetujuan pemilik website sebelum melangkah ke implementasi Fase 1.*
