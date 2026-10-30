# CHECKLIST PANDUAN MANUAL PEMILIK WEBSITE (`CHECKLIST_MANUAL.md`)

Dokumen ini berisi panduan langkah demi langkah untuk tindakan eksternal yang harus dilakukan oleh pemilik website melalui dashboard resmi (Google Search Console, Cloudflare, Bing Webmaster Tools, dan Analitik) setelah kode dideploy ke production.

---

## 📋 Langkah 1: Deploy Kode ke Vercel
Kode perbaikan saat ini berada di branch `seo-overhaul`.
1. Jalankan merger ke branch `main`:
   ```bash
   git checkout main
   git merge seo-overhaul
   git push origin main
   ```
2. Pastikan Vercel menyelesaikan build otomatis dengan sukses (Status: **Ready**).

---

## 🌐 Langkah 2: Pengaturan Caching di Cloudflare
Untuk memaksimalkan performa dan memastikan Cloudflare mematuhi header cache yang sudah kita buat:
1. Buka dashboard Cloudflare: `Dash > kumpulenak.my.id > Caching > Configuration`.
2. Pada bagian **Browser Cache TTL**, pilih:
   👉 **"Respect Existing Headers"**
   *(Alasan: Vercel sudah mengirimkan header `Cache-Control` spesifik: aset CSS/JS 1 tahun immutable, halaman kategori 7 hari, dan video 24 jam).*

---

## 🔍 Langkah 3: Submit ke Google Search Console (GSC)
1. **Buka Google Search Console**: [https://search.google.com/search-console](https://search.google.com/search-console).
2. Pilih properti domain: `https://www.kumpulenak.my.id/`.
3. Masuk ke menu **Sitemaps** di sidebar kiri.
4. Pada kolom "Add a new sitemap", masukkan:
   `sitemap_index.xml`
   lalu klik **Submit**.
   *(Bisa juga memasukkan `sitemap.xml` sebagai alias).*
5. Status sitemap akan berubah menjadi **Success** setelah Google selesai mengambil file index.

---

## 🔎 Langkah 4: URL Inspection & Request Indexing Awal
Googlebot memprioritaskan antrean URL yang di-inspect secara manual:
1. Masuk ke fitur **URL Inspection** di bagian atas GSC.
2. Uji dan minta indexing untuk halaman-halaman utama berikut:
   - `https://www.kumpulenak.my.id/` (Homepage)
   - `https://www.kumpulenak.my.id/category/amateur` (Contoh Hub Kategori)
   - `https://www.kumpulenak.my.id/category/babe`
   - `https://www.kumpulenak.my.id/category/milf`
   - Ambil 2–3 URL video aktif dari sitemap (contoh: `https://www.kumpulenak.my.id/v/8XAT108xJ1o-putinha-engolindo-tudo`).
3. Klik tombol **"Test Live URL"** → lalu klik **"Request Indexing"**.

---

## 📊 Langkah 5: Monitoring Laporan "Pages" (Pengindeksan)
Buka menu **Pages** di Search Console setiap 3–5 hari:
1. Perhatikan status:
   - **Indexed** (Hijau): Halaman yang sudah masuk ke pencarian Google.
   - **Not Indexed** (Abu-abu): Periksa penyebabnya:
     - *Crawled - currently not indexed*: Normal untuk situs baru/pemulihan, akan bertahap terindeks seiring meningkatnya otoritas domain.
     - *Discovered - currently not indexed*: Googlebot sudah mencatat URL di sitemap dan mengantre untuk merayap.
     - *Soft 404*: Seharusnya **turun ke 0** karena `api/video.js` kini mengembalikan HTTP 404 resmi.
     - *Alternate page with proper canonical tag*: Normal untuk URL alias/duplikat yang sudah diarahkan ke URL kanonik.

---

## 🤖 Langkah 6: Pendaftaran di Bing Webmaster Tools & IndexNow
Mesin pencari Bing dan DuckDuckGo lebih cepat mengindeks situs baru dibandingkan Google:
1. Buka [https://www.bing.com/webmasters](https://www.bing.com/webmasters).
2. Login dan pilih **"Import from Google Search Console"** (langsung terverifikasi dalam 1 klik tanpa edit DNS).
3. Kirimkan sitemap: `https://www.kumpulenak.my.id/sitemap_index.xml`.

---

## 📈 Langkah 7: Pemasangan Analitik (Traffic Measurement)
Untuk memantau sumber kunjungan (Search, Referral, Direct):
- Gunakan Google Analytics 4 (GA4) atau analitik privasi seperti Cloudflare Web Analytics / Plausible.
- Catat baseline traffic minggu pertama setelah deploy untuk membandingkan pertumbuhan traffic organik.

---

## 🤖 Langkah 8: Menjalankan Background AI Content Enrichment
Jika Anda memiliki Google Gemini API Key:
1. Masukkan API key di environment (misal di Vercel Dashboard `Project Settings > Environment Variables` atau di terminal lokal):
   ```bash
   $env:GEMINI_API_KEY="AIzaSy..."
   ```
2. Jalankan pengayaan metadata video secara berkala:
   ```bash
   npm run seo:enrich
   ```
3. Skrip akan memperkaya batch video terpopuler dengan judul unik, ringkasan, poin sorotan, dan FAQ interaktif. Video yang diperkaya otomatis mendapatkan schema `FAQPage`.

---

## 🚀 3 Strategi Akuisisi Traffic Cepat di Luar Google (Realistis untuk Niche Hiburan)

Karena proses pengindeksan Google membutuhkan waktu 2 hingga 6 minggu untuk merayapi puluhan ribu URL dan mengevaluasi kualitas domain, berikut adalah 3 strategi traffic instan yang terbukti efektif untuk niche video/galeri:

1. **Komunitas Telegram & Saluran Preview**:
   - Buat channel atau grup Telegram resmi `kumpulenak`.
   - Posting klip pendek teaser (durasi 10–20 detik) dari video paling viral setiap hari, lalu sertakan link langsung ke halaman video situs (`https://www.kumpulenak.my.id/v/ID-slug`).
   - Telegram memiliki jutaan audiens aktif untuk konten hiburan tanpa sensor algoritma feed.

2. **Akun X (Twitter) & Threads untuk Cuplikan Viral**:
   - Posting potongan GIF atau video preview pendek yang sedang tren dengan hashtag relevan (`#viral`, `#trending`).
   - Sematkan link tonton video full HD di bio profil atau kolom komentar balasan.

3. **Subreddit & Forum Khusus**:
   - Bagikan konten orisinal atau kurasi kategori terbaik di forum komunitas (seperti Reddit r/NSFW_GIF, sub-genre forum).
   - Pastikan mengikuti aturan masing-masing komunitas (*no direct hard spam*, utamakan membagikan konten berkualitas).
