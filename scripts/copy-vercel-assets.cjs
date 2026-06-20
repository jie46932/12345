const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

copyRecursive(path.join(root, 'media'), path.join(dist, 'media'));
copyRecursive(path.join(root, 'public', 'media'), path.join(dist, 'media'));
copyRecursive(path.join(dist, 'index.html'), path.join(dist, 'index.dev.html'));
