const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const reports = path.join(root, 'reports');
const out = path.join(reports, 'max-scene-scan.json');
const ms = path.join(reports, 'scan-max-scene.ms');
fs.mkdirSync(reports, { recursive: true });

const script = String.raw`(
  fn q s = (local t=substituteString (s as string) "\\" "\\\\"; t=substituteString t "\"" "\\\""; "\""+t+"\"")
  fn boolText v = if v then "true" else "false"
  fn join arr sep = (local s=""; for i=1 to arr.count do (if i>1 do s+=sep; s+=arr[i]); s)
  fn keysJson ctrl = (
    local rows=#(); local n=try(numKeys ctrl)catch(0)
    for i=1 to n do (local t=getKeyTime ctrl i; append rows ("{\"frame\":"+(t.frame as string)+"}"))
    "["+(join rows ",")+"]"
  )
  fn nodeJson n = (
    local mesh=try(snapshotAsMesh n)catch(undefined)
    local faces=if mesh==undefined then 0 else mesh.numfaces
    local normals=faces==0 or (try(mesh.numfaces>0)catch(false))
    local uv=if mesh==undefined then false else try(meshop.getMapSupport mesh 1)catch(false)
    if mesh!=undefined do free mesh
    "{\"name\":"+q n.name+",\"class\":"+q ((classOf n) as string)+",\"parent\":"+q (if n.parent==undefined then "" else n.parent.name)+",\"negativeScale\":"+boolText (n.transform.determinantsign<0)+",\"faces\":"+(faces as string)+",\"hasNormals\":"+boolText normals+",\"mapSupport1\":"+boolText uv+",\"material\":"+q (if n.material==undefined then "" else n.material.name)+",\"positionKeys\":[{\"axis\":\"position\",\"keys\":"+keysJson n.pos.controller+"}],\"rotationKeys\":[{\"axis\":\"rotation\",\"keys\":"+keysJson n.rotation.controller+"}],\"scaleKeys\":[{\"axis\":\"scale\",\"keys\":"+keysJson n.scale.controller+"}]}"
  )
  local nodesJson=for n in objects collect nodeJson n
  local camerasJson=for c in cameras collect ("{\"name\":"+q c.name+",\"class\":"+q ((classOf c) as string)+",\"fov\":"+try(c.fov as string)catch("null")+"}")
  local json="{\"sourceFile\":"+q (maxFilePath+maxFileName)+",\"frameRate\":"+(frameRate as string)+",\"animationRange\":["+(animationRange.start.frame as string)+","+(animationRange.end.frame as string)+"],\"cameras\":["+(join camerasJson ",")+"],\"nodes\":["+(join nodesJson ",")+"]}"
  local f=createFile @"__OUT__"; format "%" json to:f; close f
)`.replace('__OUT__', out.replace(/\\/g, '\\\\'));
fs.writeFileSync(ms, script, 'utf8');
console.log(`[scan:max] generated ${path.relative(root, ms)}`);
console.log('[scan:max] execute this read-only MaxScript in the source .max scene, then run npm run check:max');
