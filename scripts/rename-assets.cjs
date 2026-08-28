const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const tempDir = path.join(root, 'dist_temp');
const prevDir = path.join(root, 'dist_prev');

const configuredExtensions = new Set([
  '.gltf',
  '.bin',
  '.ktx2',
  '.hdr',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.mp3',
  '.wav',
  '.aac',
  '.s8s',
  '.json',
  '.basis',
  '.dds',
]);

const textExtensions = new Set(['.html', '.js', '.mjs', '.cjs', '.json', '.css']);
const pathLikeKeys = new Set(['uri', 'url', 'file', 'source', 'path', 'src']);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=');
    args[key] = inlineValue ?? argv[index + 1];
    if (inlineValue == null) index += 1;
  }
  return args;
}

function fail(message) {
  throw new Error(`[rename-assets] ${message}`);
}

function safeRemove(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, json) {
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

function normalizeUri(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isSkippedUri(value) {
  const text = normalizeUri(value).trim();
  return (
    !text ||
    text.startsWith('#') ||
    text.startsWith('//') ||
    /^(?:https?:|data:|blob:)/i.test(text) ||
    /^[a-z]+\/[a-z0-9.+-]+$/i.test(text)
  );
}

function isAllowedResourceValue(value) {
  if (typeof value !== 'string' || isSkippedUri(value)) return false;
  const clean = normalizeUri(value).split(/[?#]/, 1)[0];
  return configuredExtensions.has(path.extname(clean).toLowerCase());
}

function isResourceReference(key, value) {
  if (!isAllowedResourceValue(value)) return false;
  const clean = normalizeUri(value).split(/[?#]/, 1)[0];
  return pathLikeKeys.has(String(key).toLowerCase()) || clean.includes('/') || configuredExtensions.has(path.extname(clean).toLowerCase());
}

function resolveInside(baseDir, uri) {
  let decoded;
  try {
    decoded = decodeURIComponent(normalizeUri(uri).split(/[?#]/, 1)[0]);
  } catch {
    fail(`无法 URL 解码资源路径: ${uri}`);
  }
  if (/^[a-zA-Z]:\//.test(decoded) || path.posix.isAbsolute(decoded)) fail(`禁止绝对资源路径: ${uri}`);
  const resolved = path.resolve(baseDir, decoded);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`资源路径越界: ${uri}`);
  return { decoded, resolved };
}

function traverseJson(node, visitor, key = '') {
  if (Array.isArray(node)) {
    node.forEach((item, index) => traverseJson(item, visitor, String(index)));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node)) {
      if (typeof value === 'string') visitor(node, childKey, value);
      else traverseJson(value, visitor, childKey);
    }
  }
}

function uniqueTargetName(filePath, prefix, usedTargets) {
  const ext = path.extname(filePath);
  const dir = path.dirname(filePath);
  const first = path.join(dir, `${prefix}${ext}`);
  if (!usedTargets.has(first) && !fs.existsSync(first)) {
    usedTargets.add(first);
    return first;
  }
  let index = 1;
  while (true) {
    const candidate = path.join(dir, `${prefix}-${String(index).padStart(3, '0')}${ext}`);
    if (!usedTargets.has(candidate) && !fs.existsSync(candidate)) {
      usedTargets.add(candidate);
      return candidate;
    }
    index += 1;
  }
}

function toPosixRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replace(/\\/g, '/');
}

function collectResourcePaths(rootFiles, prefix) {
  const mapping = new Map();
  const usedTargets = new Set();

  for (const rootFile of rootFiles) {
    const rootJson = readJson(rootFile);
    const rootDir = path.dirname(rootFile);

    if (!mapping.has(rootFile)) {
      mapping.set(rootFile, path.join(rootDir, `${prefix}${path.extname(rootFile)}`));
      usedTargets.add(mapping.get(rootFile));
    }

    traverseJson(rootJson, (_owner, key, value) => {
      if (!isResourceReference(key, value)) return;
      const { resolved } = resolveInside(rootDir, value);
      if (!fs.existsSync(resolved)) fail(`资源文件不存在: ${value}`);
      if (fs.statSync(resolved).isDirectory()) fail(`资源指向目录: ${value}`);
      if (mapping.has(resolved)) return;
      mapping.set(resolved, uniqueTargetName(resolved, prefix, usedTargets));
    });
  }

  return mapping;
}

function rewriteRootFiles(rootFiles, mapping) {
  for (const rootFile of rootFiles) {
    const json = readJson(rootFile);
    const rootDir = path.dirname(rootFile);
    traverseJson(json, (owner, key, value) => {
      if (!isResourceReference(key, value)) return;
      const { resolved } = resolveInside(rootDir, value);
      const target = mapping.get(resolved);
      if (!target) return;
      owner[key] = toPosixRelative(rootDir, target);
    });
    writeJson(rootFile, json);
  }
}

function renameMappedFiles(mapping) {
  for (const [source, target] of mapping.entries()) {
    if (source === target) fail(`目标文件与源文件相同: ${source}`);
    if (!fs.existsSync(source)) fail(`源文件不存在: ${source}`);
    if (fs.existsSync(target)) fail(`目标文件已存在: ${target}`);
  }

  for (const [source, target] of mapping.entries()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);
    for (const suffix of ['.gz', '.xz']) {
      const sidecar = `${source}${suffix}`;
      if (!fs.existsSync(sidecar)) continue;
      const sidecarTarget = `${target}${suffix}`;
      if (fs.existsSync(sidecarTarget)) fail(`目标压缩旁路文件已存在: ${sidecarTarget}`);
      fs.renameSync(sidecar, sidecarTarget);
    }
  }
}

function updatePublishedEntryReferences(tempRoot, oldEntryName, newEntryName) {
  const variants = [
    oldEntryName,
    `media/${oldEntryName}`,
    `./media/${oldEntryName}`,
    `/media/${oldEntryName}`,
  ];
  const replacements = new Map([
    [oldEntryName, newEntryName],
    [`media/${oldEntryName}`, `media/${newEntryName}`],
    [`./media/${oldEntryName}`, `./media/${newEntryName}`],
    [`/media/${oldEntryName}`, `/media/${newEntryName}`],
  ]);
  const textFiles = walk(tempRoot).filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
  let hits = 0;

  for (const file of textFiles) {
    let text = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const variant of variants) {
      if (!text.includes(variant)) continue;
      hits += (text.match(new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      text = text.split(variant).join(replacements.get(variant));
      changed = true;
    }
    if (changed) fs.writeFileSync(file, text);
  }

  if (hits < 1) fail(`发布产物中没有找到旧入口引用: ${oldEntryName}`);

  const leftovers = textFiles.filter((file) => fs.readFileSync(file, 'utf8').includes(oldEntryName));
  if (leftovers.length) {
    fail(`旧入口仍残留在发布文本中: ${leftovers.map((file) => path.relative(tempRoot, file)).join(', ')}`);
  }
}

function swapDist() {
  safeRemove(prevDir);
  fs.renameSync(distDir, prevDir);
  try {
    fs.renameSync(tempDir, distDir);
  } catch (error) {
    if (fs.existsSync(prevDir) && !fs.existsSync(distDir)) fs.renameSync(prevDir, distDir);
    throw error;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.entry) fail('缺少 --entry');
  if (!args.prefix) fail('缺少 --prefix');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) fail('dist/index.html 不存在，请先 npm run build');

  safeRemove(tempDir);
  fs.cpSync(distDir, tempDir, { recursive: true });

  const tempEntry = path.resolve(root, args.entry.replace(/^dist[\\/]/, 'dist_temp/'));
  if (!tempEntry.startsWith(tempDir)) fail('--entry 必须指向 dist 内文件');
  if (!fs.existsSync(tempEntry)) fail(`入口 glTF 不存在: ${args.entry}`);

  const rootFiles = [tempEntry];
  const mapping = collectResourcePaths(rootFiles, args.prefix);
  const oldEntryName = path.basename(tempEntry);
  const newEntryPath = mapping.get(tempEntry);
  const newEntryName = path.basename(newEntryPath);

  rewriteRootFiles(rootFiles, mapping);
  renameMappedFiles(mapping);
  updatePublishedEntryReferences(tempDir, oldEntryName, newEntryName);
  swapDist();

  console.log(`[rename-assets] ${oldEntryName} -> ${newEntryName}`);
  console.log(`[rename-assets] renamed files: ${mapping.size}`);
  console.log('[rename-assets] dist_prev kept for rollback');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
