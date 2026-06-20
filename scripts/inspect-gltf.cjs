const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gltfArg = process.argv[2] || 'media/12345.gltf';
const gltfPath = path.resolve(root, gltfArg);
const gltfDir = path.dirname(gltfPath);

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

function collectExternalResources(json) {
  const resources = [];
  for (const [index, buffer] of (json.buffers || []).entries()) {
    if (buffer.uri && !buffer.uri.startsWith('data:')) {
      resources.push({
        type: 'buffer',
        index,
        uri: buffer.uri,
        expectedBytes: buffer.byteLength || null,
      });
    }
  }
  for (const [index, image] of (json.images || []).entries()) {
    if (image.uri && !image.uri.startsWith('data:')) {
      resources.push({
        type: 'image',
        index,
        uri: image.uri,
        expectedBytes: null,
      });
    }
  }
  return resources.map((resource) => {
    const resourcePath = path.resolve(gltfDir, resource.uri);
    const exists = fs.existsSync(resourcePath);
    return {
      ...resource,
      exists,
      actualBytes: exists ? fs.statSync(resourcePath).size : null,
    };
  });
}

function countExtensionUsage(items = []) {
  return items.reduce((counts, item) => {
    for (const name of Object.keys(item.extensions || {})) {
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, {});
}

const json = readJson(gltfPath);
const counts = {
  scenes: countArray(json, 'scenes'),
  nodes: countArray(json, 'nodes'),
  meshes: countArray(json, 'meshes'),
  materials: countArray(json, 'materials'),
  textures: countArray(json, 'textures'),
  images: countArray(json, 'images'),
  animations: countArray(json, 'animations'),
  cameras: countArray(json, 'cameras'),
  buffers: countArray(json, 'buffers'),
};
const resources = collectExternalResources(json);
const missing = resources.filter((resource) => !resource.exists);
const report = {
  file: path.relative(root, gltfPath).replace(/\\/g, '/'),
  asset: json.asset || null,
  counts,
  extensions: collectExtensions(json),
  extensionUsage: {
    materials: countExtensionUsage(json.materials),
    nodes: countExtensionUsage(json.nodes),
    textures: countExtensionUsage(json.textures),
    animations: countExtensionUsage(json.animations),
  },
  resources: {
    total: resources.length,
    missing: missing.length,
    largest: [...resources]
      .filter((resource) => resource.actualBytes != null)
      .sort((a, b) => b.actualBytes - a.actualBytes)
      .slice(0, 8),
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

if (missing.length) {
  console.error(`Missing glTF resources: ${missing.map((resource) => resource.uri).join(', ')}`);
  process.exitCode = 1;
}
