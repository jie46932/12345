const fs = require('fs');
const path = require('path');

const [sourcePath, compressedPath, outputPath] = process.argv.slice(2);

if (!sourcePath || !compressedPath || !outputPath) {
  console.error('Usage: node scripts/restore-s8s-gltf.cjs <source.gltf> <compressed.gltf> <output.gltf>');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
};

const source = readJson(sourcePath);
const compressed = readJson(compressedPath);

const union = (...lists) => Array.from(new Set(lists.flat().filter(Boolean)));

compressed.extensionsUsed = union(source.extensionsUsed || [], compressed.extensionsUsed || []);
compressed.extensionsRequired = union(source.extensionsRequired || [], compressed.extensionsRequired || []);

if (source.extensions) {
  compressed.extensions = { ...(compressed.extensions || {}), ...source.extensions };
}

// glTF Transform cannot understand Verge3D S8S material/texture extensions and
// serializes them away. Restore those metadata blocks while keeping compressed
// geometry bufferViews/accessors/primitives intact.
if (Array.isArray(source.textures)) {
  compressed.textures = source.textures;
}

if (Array.isArray(source.materials) && Array.isArray(compressed.materials)) {
  source.materials.forEach((material, index) => {
    if (!compressed.materials[index]) return;
    compressed.materials[index] = {
      ...compressed.materials[index],
      ...material,
    };
  });
}

if (Array.isArray(source.nodes) && Array.isArray(compressed.nodes)) {
  source.nodes.forEach((node, index) => {
    if (!compressed.nodes[index]) return;
    for (const key of ['name', 'extensions', 'extras']) {
      if (node[key] !== undefined) compressed.nodes[index][key] = node[key];
    }
  });
}

if (Array.isArray(source.animations) && Array.isArray(compressed.animations)) {
  source.animations.forEach((animation, index) => {
    if (!compressed.animations[index]) return;
    for (const key of ['name', 'extensions', 'extras']) {
      if (animation[key] !== undefined) compressed.animations[index][key] = animation[key];
    }
  });
}

if (Array.isArray(source.cameras) && Array.isArray(compressed.cameras)) {
  source.cameras.forEach((camera, index) => {
    if (!compressed.cameras[index]) return;
    compressed.cameras[index] = {
      ...compressed.cameras[index],
      ...camera,
    };
  });
}

if (Array.isArray(source.scenes) && Array.isArray(compressed.scenes)) {
  source.scenes.forEach((scene, index) => {
    if (!compressed.scenes[index]) return;
    for (const key of ['name', 'extensions', 'extras']) {
      if (scene[key] !== undefined) compressed.scenes[index][key] = scene[key];
    }
  });
}

writeJson(outputPath, compressed);

console.log(JSON.stringify({
  source: sourcePath,
  compressed: compressedPath,
  output: outputPath,
  extensionsUsed: compressed.extensionsUsed,
  materials: compressed.materials?.length || 0,
  textures: compressed.textures?.length || 0,
  nodes: compressed.nodes?.length || 0,
}, null, 2));
