# 12345 Project Context

This file stores project-specific facts only. Universal Web3D process knowledge lives in `F:\company-knowledge-base\web3d-nodes\`.

## Runtime

- projectId: `12345`
- runtime: `r3f`
- renderer: `R3F/Three.js`
- assetExport: `3ds Max + Verge3D glTF/bin/texture assets`
- expectedV3dRuntime: `window.v3d === undefined`

## URLs

- devUrl: `http://127.0.0.1:5173/index.dev.html`
- viewerUrl: `https://hefurniture.gsdmsj.cn`
- iframeViewerUrl: `https://hefurniture.gsdmsj.cn/?bypass=1&viewer=1`
- adminUrl: `https://admin.gsdmsj.cn`

## Verified Project Facts

- Production Viewer: `https://hefurniture.gsdmsj.cn`.
- Admin site: `https://admin.gsdmsj.cn`.
- Login API is server-side and proxied by Nginx; do not store service keys or passwords in docs.
- Deployment source is only `F:\verge3d app manager\12345\dist\`.
- Server current symlink is `/srv/www/projects/12345/current`.
- Existing verified record: `DOC/records/2026-06-24-security-deploy.md`.

## Common Checks

- Online bundle must match local `dist/index.html` after deployment.
- `/api/login` must return JSON, not HTML.
- R3F verification should read `window.__threeScene`, `window.__threeRenderer`, and related dataset flags.

## Deployment Boundary

- Publish only `dist/*`.
- Never publish `DOC/`, source files, `.max`, `.env`, `.git`, `node_modules`, recycle/archive folders, or temporary archives.
