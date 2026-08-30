const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sourceMediaDir = path.join(root, 'media');
const publicMediaDir = path.join(root, 'public', 'media');
const externalDir = path.join(dist, 'external');

const skippedRootMediaNames = new Set([
  '12345.bin',
  '12345.bin.gz',
  '12345.bin.xz',
  '12345.gltf',
  '12345.gltf.gz',
  '12345.gltf.xz',
  '12345-ar.previous.usdz',
]);

const skippedRootMediaPatterns = [
  /^12345-verge3d-.*\.(?:bin|bin\.gz|bin\.xz|gltf|gltf\.gz|gltf\.xz)$/i,
];

function shouldSkipSourceMedia(src) {
  const relative = path.relative(sourceMediaDir, src);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  if (relative === 'optimized') return false;
  if (relative.startsWith(`optimized${path.sep}`)) {
    return !relative.startsWith(path.join('optimized', 'draco-transform'));
  }
  if (relative.includes(path.sep)) return false;

  const name = path.basename(src);
  return (
    skippedRootMediaNames.has(name) ||
    skippedRootMediaPatterns.some((pattern) => pattern.test(name))
  );
}

function copyRecursive(src, dst, shouldSkip = () => false) {
  if (!fs.existsSync(src)) return;
  if (shouldSkip(src)) {
    console.log(`[copy-vercel-assets] skipped ${path.relative(root, src)}`);
    return;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry), shouldSkip);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

copyRecursive(sourceMediaDir, path.join(dist, 'media'), shouldSkipSourceMedia);
copyRecursive(publicMediaDir, path.join(dist, 'media'));
copyRecursive(path.join(root, 'node_modules', '@8thwall', 'engine-binary', 'dist'), path.join(externalDir, 'xr'));
copyRecursive(path.join(root, 'node_modules', '@8thwall', 'xrextras', 'dist'), path.join(externalDir, 'xrextras'));
copyRecursive(path.join(root, 'node_modules', '@8thwall', 'landing-page', 'dist'), path.join(externalDir, 'landing-page'));
copyRecursive(path.join(dist, 'index.html'), path.join(dist, 'index.dev.html'));
