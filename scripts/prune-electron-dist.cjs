const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const mediaDir = path.join(distDir, 'media');
const optimizedDir = path.join(mediaDir, 'optimized');

const removeNames = new Set([
  '12345.bin',
  '12345.bin.gz',
  '12345.bin.xz',
  '12345.gltf',
  '12345.gltf.xz',
]);

const removePatterns = [
  /^12345-verge3d-.*\.(?:bin|bin\.gz|bin\.xz|gltf|gltf\.gz|gltf\.xz)$/i,
  /\.(?:gz|xz)$/i,
];

let removedCount = 0;
let removedBytes = 0;

function removeFile(filePath) {
  const stat = fs.statSync(filePath);
  fs.unlinkSync(filePath);
  removedCount += 1;
  removedBytes += stat.size;
}

function shouldRemoveMediaFile(name) {
  if (removeNames.has(name)) return true;
  return removePatterns.some((pattern) => pattern.test(name));
}

function walkAndPruneCompressedFiles(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndPruneCompressedFiles(fullPath);
    } else if (/\.(?:gz|xz)$/i.test(entry.name)) {
      removeFile(fullPath);
    }
  }
}

function removeDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDirectory(fullPath);
    } else {
      removeFile(fullPath);
    }
  }

  fs.rmdirSync(dir);
}

if (!fs.existsSync(mediaDir)) {
  console.log('[prune-electron-dist] dist/media not found, skipped');
  process.exit(0);
}

for (const entry of fs.readdirSync(mediaDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (shouldRemoveMediaFile(entry.name)) {
    removeFile(path.join(mediaDir, entry.name));
  }
}

removeDirectory(optimizedDir);
walkAndPruneCompressedFiles(distDir);

console.log(
  `[prune-electron-dist] removed ${removedCount} files, ${(
    removedBytes /
    1024 /
    1024
  ).toFixed(2)} MB`,
);
