const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const forbiddenDistExtensions = new Set([
  '.env',
  '.map',
  '.max',
  '.zip',
  '.7z',
  '.rar',
  '.log',
  '.pem',
  '.key',
  '.crt',
  '.psd',
  '.tga',
  '.blend',
  '.fbx',
  '.obj',
  '.ma',
  '.mb',
]);

const forbiddenDistPathParts = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}_archive${path.sep}`,
  `${path.sep}_recycle${path.sep}`,
  `${path.sep}backups${path.sep}`,
  `${path.sep}src${path.sep}`,
];

const forbiddenDistPatterns = [
  { label: 'wechat app secret assignment', re: /WECHAT_APP_SECRET\s*[:=]\s*['"]?[0-9a-f]{32}/i },
  { label: 'supabase service role key assignment', re: /SUPABASE_SERVICE_ROLE_KEY\s*=/i },
  { label: 'example cdn domain', re: /cdn\.example\.com/i },
  { label: 'local viewer dev origin', re: /(?:127\.0\.0\.1|localhost):5173/i },
  { label: 'hardcoded fallback access token', re: /he_furniture_v3d_access/i },
  { label: 'hardcoded dev token', re: /he_furniture_dev_token/i },
  { label: 'aliyun access key secret', re: /ALIYUN_[A-Z0-9_]*SECRET\s*[:=]/i },
  { label: 'vite secret variable', re: /VITE_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|ACCESS_KEY|APP_SECRET|TOKEN)\b/i },
];

const forbiddenSourcePatterns = [
  { label: 'wechat app secret assignment', re: /WECHAT_APP_SECRET\s*[:=]\s*['"]?[0-9a-f]{32}/i },
  { label: 'supabase service role key assignment', re: /SUPABASE_SERVICE_ROLE_KEY\s*=/i },
  { label: 'sensitive VITE env name', re: /VITE_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|ACCESS_KEY|APP_SECRET|TOKEN)\b/i },
];

const mustBeIgnored = [
  '.env',
  '12345_recover_recover.max',
  '12345_11.max',
  '12345-dist-20260621-mobile-fixes.zip',
];

const sourceScanTargets = [
  'src',
  'api',
  'package.json',
  'vite.config.js',
  '.env.example',
  '.env',
  'README.md',
  'vercel.json',
];

const failures = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(root, fullPath).replace(/\\/g, '/');
    if (
      rel === 'dist_prev' ||
      rel.startsWith('dist_prev/') ||
      rel === 'dist_temp' ||
      rel.startsWith('dist_temp/') ||
      rel === 'node_modules' ||
      rel.startsWith('node_modules/') ||
      rel === '.git' ||
      rel.startsWith('.git/') ||
      rel === '_archive' ||
      rel.startsWith('_archive/') ||
      rel === '_recycle' ||
      rel.startsWith('_recycle/')
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function isLikelyText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    '.html',
    '.js',
    '.mjs',
    '.cjs',
    '.css',
    '.json',
    '.svg',
    '.txt',
    '.md',
  ].includes(ext);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function checkDistFiles() {
  if (!fs.existsSync(distDir)) {
    failures.push('dist directory is missing. Run npm run build before npm run check:security.');
    return;
  }

  for (const file of walk(distDir)) {
    const rel = path.relative(root, file);
    const normalized = `${path.sep}${rel}`;
    const ext = path.extname(file).toLowerCase();
    if (forbiddenDistExtensions.has(ext)) {
      failures.push(`forbidden file in dist: ${rel}`);
    }
    if (forbiddenDistPathParts.some((part) => normalized.includes(part))) {
      failures.push(`forbidden path in dist: ${rel}`);
    }
    if (!isLikelyText(file)) continue;
    const text = readText(file);
    for (const pattern of forbiddenDistPatterns) {
      if (pattern.re.test(text)) {
        failures.push(`forbidden ${pattern.label} in dist file: ${rel}`);
      }
    }
    for (const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try {
        const payload = JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url').toString('utf8'));
        if (payload.role === 'service_role') {
          failures.push(`forbidden supabase service_role JWT in dist file: ${rel}`);
        }
      } catch {
        // Not a JWT payload we understand; ignore.
      }
    }
  }
}

function checkSourceSecrets() {
  for (const target of sourceScanTargets) {
    const fullPath = path.join(root, target);
    const files = fs.existsSync(fullPath)
      ? fs.statSync(fullPath).isDirectory()
        ? walk(fullPath)
        : [fullPath]
      : [];
    for (const file of files) {
      if (!isLikelyText(file)) continue;
      const rel = path.relative(root, file);
      const text = readText(file);
      for (const pattern of forbiddenSourcePatterns) {
        if (pattern.re.test(text)) {
          failures.push(`forbidden ${pattern.label} in source file: ${rel}`);
        }
      }
    }
  }
}

function checkIgnoredFiles() {
  for (const file of mustBeIgnored) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const result = spawnSync('git', ['check-ignore', '-q', file], {
      cwd: root,
    });
    if (result.status !== 0) {
      failures.push(`sensitive/local file is not ignored by git: ${file}`);
    }
  }
}

checkDistFiles();
checkSourceSecrets();
checkIgnoredFiles();

if (failures.length) {
  console.error('[check-security] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[check-security] passed');
