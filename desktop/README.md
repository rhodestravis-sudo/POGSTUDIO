# Planogram Studio Pro Desktop

This is the first desktop-app scaffold for Planogram Studio Pro.

## Current state

- Opens the existing Planogram Studio Pro app in a native desktop window.
- Adds a secure preload bridge for local workspace open/save.
- Adds a local image-folder picker that matches product image files by UPC, SKU, brand and product name.
- Keeps the live web app unchanged.
- The app now has a `Workspace JSON` export option for moving all POGs and product/image records into a desktop-local file.

## Next build step

Wire the web UI to `window.planogramDesktop` so desktop users can:

- Open a `.pogstudio` local workspace file.
- Save the full workspace locally.
- Save As to create a new local workspace.
- Choose a local image folder and relink matching product images to desktop-local files.
- Later, copy remote image URLs into a local `/images` cache so POG switching and rendering no longer depends on cloud image fetches.

## Running locally later

Install desktop dependencies and run:

```bash
npm install --save-dev electron electron-builder
npm run desktop
```

Create a local unpacked desktop app:

```bash
npm run desktop:pack
```

Create distributable installers:

```bash
npm run desktop:dist
```

The first packaged version is Windows-first and local-file focused. Avoid cloud sync, accounts, and auto-update until local open/save/image-cache behavior is solid.
