const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const distDir = path.resolve(__dirname, '..', 'dist');
const mediaDir = path.join(distDir, 'media');

if (!fs.existsSync(mediaDir)) {
  console.log('[gzip-dist-assets] dist/media not found, skipped');
  process.exit(0);
}

const extensions = new Set(['.bin']);
const files = fs.readdirSync(mediaDir)
  .filter((file) => extensions.has(path.extname(file).toLowerCase()));

for (const file of files) {
  const sourcePath = path.join(mediaDir, file);
  const gzipPath = `${sourcePath}.gz`;
  const source = fs.readFileSync(sourcePath);
  const zipped = zlib.gzipSync(source, { level: 9 });
  fs.writeFileSync(gzipPath, zipped);
  console.log(`[gzip-dist-assets] ${file}: ${source.length} -> ${zipped.length}`);
}
