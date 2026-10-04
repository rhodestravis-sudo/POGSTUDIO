const { app, BrowserWindow, dialog, ipcMain, protocol } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_APP_URL = "https://planogram-studio-pro.rhodes-travis.chatgpt.site";

let mainWindow;
let currentWorkspacePath = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "planogram-local-image",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const mimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

const compact = (value = "") => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const barcodeVariants = (value = "") => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return [];
  return [...new Set([digits, digits.replace(/^0+/, ""), digits.padStart(12, "0"), digits.padStart(13, "0")])].filter(Boolean);
};
const localImageUrl = (filePath) =>
  `planogram-local-image://local/${Buffer.from(filePath, "utf8").toString("base64url")}`;

const scanImageFiles = async (rootPath, limit = 10000) => {
  const files = [];
  const visit = async (directory) => {
    if (files.length >= limit) return;
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= limit) break;
      if (entry.name.startsWith(".")) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  };
  await visit(rootPath);
  return files;
};

const scoreImageMatch = (product, filePath) => {
  const fileKey = compact(path.basename(filePath, path.extname(filePath)));
  if (!fileKey) return 0;
  for (const code of [...barcodeVariants(product.upc), ...barcodeVariants(product.sku)]) {
    const key = compact(code);
    if (key && fileKey.includes(key)) return 1000 + key.length;
  }
  const brand = compact(product.brand);
  const name = compact(product.name);
  if (brand && name && fileKey.includes(brand) && fileKey.includes(name.slice(0, Math.min(name.length, 18)))) return 700;
  if (name && name.length > 8 && fileKey.includes(name.slice(0, Math.min(name.length, 24)))) return 500;
  const words = `${product.brand ?? ""} ${product.name ?? ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  const hits = words.filter((word) => fileKey.includes(word)).length;
  return hits >= 2 ? hits * 100 : 0;
};

const saveWorkspaceAs = async (contents) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Planogram Studio workspace",
    defaultPath: currentWorkspacePath || "Planogram Studio Workspace.pogstudio",
    filters: [
      { name: "Planogram Studio workspace", extensions: ["pogstudio"] },
      { name: "JSON", extensions: ["json"] },
    ],
  });
  if (result.canceled || !result.filePath) return null;
  currentWorkspacePath = result.filePath;
  await fs.writeFile(currentWorkspacePath, contents, "utf8");
  return { path: currentWorkspacePath };
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    title: "Planogram Studio Pro",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appUrl = process.env.PLANOGRAM_STUDIO_URL || DEFAULT_APP_URL;
  void mainWindow.loadURL(appUrl);
};

ipcMain.handle("workspace:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Planogram Studio workspace",
    filters: [
      { name: "Planogram Studio workspace", extensions: ["json", "pogstudio"] },
      { name: "All files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  currentWorkspacePath = result.filePaths[0];
  return {
    path: currentWorkspacePath,
    contents: await fs.readFile(currentWorkspacePath, "utf8"),
  };
});

ipcMain.handle("workspace:save-as", async (_event, contents) => {
  return saveWorkspaceAs(contents);
});

ipcMain.handle("workspace:save", async (_event, contents) => {
  if (!currentWorkspacePath) {
    return saveWorkspaceAs(contents);
  }
  await fs.writeFile(currentWorkspacePath, contents, "utf8");
  return { path: currentWorkspacePath };
});

ipcMain.handle("images:choose-folder", async (_event, products = []) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose Planogram Studio image folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const rootPath = result.filePaths[0];
  const files = await scanImageFiles(rootPath);
  const matches = {};
  for (const product of products) {
    let best = null;
    for (const filePath of files) {
      const score = scoreImageMatch(product, filePath);
      if (score > (best?.score ?? 0)) best = { path: filePath, score };
    }
    if (best?.score > 0) {
      matches[product.id] = {
        path: best.path,
        url: localImageUrl(best.path),
        score: best.score,
      };
    }
  }
  return { path: rootPath, scanned: files.length, matches };
});

app.whenReady().then(() => {
  protocol.handle("planogram-local-image", async (request) => {
    try {
      const encoded = new URL(request.url).pathname.replace(/^\//, "");
      const filePath = Buffer.from(encoded, "base64url").toString("utf8");
      const extension = path.extname(filePath).toLowerCase();
      const data = await fs.readFile(filePath);
      return new Response(data, {
        headers: {
          "content-type": mimeTypes.get(extension) || "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return new Response("Image not found", { status: 404 });
    }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
