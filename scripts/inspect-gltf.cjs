const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const gltfArg = process.argv[2] || 'media/12345-draco.gltf';
const gltfPath = path.resolve(root, gltfArg);
const gltfDir = path.dirname(gltfPath);

const resourceExtensions = new Set([
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

const forbiddenExtensions = new Set([
  '.max',
  '.zip',
  '.7z',
  '.rar',
  '.bak',
  '.bak2',
  '.psd',
  '.tga',
  '.blend',
  '.fbx',
  '.obj',
  '.ma',
  '.mb',
  '.pem',
  '.key',
  '.crt',
]);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read glTF JSON: ${filePath}\n${error.message}`);
  }
}

function countArray(json, key) {
  return Array.isArray(json[key]) ? json[key].length : 0;
}

function collectExtensions(json) {
  const extensions = new Set([...(json.extensionsUsed || []), ...(json.extensionsRequired || [])]);
  for (const collectionName of ['materials', 'nodes', 'textures', 'animations', 'scenes']) {
    for (const item of json[collectionName] || []) {
      Object.keys(item.extensions || {}).forEach((name) => extensions.add(name));
    }
  }
  return [...extensions].sort();
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
    /^https?:/i.test(text)
  );
}

function isBlockedInlineUri(value) {
  return /^(?:data:|blob:)/i.test(normalizeUri(value).trim());
}

function isMimeString(value) {
  return /^[a-z]+\/[a-z0-9.+-]+$/i.test(normalizeUri(value).trim());
}

function isResourceValue(value) {
  if (typeof value !== 'string' || isSkippedUri(value) || isMimeString(value)) return false;
  if (isBlockedInlineUri(value)) return true;
  const clean = normalizeUri(value).split(/[?#]/, 1)[0];
  return resourceExtensions.has(path.extname(clean).toLowerCase());
}

function traverseJson(node, visitor, key = '') {
  if (Array.isArray(node)) {
    node.forEach((item, index) => traverseJson(item, visitor, String(index)));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node)) {
      if (typeof value === 'string') visitor(childKey, value);
      else traverseJson(value, visitor, childKey);
    }
  }
}

function resolveResource(uri) {
  if (isBlockedInlineUri(uri)) throw new Error(`Inline resources are forbidden: ${uri.slice(0, 40)}`);
  let decoded;
  try {
    decoded = decodeURIComponent(normalizeUri(uri).split(/[?#]/, 1)[0]);
  } catch {
    throw new Error(`Unable to decode URI: ${uri}`);
  }
  if (/^[a-zA-Z]:\//.test(decoded) || path.posix.isAbsolute(decoded)) {
    throw new Error(`Absolute resource path is forbidden: ${uri}`);
  }
  const resolved = path.resolve(gltfDir, decoded);
  const rel = path.relative(gltfDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Resource path escapes glTF directory: ${uri}`);
  }
  const ext = path.extname(decoded).toLowerCase();
  if (forbiddenExtensions.has(ext)) {
    throw new Error(`Forbidden resource type: ${uri}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing glTF resource: ${uri}`);
  }
  if (fs.statSync(resolved).isDirectory()) {
    throw new Error(`Resource points to a directory: ${uri}`);
  }
  return {
    uri: normalizeUri(uri),
    path: resolved,
    bytes: fs.statSync(resolved).size,
  };
}

if (!fs.existsSync(gltfPath)) {
  console.error(`glTF not found: ${gltfArg}`);
  process.exit(1);
}

try {
  const json = readJson(gltfPath);
  const resourcesByUri = new Map();
  const errors = [];

  traverseJson(json, (_key, value) => {
    if (!isResourceValue(value)) return;
    try {
      const resource = resolveResource(value);
      resourcesByUri.set(resource.uri, resource);
    } catch (error) {
      errors.push(error.message);
    }
  });

  const resources = [...resourcesByUri.values()];
  const report = {
    file: path.relative(root, gltfPath).replace(/\\/g, '/'),
    asset: json.asset || null,
    counts: {
      scenes: countArray(json, 'scenes'),
      nodes: countArray(json, 'nodes'),
      meshes: countArray(json, 'meshes'),
      materials: countArray(json, 'materials'),
      textures: countArray(json, 'textures'),
      images: countArray(json, 'images'),
      animations: countArray(json, 'animations'),
      cameras: countArray(json, 'cameras'),
      buffers: countArray(json, 'buffers'),
    },
    extensions: collectExtensions(json),
    resources: {
      total: resources.length,
      missing: errors.length,
      largest: [...resources]
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 8)
        .map((resource) => ({
          uri: resource.uri,
          bytes: resource.bytes,
        })),
    },
    animations: (json.animations || []).map((animation, index) => ({
      index,
      name: animation.name || '',
      channels: animation.channels?.length || 0,
      samplers: animation.samplers?.length || 0,
      extensions: Object.keys(animation.extensions || {}),
    })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
