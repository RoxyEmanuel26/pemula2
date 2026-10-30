'use strict';

const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'scripts', 'build.js');

if (fs.existsSync(scriptPath)) {
    require(scriptPath);
} else {
    console.log('✨ Vercel static deployment ready. CI build scripts omitted by .vercelignore.');
}
