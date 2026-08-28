# 12345 DOC

This project uses the centralized company Web3D DOC system.

## Read Order

1. `PROJECT.md`
2. `.agent-rules.md`
3. `.kiro/specs/<name>/` when the task has a Spec
4. `F:\company-knowledge-base\web3d-nodes\router.md`
5. `F:\company-knowledge-base\web3d-nodes\skill-router.json`
6. `DOC/project-context.md`
7. `DOC/node-overrides.json`
8. matched company node files
9. `DOC/records/`

## What Lives Here

- `project-context.md`: project facts and verified boundaries.
- `node-overrides.json`: project-specific routing, URLs, debug globals, validation and deployment overrides.
- `records/`: verified task records and reports.

Universal node descriptions, skill guidance, checklists, commands and templates live in `F:\company-knowledge-base\web3d-nodes\`.

Single-change Feature and Bugfix execution documents live in `.kiro/specs/`; they are not copied into this lightweight DOC directory.
