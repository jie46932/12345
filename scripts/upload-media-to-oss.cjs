const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mediaDir = path.join(root, 'dist', 'media');
const bucket = process.env.OSS_BUCKET;
const prefix = String(process.env.OSS_PREFIX || '12345').replace(/^\/+|\/+$/g, '');
const cli = process.env.OSS_CLI || 'aliyun';

if (!bucket) {
  console.error('[upload-media-to-oss] Missing OSS_BUCKET');
  process.exit(1);
}

if (!fs.existsSync(mediaDir)) {
  console.error('[upload-media-to-oss] dist/media not found. Run npm run build first.');
  process.exit(1);
}

const target = `oss://${bucket}/${prefix ? `${prefix}/` : ''}media/`;
const args = ['oss', 'cp', mediaDir, target, '--recursive', '--update'];

console.log(`[upload-media-to-oss] ${mediaDir} -> ${target}`);
const result = spawnSync(cli, args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status || 0);
