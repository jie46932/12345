# HE Furniture 8th Wall AR

This folder mirrors the 8th Wall Desktop project used for mobile AR testing.

## Mac setup

```bash
cd 8thwall-desktop/12345
npm install
npm run build
```

Open this folder with 8th Wall Desktop, or copy its contents into your local
`Documents/8th Wall/12345` project. The `dist/` and `node_modules/` folders are
generated locally and are intentionally not committed.

## AR behavior

- Scan the floor or tabletop first.
- A high-contrast placement marker appears when placement is ready.
- Tap the marker to place `src/assets/mainModel-ar-ios11.glb`.
- Long-press with one finger to show forward/back/left/right movement buttons.
- Long-press with two fingers to show left/right rotation buttons.
- Scale is locked and rotation is constrained to the vertical axis.
