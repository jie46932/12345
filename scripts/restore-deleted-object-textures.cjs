const fs = require('fs');
const path = require('path');

const [referencePath, targetPath, outputPath = targetPath] = process.argv.slice(2);

if (!referencePath || !targetPath) {
  console.error('Usage: node scripts/restore-deleted-object-textures.cjs <reference.gltf> <target.gltf> [output.gltf]');
  process.exit(1);
}

const OBJECT_MATERIALS = new Map([
  ['Rectangle004', 'Material #178'],
  ['对象015', 'Material #180'],
  ['对象014', 'Material #181'],
  ['对象013', 'Material #184'],
  ['对象012', 'Material #185'],
]);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const union = (...lists) => Array.from(new Set(lists.flat().filter(Boolean)));

const reference = readJson(referencePath);
const target = readJson(targetPath);

target.extensionsUsed = union(reference.extensionsUsed || [], target.extensionsUsed || []);
target.extensionsRequired = union(reference.extensionsRequired || [], target.extensionsRequired || []);

if (!Array.isArray(target.images)) target.images = [];
if (!Array.isArray(target.textures)) target.textures = [];
if (!Array.isArray(target.samplers) && Array.isArray(reference.samplers)) {
  target.samplers = clone(reference.samplers);
}

const ensureArrayIndex = (array, index, value) => {
  while (array.length <= index) array.push(null);
  array[index] = clone(value);
};

const restoredTextures = new Set();
const restoredImages = new Set();
const restoredMaterials = [];

const materialNameToIndex = new Map();
(target.materials || []).forEach((material, index) => {
  if (material?.name) materialNameToIndex.set(material.name, index);
});

for (const materialName of OBJECT_MATERIALS.values()) {
  const referenceIndex = (reference.materials || []).findIndex((material) => material?.name === materialName);
  const targetIndex = materialNameToIndex.get(materialName);
  if (referenceIndex < 0 || targetIndex == null || !target.materials?.[targetIndex]) continue;

  const referenceMaterial = reference.materials[referenceIndex];
  target.materials[targetIndex].extensions = clone(referenceMaterial.extensions || {});
  target.materials[targetIndex].pbrMetallicRoughness = clone(referenceMaterial.pbrMetallicRoughness || {});
  restoredMaterials.push(materialName);

  const nodes = referenceMaterial.extensions?.S8S_v3d_materials?.nodeGraph?.nodes || [];
  for (const node of nodes) {
    if (node.texture == null) continue;
    const textureIndex = node.texture;
    const texture = reference.textures?.[textureIndex];
    if (!texture) continue;
    ensureArrayIndex(target.textures, textureIndex, texture);
    restoredTextures.add(textureIndex);

    const imageIndex = texture.source ?? texture.extensions?.KHR_texture_basisu?.source ?? texture.extensions?.S8S_v3d_texture?.source;
    const image = reference.images?.[imageIndex];
    if (imageIndex != null && image) {
      ensureArrayIndex(target.images, imageIndex, image);
      restoredImages.add(imageIndex);
    }
  }
}

target.images = target.images.filter(Boolean);
target.textures = target.textures.filter(Boolean);

writeJson(outputPath, target);

console.log(JSON.stringify({
  reference: referencePath,
  target: targetPath,
  output: outputPath,
  restoredMaterials,
  restoredTextures: [...restoredTextures].sort((a, b) => a - b),
  restoredImages: [...restoredImages].sort((a, b) => a - b),
  textureCount: target.textures.length,
  imageCount: target.images.length,
}, null, 2));
