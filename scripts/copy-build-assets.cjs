const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'dist', 'assets');
const outDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(srcDir)) process.exit(0);
fs.mkdirSync(outDir, { recursive: true });

for (const entry of fs.readdirSync(srcDir)) {
  const src = path.join(srcDir, entry);
  const dst = path.join(outDir, entry);
  if (fs.statSync(src).isFile()) fs.copyFileSync(src, dst);
}
