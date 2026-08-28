const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const budget = JSON.parse(fs.readFileSync(path.join(root, 'quality-budget.json'), 'utf8'));
const dist = path.resolve(root, budget.distDir || 'dist');
const MB = 1024 * 1024;
const warnings = [];
const errors = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function dimensions(file) {
  const b = fs.readFileSync(file);
  if (b.length >= 24 && b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length >= 48 && b.toString('hex', 0, 12) === 'ab4b5458203230bb0d0a1a0a') return [b.readUInt32LE(20), b.readUInt32LE(24)];
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8L') { const bits = b.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const size = b.readUInt16BE(i + 2);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      if (size < 2) break;
      i += size + 2;
    }
  }
  return null;
}

function referencedTextures(gltfFile) {
  if (!fs.existsSync(gltfFile)) { errors.push(`missing glTF: ${path.relative(root, gltfFile)}`); return []; }
  const gltf = JSON.parse(fs.readFileSync(gltfFile, 'utf8'));
  const indexes = new Map();
  const add = (info, material) => {
    const texture = gltf.textures?.[info?.index];
    const image = gltf.images?.[texture?.source ?? texture?.extensions?.KHR_texture_basisu?.source];
    if (!image?.uri || image.uri.startsWith('data:')) return;
    const row = indexes.get(image.uri) || { uri: image.uri, materials: new Set() };
    row.materials.add(material || '(unnamed)');
    indexes.set(image.uri, row);
  };
  for (const material of gltf.materials || []) {
    const name = material.name || '(unnamed)';
    add(material.pbrMetallicRoughness?.baseColorTexture, name);
    add(material.pbrMetallicRoughness?.metallicRoughnessTexture, name);
    add(material.normalTexture, name); add(material.occlusionTexture, name); add(material.emissiveTexture, name);
    const walkExtension = (value, key = '') => {
      if (Number.isInteger(value) && /texture(index)?$/i.test(key)) add({ index: value }, name);
      else if (Array.isArray(value)) value.forEach((item) => walkExtension(item, key));
      else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => walkExtension(child, childKey));
    };
    walkExtension(material.extensions || {});
  }
  return [...indexes.values()].map((row) => ({ ...row, file: path.resolve(path.dirname(gltfFile), decodeURIComponent(row.uri)) }));
}

if (!fs.existsSync(dist)) errors.push(`dist directory missing: ${dist}`);
const files = walk(dist);
const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
const js = files.filter((f) => f.endsWith('.js')).sort((a,b) => fs.statSync(b).size - fs.statSync(a).size);
const model = files.filter((f) => /\.(gltf|glb|bin)$/i.test(f)).reduce((n,f) => n + fs.statSync(f).size, 0);
if (total > budget.maxDistMB * MB) errors.push(`dist ${(total/MB).toFixed(2)}MB > ${budget.maxDistMB}MB`);
if (js[0] && fs.statSync(js[0]).size > budget.maxJavaScriptMB * MB) errors.push(`largest JS ${(fs.statSync(js[0]).size/MB).toFixed(2)}MB > ${budget.maxJavaScriptMB}MB`);
if (model > budget.maxGltfBinMB * MB) errors.push(`glTF/bin ${(model/MB).toFixed(2)}MB > ${budget.maxGltfBinMB}MB`);
for (const file of files.filter((f) => /\.(mp4|mov|webm)$/i.test(f))) if (fs.statSync(file).size > budget.maxVideoMB * MB) errors.push(`video > ${budget.maxVideoMB}MB: ${path.relative(dist,file)}`);

const textures = [];
for (const rel of budget.gltfFiles || []) {
  const gltfFile = path.join(dist, rel);
  for (const row of referencedTextures(gltfFile)) {
    if (!fs.existsSync(row.file)) { errors.push(`missing material texture: ${path.relative(dist,row.file)}`); continue; }
    const dim = dimensions(row.file);
    const info = { file: path.relative(dist,row.file), width: dim?.[0] ?? null, height: dim?.[1] ?? null, format: path.extname(row.file).slice(1), bytes: fs.statSync(row.file).size, materials: [...row.materials] };
    textures.push(info);
    if (!dim) warnings.push(`cannot read texture dimensions: ${info.file}`);
    else if (dim[0] > budget.textureFailPixels || dim[1] > budget.textureFailPixels) errors.push(`texture ${info.file} ${dim[0]}x${dim[1]} exceeds ${budget.textureFailPixels}px; materials=${info.materials.join(',')}`);
    else if (dim[0] > budget.textureWarnPixels || dim[1] > budget.textureWarnPixels) warnings.push(`texture ${info.file} ${dim[0]}x${dim[1]} exceeds ${budget.textureWarnPixels}px; materials=${info.materials.join(',')}`);
  }
}

const largest = files.map((file) => ({ file: path.relative(dist,file), bytes: fs.statSync(file).size })).sort((a,b) => b.bytes-a.bytes).slice(0,10);
const report = { projectId: budget.projectId, generatedAt: new Date().toISOString(), totals: { distMB: +(total/MB).toFixed(2), largestJavaScriptMB: js[0] ? +(fs.statSync(js[0]).size/MB).toFixed(2) : 0, gltfBinMB: +(model/MB).toFixed(2) }, textures, largest, warnings, errors };
fs.mkdirSync(path.join(root,'reports'), { recursive: true });
fs.writeFileSync(path.join(root,'reports','performance-budget.json'), JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (errors.length) process.exitCode = 1;
