const fs = require('fs');
const path = require('path');

// Ambil versi baru dari argumen terminal (contoh: node bump-version.js 3.4.0)
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Harap masukkan versi baru. Contoh: node bump-version.js 3.4.0');
  process.exit(1);
}

console.log(`🚀 Memperbarui seluruh versi cache menjadi: v${newVersion}...`);

// Dapatkan semua file HTML di direktori root secara dinamis
const filesInRoot = fs.readdirSync(__dirname);
const htmlFiles = filesInRoot.filter(file => file.endsWith('.html'));

// Dapatkan semua file HTML di direktori category secara dinamis
const categoryDir = path.join(__dirname, 'category');
let categoryHtmlFiles = [];
if (fs.existsSync(categoryDir)) {
  categoryHtmlFiles = fs.readdirSync(categoryDir)
    .filter(file => file.endsWith('.html'))
    .map(file => path.join('category', file));
}

// Daftar file yang akan dipindai dan diperbarui versi cache-nya (?v=)
const filesToUpdate = [
  ...htmlFiles,
  ...categoryHtmlFiles,
  'assets/js/gallery.js',
  'assets/js/loader.js'
];

// Tambahkan sw.js jika ada di root
if (fs.existsSync(path.join(__dirname, 'sw.js'))) {
  filesToUpdate.push('sw.js');
}

let totalReplaced = 0;

filesToUpdate.forEach(relativePath => {
  const fullPath = path.join(__dirname, relativePath);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Ganti semua parameter ?v= versi lama (baik berupa angka maupun hash MD5) dengan versi baru
    let newContent = content.replace(/\?v=[^"'\s>]+/g, `?v=${newVersion}`);
    
    // Khusus untuk sw.js jika ada, ganti CACHE_NAME
    if (relativePath === 'sw.js') {
      newContent = newContent.replace(/CACHE_NAME\s*=\s*'[^']+'/g, `CACHE_NAME = 'kumpulenak-cache-v${newVersion}'`);
    }

    if (content !== newContent) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
      console.log(`   Diperbarui: ${relativePath}`);
      totalReplaced++;
    } else {
      console.log(`➖ Tidak ada perubahan di: ${relativePath}`);
    }
  } else {
    console.warn(`⚠️ File tidak ditemukan: ${relativePath}`);
  }
});

console.log(`🎉 Selesai! Berhasil memperbarui ${totalReplaced} file.`);
console.log(`Sekarang Anda bisa menjalankan: git add . && git commit -m "bump version to ${newVersion}" && git push`);
