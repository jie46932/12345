import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'media', '12345-draco.gltf');
const outputPath = path.join(root, 'media', '12345-ar.usdz');
const previousOutputPath = path.join(root, 'media', '12345-ar.previous.usdz');
const targetWidthMeters = 1;
const minUsdzBytes = 1024 * 1024;

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.lengthComputable = Boolean(init.lengthComputable);
    this.loaded = init.loaded || 0;
    this.total = init.total || 0;
  }
};

function runGltfTransformCopy(tempPath) {
  const cliPath = path.join(root, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
  const result = spawnSync(process.execPath, [cliPath, 'copy', sourcePath, tempPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`gltf-transform copy failed:\n${result.stdout || ''}${result.stderr || ''}`.trim());
  }

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (output) console.log(output);
}

function toDataUri(filePath) {
  return `data:application/octet-stream;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function prepareGltfForNode(gltfPath) {
  const gltfDir = path.dirname(gltfPath);
  const json = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));

  for (const bufferInfo of json.buffers || []) {
    if (!bufferInfo.uri || /^data:/i.test(bufferInfo.uri)) continue;
    bufferInfo.uri = toDataUri(path.join(gltfDir, bufferInfo.uri));
  }

  delete json.images;
  delete json.textures;

  for (const material of json.materials || []) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
  }

  return JSON.stringify(json);
}

async function loadScene(gltfPath) {
  const loader = new GLTFLoader();
  const gltfJson = prepareGltfForNode(gltfPath);
  return new Promise((resolve, reject) => {
    loader.parse(gltfJson, `${path.dirname(gltfPath)}${path.sep}`, resolve, reject);
  });
}

function createARScene(sourceScene) {
  sourceScene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(sourceScene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const width = Math.max(size.x, size.z);
  const scale = width > 0 ? targetWidthMeters / width : 0.01;

  const scene = new THREE.Group();
  scene.name = 'he_furniture_12345_ar';

  const normalizeMatrix = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));

  let meshCount = 0;
  const materialCache = new Map();

  sourceScene.traverse((object) => {
    if (!object.isMesh || object.visible === false || !object.geometry) return;

    const geometry = object.geometry.clone();
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.deleteAttribute('tangent');
    geometry.deleteAttribute('color');
    geometry.applyMatrix4(object.matrixWorld);
    geometry.applyMatrix4(normalizeMatrix);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, toQuickLookMaterial(object.material, materialCache));
    mesh.name = sanitizeUSDName(object.name || `Mesh_${meshCount + 1}`);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.identity();
    meshCount += 1;
    scene.add(mesh);
  });

  if (meshCount === 0) {
    throw new Error('No visible meshes found for iOS AR USDZ export.');
  }

  scene.updateMatrixWorld(true);
  return { scene, scale, size, meshCount, materialCount: materialCache.size };
}

function sanitizeUSDName(name) {
  const safe = String(name)
    .normalize('NFKD')
    .replace(/[^\w]/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[A-Za-z_]/.test(safe) ? safe : `Mesh_${safe || 'Object'}`;
}

function toQuickLookMaterial(sourceMaterial, cache) {
  if (Array.isArray(sourceMaterial)) {
    return sourceMaterial.map((material) => toQuickLookMaterial(material, cache));
  }

  const key = sourceMaterial?.uuid || 'default';
  if (cache.has(key)) return cache.get(key);

  const material = new THREE.MeshStandardMaterial({
    name: sanitizeUSDName(sourceMaterial?.name || `Material_${cache.size + 1}`),
    color: sourceMaterial?.color?.isColor ? sourceMaterial.color.clone() : new THREE.Color(0xcccccc),
    metalness: Number.isFinite(sourceMaterial?.metalness) ? THREE.MathUtils.clamp(sourceMaterial.metalness, 0, 1) : 0,
    roughness: Number.isFinite(sourceMaterial?.roughness) ? THREE.MathUtils.clamp(sourceMaterial.roughness, 0.2, 1) : 0.65,
    side: THREE.FrontSide,
  });

  if (sourceMaterial?.emissive?.isColor) {
    material.emissive.copy(sourceMaterial.emissive);
    material.emissiveIntensity = Number.isFinite(sourceMaterial.emissiveIntensity)
      ? THREE.MathUtils.clamp(sourceMaterial.emissiveIntensity, 0, 1)
      : 0;
  }

  cache.set(key, material);
  return material;
}

function countZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  const maxCommentLength = 0xffff;
  const start = Math.max(0, buffer.length - (maxCommentLength + 22));
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== eocdSignature) continue;
    return buffer.readUInt16LE(offset + 10);
  }
  return 0;
}

function validateUSDZ(buffer) {
  const header = buffer.subarray(0, 4).toString('latin1');
  const text = buffer.toString('utf8');
  const entryCount = countZipEntries(buffer);
  const failures = [];

  if (!header.startsWith('PK')) failures.push('missing ZIP header');
  if (buffer.length < minUsdzBytes) failures.push(`file is too small: ${buffer.length} bytes`);
  if (!text.includes('model.usda')) failures.push('missing model.usda entry');
  if (!text.includes('#usda 1.0')) failures.push('missing USDA payload');
  if (!text.includes('def Mesh')) failures.push('missing mesh definitions');
  if (entryCount < 2) failures.push(`unexpected ZIP entry count: ${entryCount}`);

  if (failures.length) {
    throw new Error(`USDZ validation failed: ${failures.join('; ')}`);
  }

  return {
    bytes: buffer.length,
    entryCount,
    hasModelUsda: text.includes('model.usda'),
    hasTextures: /\.(?:png|jpe?g)/i.test(text),
  };
}

function preservePreviousOutput() {
  if (!fs.existsSync(outputPath)) return false;
  if (fs.existsSync(previousOutputPath)) return false;
  fs.copyFileSync(outputPath, previousOutputPath);
  return true;
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source glTF not found: ${path.relative(root, sourcePath)}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '12345-usdz-'));
  const tempGltfPath = path.join(tempDir, '12345-ar-source.gltf');

  try {
    runGltfTransformCopy(tempGltfPath);
    const gltf = await loadScene(tempGltfPath);
    const { scene, scale, size, meshCount, materialCount } = createARScene(gltf.scene);
    const exporter = new USDZExporter();
    const arrayBuffer = await exporter.parseAsync(scene, {
      quickLookCompatible: true,
      maxTextureSize: 1024,
      includeAnchoringProperties: true,
      ar: {
        anchoring: { type: 'plane' },
        planeAnchoring: { alignment: 'horizontal' },
      },
    });

    const outputBuffer = Buffer.from(arrayBuffer);
    const validation = validateUSDZ(outputBuffer);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const previousPreserved = preservePreviousOutput();
    fs.writeFileSync(outputPath, outputBuffer);
    console.log(JSON.stringify({
      output: path.relative(root, outputPath).replace(/\\/g, '/'),
      bytes: outputBuffer.length,
      targetWidthMeters,
      scale,
      meshCount,
      materialCount,
      previousPreserved,
      sourceSize: {
        x: size.x,
        y: size.y,
        z: size.z,
      },
      textures: 'solid-pbr-materials',
      validation,
    }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[build-usdz] failed');
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
