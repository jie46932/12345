# 12345 Web3D Project Index

> This file is an index only. Universal Web3D node instructions live in `F:\company-knowledge-base\web3d-nodes\`. Project-specific facts live in `DOC/project-context.md` and `DOC/node-overrides.json`.

## Project

- project_id: `12345`
- project_name: `12345 智能升降桌 3D 配置器`
- local_path: `F:\verge3d app manager\12345`
- dev_url: `http://127.0.0.1:5173/index.dev.html`
- viewer_url: `https://hefurniture.gsdmsj.cn`
- iframe_viewer_url: `https://hefurniture.gsdmsj.cn/?bypass=1&viewer=1`
- admin_url: `https://admin.gsdmsj.cn`
- current_node: `17_bugfix_debugging`

## Runtime Boundary

- runtime: `R3F/Three.js`
- asset_export: `3ds Max + Verge3D glTF/bin/texture assets`
- normal Viewer runtime must satisfy: `window.v3d === undefined`
- debug globals are listed in `DOC/node-overrides.json`.

## Required Entry Points

1. Read `.agent-rules.md`.
2. Read the selected `.kiro/specs/<name>/` when the task has a Spec.
3. Read `F:\company-knowledge-base\web3d-nodes\router.md`.
4. Read `F:\company-knowledge-base\web3d-nodes\skill-router.json`.
5. Read `DOC/project-context.md`.
6. Read `DOC/node-overrides.json`.
7. Read `DOC/records/` when previous verified records may affect the task.
8. Match the task route before reading company node docs or making changes.

## Important Rules

- Viewer deployment uploads only `dist/*`.
- Never upload `.max`, source files, `node_modules`, `.env`, `.git`, `_archive`, `.kiro`, `DOC`, or temporary zip files.
- Browser verification must use DOM, console, resource list, runtime globals, and API status. Screenshots are only辅助观察.
- Project-specific details override company defaults only when explicitly recorded in `DOC/node-overrides.json`.

## Key Docs

- Company router: `F:\company-knowledge-base\web3d-nodes\router.md`
- Company skill router: `F:\company-knowledge-base\web3d-nodes\skill-router.json`
- Company nodes: `F:\company-knowledge-base\web3d-nodes\`
- Company Spec guide: `F:\company-knowledge-base\web3d-nodes\spec-driven-development.md`
- Project Specs: `.kiro/specs/`
- Project context: `DOC/project-context.md`
- Project overrides: `DOC/node-overrides.json`
- Project records: `DOC/records/`
