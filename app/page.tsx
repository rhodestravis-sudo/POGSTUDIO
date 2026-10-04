"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  Hand,
  ImagePlus,
  Layers3,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Save,
  ScanLine,
  Search,
  Trash2,
  Undo2,
  Upload,
  FlipHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  Ruler,
  Crop,
} from "lucide-react";
import { createPsa, exportPsa, listPsaPlanograms, parsePsa } from "./psa";
import { lookupBarcodes } from "./lib/barcodes";

type ColorMode =
  | "none"
  | "colorGroup"
  | "manufacturer"
  | "brand"
  | "size"
  | "facings"
  | "capacity"
  | "sales"
  | "units"
  | "velocity"
  | "profit"
  | "growth";
type RibbonTab = "file" | "fixture" | "shelves" | "products" | "analytics" | "view" | "export";
type PerformanceData = {
  sales?: number;
  units?: number;
  velocity?: number;
  profit?: number;
  growth?: number;
  updatedAt?: string;
};
type Product = {
  id: string;
  name: string;
  brand: string;
  manufacturer?: string;
  colorGroup?: string;
  description: string;
  upc: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  price: number;
  width: number;
  height: number;
  depth: number;
  unitsPerFacing?: number;
  orientation?: "front" | "side" | "top";
  merchStyle?: "unit" | "case" | "tray" | "stack";
  minFacings?: number;
  recommendedFacings?: number;
  maxFacings?: number;
  performance?: PerformanceData;
  image?: string;
  imageSource?: string;
  imageSourceUrl?: string;
  imageLookupCheckedAt?: string;
  imageLookupVersion?: number;
  imageQualityScore?: number;
  localImagePath?: string;
  imageRotation?: 0 | 90 | 180 | 270;
  imageFlipped?: boolean;
  color: string;
  sourcePsaId?: string;
  sourcePsaLine?: number;
  customFields?: Record<string, string>;
};
type SpaceMetric = "sales" | "units" | "velocity";
type SpaceGroupField = "category" | "subcategory" | "manufacturer" | "brand" | string;
type SavedAnalyticsView = {
  id: string;
  name: string;
  metric: SpaceMetric;
  groups: SpaceGroupField[];
};
type SpaceHierarchyNode = {
  path: string;
  label: string;
  level: number;
  linearInches: number;
  performance: number;
  products: number;
  children: SpaceHierarchyNode[];
  productRows: Array<{
    product: Product;
    facings: number;
    capacity: number;
    linearInches: number;
    sections: Set<string>;
    shelves: Set<string>;
  }>;
};
type SpaceHierarchyDisplayRow =
  | { kind: "group"; node: SpaceHierarchyNode }
  | {
      kind: "product";
      level: number;
      row: SpaceHierarchyNode["productRows"][number];
    };
type ManualCropState = {
  productId: string;
  productName: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};
type Placement = {
  id: string;
  productId: string;
  x: number;
  facings: number;
  sourcePsaLine?: number;
};
type Shelf = {
  id: string;
  name: string;
  height: number;
  width?: number;
  placements: Placement[];
  sourcePsaPositionY?: number;
  sourcePsaFixtureLine?: number;
};
type FixtureSection = {
  id: string;
  name: string;
  width: number;
  shelves: Shelf[];
  sourcePsaX?: number;
};
type Planogram = {
  id: string;
  title: string;
  fixtureWidth: number;
  fixtureHeight: number;
  products: Product[];
  sections: FixtureSection[];
  shelves?: Shelf[];
  autoArrange?: boolean;
  showWarnings?: boolean;
  colorMode?: ColorMode;
  hideImagesForColor?: boolean;
  customColors?: Record<string, string>;
  exportLegend?: boolean;
  clientName?: string;
  locationName?: string;
  projectNotes?: string;
  retailerName?: string;
  planogramCode?: string;
  effectiveDate?: string;
  sourceFormat?: "psa" | "pdf";
  sourceVersion?: string;
  sourceFileName?: string;
  importWarnings?: string[];
  sourcePsaText?: string;
  sourcePsaKey?: string;
  sourcePsaPlanogramLine?: number;
  sourcePsaPlanogramEndLine?: number;
};
type SavedVersion = {
  id: string;
  planogramId: string;
  name: string;
  createdAt: string;
  planogram: Planogram;
  automatic?: boolean;
};
type AnalyticsData = {
  days: number;
  audience: "all" | "owner" | "testers";
  summary: { actions: number; testers: number; sessions: number; errors: number; saves: number };
  users: Array<{ email: string; role: string; events: number; actions: number; sessions: number; errors: number; last_seen: number }>;
  friction: Array<{ action: string; event_type: string; outcome: string; count: number; testers: number }>;
  recentErrors: Array<{ action: string; count: number; testers: number; details?: string; last_seen: number }>;
  journey: Array<{ stage: string; events: number; testers: number }>;
};
type AppUser = {
  email: string;
  displayName: string;
  isOwner: boolean;
  provider: "chatgpt" | "beta";
};
type AuthState =
  | { status: "checking" }
  | { status: "signed-out"; message?: string }
  | { status: "signed-in"; user: AppUser };
type DeletedPlanogram = {
  id: string;
  deletedAt: string;
  planogram: Planogram;
};
type ColorTemplate = {
  id: string;
  name: string;
  colors: Record<string, string>;
};
type Workspace = {
  activeId: string;
  planograms: Planogram[];
  versions?: SavedVersion[];
  colorTemplates?: ColorTemplate[];
  trash?: DeletedPlanogram[];
  customProductColumns?: string[];
  analyticsViews?: SavedAnalyticsView[];
};
type DesktopBridge = {
  isDesktop: true;
  openWorkspace: () => Promise<{ path: string; contents: string } | null>;
  saveWorkspace: (contents: string) => Promise<{ path: string } | null>;
  saveWorkspaceAs: (contents: string) => Promise<{ path: string } | null>;
  chooseImageFolder: (
    products: Array<Pick<Product, "id" | "upc" | "sku" | "brand" | "name">>,
  ) => Promise<{
    path: string;
    scanned: number;
    matches: Record<string, { path: string; url: string; score: number }>;
  } | null>;
};
type PlanogramSummary = {
  id: string;
  title: string;
  productCount?: number;
  sectionCount?: number;
};

const MAX_LOCAL_RECOVERY_PRODUCTS = 2000;
const LOCAL_RECOVERY_DELAY_MS = 2500;
const MAX_PRODUCT_LIBRARY_ROWS = 300;
const MAX_POG_PRODUCT_ROWS = 500;
const MAX_OPENED_POG_CACHE = 50;

const workspaceProductCount = (value: Workspace) =>
  value.planograms.reduce((total, item) => total + item.products.length, 0);
const isLargeWorkspace = (value: Workspace) =>
  workspaceProductCount(value) > MAX_LOCAL_RECOVERY_PRODUCTS;
const forgetLocalRecovery = (key: string, includeLegacy = false) => {
  try {
    window.localStorage.removeItem(key);
    if (includeLegacy) window.localStorage.removeItem("planogram-studio-recovery");
  } catch {}
};

const colors = [
  "#e85d3f",
  "#f3aa3d",
  "#22a377",
  "#377bd3",
  "#7547c7",
  "#d54577",
];
const groupColors = [
  "#177ddc",
  "#ea580c",
  "#159957",
  "#8b5cf6",
  "#db2777",
  "#0f8b8d",
  "#b7791f",
  "#64748b",
  "#c2410c",
  "#2563eb",
];
const colorForText = (value: string) => {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return groupColors[Math.abs(hash) % groupColors.length];
};
const productDisplaySize = (product: Product) => {
  let size: { width: number; height: number };
  if (product.orientation === "side")
    size = { width: product.depth, height: product.height };
  else if (product.orientation === "top")
    size = { width: product.width, height: product.depth };
  else size = { width: product.width, height: product.height };
  return product.imageRotation === 90 || product.imageRotation === 270
    ? { width: size.height, height: size.width }
    : size;
};
const productImageTransform = (product: Product) =>
  `rotate(${product.imageRotation ?? 0}deg) scale(${product.imageRotation === 90 || product.imageRotation === 270 ? 0.82 : 1}) scaleX(${product.imageFlipped ? -1 : 1})`;
const shelfProductImageStyle = (product: Product) => {
  const quarterTurn =
    product.imageRotation === 90 || product.imageRotation === 270;
  if (!quarterTurn) return { transform: productImageTransform(product) };
  const size = productDisplaySize(product);
  return {
    width: `${(size.height / Math.max(0.1, size.width)) * 100}%`,
    height: `${(size.width / Math.max(0.1, size.height)) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    transform: `rotate(${product.imageRotation}deg) scaleX(${product.imageFlipped ? -1 : 1})`,
  };
};
const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const formatAnalyticsAction = (value: string) => {
  const legacy: Record<string, string> = {
    ImageLibraryImagesImages: "Image Library",
    ImageLibraryImages: "Image Library",
    ProductLibraryProducts: "Image Library",
    POGProductLibraryPOGLibraryPOGItems: "POG Product Library",
    POGProductLibraryPOGItems: "POG Product Library",
    PlanogramPlanogramPOG: "Planogram",
    PlanogramPOG: "Planogram",
  };
  const compact = value.replace(/\s+/g, "");
  if (legacy[compact]) return legacy[compact];
  return value
    .replace(/^ribbon_/, "")
    .replace(/_/g, " ")
    .replace(/\bin\b$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
};
const compactKey = (value?: string) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const uniqueKeys = (values: string[]) => [...new Set(values.filter(Boolean))];
const barcodeCatalogKeys = (product: Product) =>
  lookupBarcodes(product).map((value) => `upc:${value}`);
const catalogKeys = (product: Product) => {
  const sku = compactKey(product.sku),
    name = compactKey(product.name);
  return uniqueKeys([
    ...barcodeCatalogKeys(product),
    sku && !/^0+$/.test(sku) ? `sku:${sku}` : "",
    name ? `name:${name}` : "",
  ]);
};
const sameCatalogProduct = (left: Product, right: Product) => {
  const leftKeys = catalogKeys(left),
    rightKeys = catalogKeys(right),
    leftUpc = leftKeys.find((key) => key.startsWith("upc:")),
    rightUpc = rightKeys.find((key) => key.startsWith("upc:"));
  if (leftUpc && rightUpc) return leftUpc === rightUpc;
  const leftSku = leftKeys.find((key) => key.startsWith("sku:")),
    rightSku = rightKeys.find((key) => key.startsWith("sku:"));
  if (leftSku && rightSku) return leftSku === rightSku;
  const rightSet = new Set(rightKeys.filter((key) => key.startsWith("name:")));
  return leftKeys.some((key) => key.startsWith("name:") && rightSet.has(key));
};
const productImageRank = (product?: Product) =>
  product?.image
    ? Number(product.imageQualityScore ?? 0) * 10 +
      Number(product.imageLookupVersion ?? 0)
    : -1;
const mergeProductImageFields = (
  target: Product,
  ...sources: Array<Product | undefined>
): Product => {
  let best = target.image ? target : undefined;
  for (const source of sources) {
    if (!source?.image) continue;
    if (!best?.image || productImageRank(source) > productImageRank(best))
      best = source;
  }
  if (!best?.image) return target;
  return {
    ...target,
    image: best.image,
    imageSource: best.imageSource,
    imageSourceUrl: best.imageSourceUrl,
    imageLookupCheckedAt: best.imageLookupCheckedAt,
    imageLookupVersion: best.imageLookupVersion,
    imageQualityScore: best.imageQualityScore,
    imageRotation: best.imageRotation ?? 0,
    imageFlipped: best.imageFlipped ?? false,
  };
};
const mergeCatalogProduct = (existing: Product, source: Product): Product => ({
  ...mergeProductImageFields(
    {
      ...existing,
      name: source.name || existing.name,
      brand: source.brand || existing.brand,
      manufacturer: source.manufacturer || existing.manufacturer,
      colorGroup: existing.colorGroup || source.colorGroup,
      description: source.description || existing.description,
      upc: source.upc || existing.upc,
      sku: source.sku || existing.sku,
      category: source.category || existing.category,
      subcategory: source.subcategory || existing.subcategory,
      price: existing.price || source.price,
      width: source.width || existing.width,
      height: source.height || existing.height,
      depth: source.depth || existing.depth,
      unitsPerFacing: source.unitsPerFacing || existing.unitsPerFacing,
      customFields: { ...(source.customFields ?? {}), ...(existing.customFields ?? {}) },
    },
    existing,
    source,
  ),
});
const syncAllProductFieldsExceptPerformance = (
  existing: Product,
  source: Product,
): Product =>
  mergeProductImageFields(
    {
      ...structuredClone(source),
      id: existing.id,
      performance: existing.performance ?? {},
      sourcePsaId: existing.sourcePsaId,
      sourcePsaLine: existing.sourcePsaLine,
    },
    existing,
    source,
  );
const reliableCatalogKeys = (product: Product) => {
  const sku = compactKey(product.sku);
  return uniqueKeys([
    ...barcodeCatalogKeys(product),
    sku && !/^0+$/.test(sku) ? `sku:${sku}` : "",
  ]);
};
const hasReliableCatalogMatch = (left: Product, right: Product) => {
  const rightKeys = new Set(reliableCatalogKeys(right));
  return reliableCatalogKeys(left).some((key) => rightKeys.has(key));
};
const isPlaceholderProductName = (value: string) =>
  /^(new|unknown|unnamed)\s*(item|product)?$/i.test((value ?? "").trim());
const mergeSharedCatalogRecord = (existing: Product, candidate: Product): Product => {
  const preferText = (current?: string, next?: string) =>
    current?.trim() ? current : (next ?? current ?? "");
  const name =
    (!(existing.name ?? "").trim() || isPlaceholderProductName(existing.name)) &&
    (candidate.name ?? "").trim() &&
    !isPlaceholderProductName(candidate.name)
      ? candidate.name
      : (existing.name ?? candidate.name ?? "New product");
  return mergeProductImageFields(
    {
      ...existing,
      name,
      brand: preferText(existing.brand, candidate.brand),
      manufacturer: preferText(existing.manufacturer, candidate.manufacturer),
      colorGroup: preferText(existing.colorGroup, candidate.colorGroup),
      description: preferText(existing.description, candidate.description),
      upc: preferText(existing.upc, candidate.upc),
      sku: preferText(existing.sku, candidate.sku),
      category: preferText(existing.category, candidate.category),
      subcategory: preferText(existing.subcategory, candidate.subcategory),
      customFields: { ...(candidate.customFields ?? {}), ...(existing.customFields ?? {}) },
    },
    existing,
    candidate,
  );
};
const reconcileCatalogAcrossPlanograms = (planograms: Planogram[]) => {
  const groups: Array<{ keys: Set<string>; shared: Product }> = [];
  for (const product of planograms.flatMap((planogram) => planogram.products)) {
    const keys = reliableCatalogKeys(product);
    if (!keys.length) continue;
    const matches = groups.filter((group) => keys.some((key) => group.keys.has(key)));
    if (!matches.length) {
      groups.push({ keys: new Set(keys), shared: structuredClone(product) });
      continue;
    }
    const primary = matches[0];
    primary.shared = mergeSharedCatalogRecord(primary.shared, product);
    keys.forEach((key) => primary.keys.add(key));
    for (const duplicate of matches.slice(1)) {
      duplicate.keys.forEach((key) => primary.keys.add(key));
      primary.shared = mergeSharedCatalogRecord(primary.shared, duplicate.shared);
      groups.splice(groups.indexOf(duplicate), 1);
    }
  }
  return planograms.map((planogram) => ({
    ...planogram,
    products: planogram.products.map((product) => {
      const group = groups.find((candidate) => reliableCatalogKeys(product).some((key) => candidate.keys.has(key)));
      return group ? syncAllProductFieldsExceptPerformance(product, mergeSharedCatalogRecord(group.shared, product)) : product;
    }),
  }));
};
const imageRestoreKeys = (product: Product) => {
  const reliable = reliableCatalogKeys(product);
  if (reliable.length) return reliable;
  const name = compactKey(product.name);
  return name && !isPlaceholderProductName(product.name) ? [`name:${name}`] : [];
};
const buildImageRestoreMap = (sources: Product[]) => {
  const byKey = new Map<string, Product>();
  for (const source of sources) {
    if (!source.image) continue;
    for (const key of imageRestoreKeys(source)) {
      const current = byKey.get(key);
      if (!current || productImageRank(source) > productImageRank(current))
        byKey.set(key, source);
    }
  }
  return byKey;
};
const restoreImagesInPlanograms = (
  planograms: Planogram[],
  imageMap: Map<string, Product>,
) =>
  planograms.map((planogram) => ({
    ...planogram,
    products: planogram.products.map((product) => {
      let restored = product;
      for (const key of imageRestoreKeys(product))
        restored = mergeProductImageFields(restored, imageMap.get(key));
      return restored;
    }),
  }));
const workspaceImageSources = (workspace: Workspace) => [
  ...workspace.planograms.flatMap((planogram) => planogram.products),
  ...(workspace.versions ?? []).flatMap((version) => version.planogram.products),
  ...(workspace.trash ?? []).flatMap((deleted) => deleted.planogram.products),
];
const restoreWorkspaceProductImages = (
  workspace: Workspace,
  sourceWorkspaces: Workspace[] = [],
) => {
  const imageMap = buildImageRestoreMap([
    ...workspaceImageSources(workspace),
    ...sourceWorkspaces.flatMap(workspaceImageSources),
  ]);
  return {
    ...workspace,
    planograms: restoreImagesInPlanograms(workspace.planograms, imageMap),
    versions: (workspace.versions ?? []).map((version) => ({
      ...version,
      planogram: restoreImagesInPlanograms([version.planogram], imageMap)[0],
    })),
    trash: (workspace.trash ?? []).map((deleted) => ({
      ...deleted,
      planogram: restoreImagesInPlanograms([deleted.planogram], imageMap)[0],
    })),
  };
};
const syncCatalogProducts = (target: Planogram, sources: Product[]) => {
  const products = target.products.map((product) => ({ ...product }));
  let added = 0,
    updated = 0;
  for (const source of sources) {
    const index = products.findIndex((product) => sameCatalogProduct(product, source));
    if (index >= 0) {
      products[index] = mergeCatalogProduct(products[index], source);
      updated++;
    } else {
      products.push({
        ...structuredClone(source),
        id: uid("product"),
        performance: {},
        sourcePsaId: undefined,
        sourcePsaLine: undefined,
      });
      added++;
    }
  }
  return { planogram: { ...target, products }, added, updated };
};
const blankShelves = (width: number) =>
  [1, 2, 3, 4].map((n) => ({
    id: uid("shelf"),
    name: `Shelf ${n}`,
    height: 11,
    width,
    placements: [],
  }));

const starterProducts: Product[] = [
  {
    id: "p1",
    name: "Sea Salt Chips",
    brand: "Boulder Canyon",
    description: "Kettle cooked sea salt potato chips",
    upc: "70816311845",
    price: 2.49,
    width: 5.5,
    height: 8,
    depth: 2,
    unitsPerFacing: 6,
    color: "#377bd3",
  },
  {
    id: "p2",
    name: "Nacho Tortilla Chips",
    brand: "Utz",
    description: "Crunchy nacho cheese tortilla chips",
    upc: "04178027112",
    price: 2.25,
    width: 5.8,
    height: 8.5,
    depth: 2.2,
    unitsPerFacing: 6,
    color: "#e85d3f",
  },
  {
    id: "p3",
    name: "Protein Bar",
    brand: "Quest",
    description: "Chocolate chip cookie dough protein bar",
    upc: "88884900081",
    price: 3.25,
    width: 2.2,
    height: 6.2,
    depth: 1,
    unitsPerFacing: 8,
    color: "#7547c7",
  },
];
const starterShelves: Shelf[] = [
  {
    id: "s1",
    name: "Shelf 1",
    height: 11,
    width: 42,
    placements: [
      { id: "a", productId: "p1", x: 7, facings: 2 },
      { id: "b", productId: "p2", x: 38, facings: 2 },
      { id: "c", productId: "p3", x: 74, facings: 3 },
    ],
  },
  { id: "s2", name: "Shelf 2", height: 11, width: 42, placements: [] },
  { id: "s3", name: "Shelf 3", height: 11, width: 42, placements: [] },
  { id: "s4", name: "Shelf 4", height: 11, width: 42, placements: [] },
];
const starter: Planogram = {
  id: "pog-main",
  title: "Main Snack Machine",
  fixtureWidth: 42,
  fixtureHeight: 72,
  products: starterProducts,
  sections: [
    {
      id: "section-main",
      name: "Section 1",
      width: 42,
      shelves: starterShelves,
    },
  ],
  autoArrange: true,
};
const initial: Workspace = {
  activeId: starter.id,
  planograms: [starter],
  versions: [],
  colorTemplates: [],
  trash: [],
  customProductColumns: [],
  analyticsViews: [],
};

const normalizeProduct = (product: Product): Product => ({
  ...product,
  manufacturer: product.manufacturer ?? "",
  colorGroup: product.colorGroup ?? "",
  sku: product.sku ?? "",
  category: product.category ?? "",
  subcategory: product.subcategory ?? "",
  unitsPerFacing: Math.max(1, Math.round(Number(product.unitsPerFacing) || 1)),
  orientation: product.orientation ?? "front",
  merchStyle: product.merchStyle ?? "unit",
  minFacings: Math.max(1, Math.round(Number(product.minFacings) || 1)),
  recommendedFacings: Math.max(
    1,
    Math.round(Number(product.recommendedFacings) || 1),
  ),
  maxFacings: Math.max(1, Math.round(Number(product.maxFacings) || 8)),
  performance: product.performance ?? {},
  customFields: product.customFields ?? {},
  imageRotation: product.imageRotation ?? 0,
  imageFlipped: product.imageFlipped ?? false,
});
const normalizePlan = (plan: Planogram): Planogram => {
  const legacyShelves = Array.isArray(plan.shelves) ? plan.shelves : [];
  const sections =
    Array.isArray(plan.sections) && plan.sections.length
      ? plan.sections.map((section, index) => ({
          ...section,
          id: section.id || `section-${plan.id}-${index + 1}`,
          name: section.name || `Section ${index + 1}`,
          width: Math.max(1, Number(section.width) || plan.fixtureWidth || 42),
          shelves: Array.isArray(section.shelves) ? section.shelves : [],
        }))
      : [
          {
            id: `section-${plan.id}-1`,
            name: "Section 1",
            width: Math.max(1, Number(plan.fixtureWidth) || 42),
            shelves: legacyShelves,
          },
        ];
  return {
    ...plan,
    products: plan.products.map(normalizeProduct),
    sections,
    fixtureWidth: sections.reduce((sum, section) => sum + section.width, 0),
    shelves: undefined,
    autoArrange: plan.autoArrange !== false,
    showWarnings: plan.showWarnings === true,
    colorMode: plan.colorMode ?? "none",
    hideImagesForColor: plan.hideImagesForColor === true,
    customColors: plan.customColors ?? {},
    exportLegend: plan.exportLegend !== false,
    clientName: plan.clientName ?? "",
    locationName: plan.locationName ?? "",
    projectNotes: plan.projectNotes ?? "",
    retailerName: plan.retailerName ?? "",
    planogramCode: plan.planogramCode ?? "",
    effectiveDate: plan.effectiveDate ?? "",
    sourceFormat: plan.sourceFormat,
    sourceVersion: plan.sourceVersion ?? "",
    sourceFileName: plan.sourceFileName ?? "",
    importWarnings: Array.isArray(plan.importWarnings) ? plan.importWarnings : [],
    sourcePsaText: plan.sourcePsaText ?? "",
    sourcePsaKey: plan.sourcePsaKey ?? "",
  };
};
function normalize(value: unknown): Workspace {
  const v = value as Partial<Workspace> & Partial<Planogram>;
  if (Array.isArray(v?.planograms) && v.planograms.length) {
    const planograms = reconcileCatalogAcrossPlanograms(v.planograms.map((p) => normalizePlan(p))),
      versions = Array.isArray(v.versions)
        ? v.versions.filter(
            (version) => version?.planogram && version?.planogramId,
          ).map((version) => ({
            ...version,
            planogram: normalizePlan(version.planogram),
          }))
        : [];
    const workspace = {
      activeId: planograms.some((p) => p.id === v.activeId)
        ? String(v.activeId)
        : planograms[0].id,
      planograms,
      versions,
      colorTemplates: Array.isArray(v.colorTemplates) ? v.colorTemplates : [],
      trash: Array.isArray(v.trash)
        ? v.trash
            .filter((deleted) => deleted?.planogram)
            .map((deleted) => ({
              ...deleted,
              planogram: normalizePlan(deleted.planogram),
            }))
        : [],
      customProductColumns: Array.isArray(v.customProductColumns)
        ? v.customProductColumns.filter((column): column is string => typeof column === "string" && Boolean(column.trim()))
        : [],
      analyticsViews: Array.isArray(v.analyticsViews)
        ? v.analyticsViews.filter(
            (view): view is SavedAnalyticsView =>
              typeof view?.id === "string" &&
              typeof view?.name === "string" &&
              ["sales", "units", "velocity"].includes(view.metric) &&
              Array.isArray(view.groups),
          ).map((view) => ({
            ...view,
            groups: view.groups.filter((group): group is string => typeof group === "string").slice(0, 3),
          }))
        : [],
    };
    return restoreWorkspaceProductImages(workspace);
  }
  if (
    Array.isArray(v?.products) &&
    (Array.isArray(v?.shelves) || Array.isArray(v?.sections))
  ) {
    const old = v as Planogram,
      id = old.id || uid("pog"),
      plan = normalizePlan({ ...old, id });
    return restoreWorkspaceProductImages({
      activeId: id,
      planograms: [plan],
      versions: [],
      colorTemplates: [],
      trash: [],
      customProductColumns: [],
      analyticsViews: [],
    });
  }
  return initial;
}

const loadCanvasImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (
    shortened.length > 2 &&
    ctx.measureText(`${shortened}…`).width > maxWidth
  )
    shortened = shortened.slice(0, -1);
  return `${shortened}…`;
};
const csvEscape = (value: string | number | undefined) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};
const safeFileName = (value: string) =>
  value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "planogram";
const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const desktopBridge = () =>
  typeof window === "undefined"
    ? undefined
    : (window as typeof window & { planogramDesktop?: DesktopBridge })
        .planogramDesktop;

export default function Home() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [workspace, setWorkspaceState] = useState<Workspace>(initial);
  const saveAsMenuRef = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState<string | null>("p1");
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(
    null,
  );
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<
    | "pending"
    | "saving"
    | "saved"
    | "retrying"
    | "backup"
    | "offline"
    | "conflict"
  >("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [manualSaveRunning, setManualSaveRunning] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [cloudConflict, setCloudConflict] = useState<{
    state: Workspace;
    revision: number;
  } | null>(null);
  const [imageStatus, setImageStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [imageMessage, setImageMessage] = useState("");
  const [manualCrop, setManualCrop] = useState<ManualCropState | null>(null);
  const [upcImageStatus, setUpcImageStatus] = useState<
    "idle" | "searching" | "done" | "error"
  >("idle");
  const [upcImageMessage, setUpcImageMessage] = useState("");
  const [pendingImageMatch, setPendingImageMatch] = useState<{
    product: Product;
    image: string;
    source?: string;
    sourceUrl: string;
    qualityScore?: number;
  } | null>(null);
  const [autoUpcLookup, setAutoUpcLookup] = useState(true);
  const upcLookupRunning = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [versionChoice, setVersionChoice] = useState("");
  const [colorTemplateChoice, setColorTemplateChoice] = useState("");
  const [viewMode, setViewMode] = useState(false);
  const [viewZoom, setViewZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>("fixture");
  const [showSpaceAnalytics, setShowSpaceAnalytics] = useState(false);
  const [spaceMetric, setSpaceMetric] = useState<SpaceMetric>("sales");
  const [spaceGroups, setSpaceGroups] = useState<SpaceGroupField[]>([
    "category",
    "subcategory",
    "brand",
  ]);
  const [expandedSpaceGroups, setExpandedSpaceGroups] = useState<string[]>([]);
  const [editingPogProducts, setEditingPogProducts] = useState(false);
  const [savedAnalyticsViewId, setSavedAnalyticsViewId] = useState("");
  const [pogProductQuery, setPogProductQuery] = useState("");
  const [pogProductFilter, setPogProductFilter] = useState<"all" | "missing" | "complete">("all");
  const [pogProductSort, setPogProductSort] = useState<"name" | "manufacturer" | "linear" | "sales" | "spaceIndex">("name");
  const [selectedPogProductIds, setSelectedPogProductIds] = useState<string[]>([]);
  const [bulkDimensions, setBulkDimensions] = useState({ width: "", height: "", depth: "" });
  const [workspaceView, setWorkspaceView] = useState<"planogram" | "pogProducts" | "library" | "analytics">("planogram");
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [sourcePogId, setSourcePogId] = useState("");
  const [planogramSummaries, setPlanogramSummaries] = useState<PlanogramSummary[]>([]);
  const [partialWorkspace, setPartialWorkspace] = useState(false);
  const [switchingPogId, setSwitchingPogId] = useState("");
  const [sourceProductQuery, setSourceProductQuery] = useState("");
  const [sourcePogLoading, setSourcePogLoading] = useState(false);
  const [sourcePogCacheVersion, setSourcePogCacheVersion] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyDrawerOpen, setCopyDrawerOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsOwner, setAnalyticsOwner] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsAudience, setAnalyticsAudience] = useState<"all" | "owner" | "testers">("testers");
  const analyticsSession = useRef(uid("session"));
  const lastTrackedEvent = useRef(new Map<string, number>());
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(true);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [booting, setBooting] = useState(true);
  const [bootMessage, setBootMessage] = useState("Opening Planogram Studio Pro");
  const loaded = useRef(false);
  const recoveryStorageKey = useRef("planogram-studio-recovery");
  const cloudRevision = useRef<number | null>(null);
  const conflictRef = useRef(false);
  const pendingCloudSave = useRef<{
    snapshot: Workspace;
    force: boolean;
    sequence: number;
  } | null>(null);
  const saveInFlight = useRef(false);
  const saveRetryTimer = useRef<number | null>(null);
  const saveRetryCount = useRef(0);
  const saveSequence = useRef(0);
  const confirmedSaveSequence = useRef(0);
  const latestWorkspace = useRef(workspace);
  const recoverySaveTimer = useRef<number | null>(null);
  const cloudDirty = useRef(false);
  const suppressNextCloudDirty = useRef(false);
  const fullWorkspaceHydrated = useRef(false);
  const fullWorkspaceHydrationInFlight = useRef(false);
  const idlePrefetchedPlanograms = useRef(new Set<string>());
  const prefetchPlanogramLoads = useRef(new Map<string, Promise<Planogram | null>>());
  const openedPlanograms = useRef(new Map<string, Planogram>());
  const sourcePogLoads = useRef(new Set<string>());
  const failedSourcePogLoads = useRef(new Set<string>());
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewPointers = useRef(new Map<number, { x: number; y: number }>());
  const viewGesture = useRef({
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startZoom: 1,
  });
  const cropDragRef = useRef<{
    mode: "move" | "nw" | "ne" | "sw" | "se";
    startClientX: number;
    startClientY: number;
    startCrop: Pick<ManualCropState, "x" | "y" | "width" | "height">;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);
  const dragRef = useRef<{
    sectionId: string;
    shelfId: string;
    placementId: string;
    placementIds: string[];
    productId: string;
    element: HTMLDivElement;
    elements: HTMLDivElement[];
    startClientX: number;
    startClientY: number;
    grabFraction: number;
    targetSectionId: string;
    targetShelfId: string;
    targetX: number;
    highlighted: HTMLElement | null;
    dropZones: Array<{
      element: HTMLElement;
      rect: DOMRect;
      sectionId: string;
      shelfId: string;
    }>;
    previewed: HTMLElement[];
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const undoStack = useRef<Workspace[]>([]);
  const redoStack = useRef<Workspace[]>([]);
  const trackEvent = (
    eventType: string,
    action: string,
    outcome = "success",
    details?: Record<string, string | number | boolean>,
  ) => {
    const key = `${eventType}:${action}:${outcome}`,
      now = Date.now(),
      previous = lastTrackedEvent.current.get(key) ?? 0;
    if (outcome === "error" && now - previous < 30_000) return;
    lastTrackedEvent.current.set(key, now);
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, action, outcome, details: { ...details, session: analyticsSession.current } }),
      keepalive: true,
    }).catch(() => {});
  };
  useEffect(() => {
    setIsDesktopApp(Boolean(desktopBridge()?.isDesktop));
  }, []);
  const rememberOpenedPlanogram = (item?: Planogram | null) => {
    if (!item) return;
    const cache = openedPlanograms.current;
    cache.delete(item.id);
    cache.set(item.id, structuredClone(item));
    while (cache.size > MAX_OPENED_POG_CACHE) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  };
  const rememberWorkspacePlanograms = (value: Workspace) => {
    for (const item of value.planograms) rememberOpenedPlanogram(item);
  };
  const activateLocalPlanogram = (item: Planogram) => {
    suppressNextCloudDirty.current = true;
    setWorkspace((current) => ({
      ...current,
      activeId: item.id,
      planograms:
        fullWorkspaceHydrated.current ||
        current.planograms.length > 1 ||
        current.planograms.some((planogram) => planogram.id === item.id)
          ? current.planograms.some((planogram) => planogram.id === item.id)
            ? current.planograms
            : [...current.planograms, structuredClone(item)]
          : [structuredClone(item)],
    }));
    setSelected(item.products[0]?.id ?? null);
    setActiveSectionId(item.sections[0]?.id ?? null);
    setSelectedPlacement(null);
    setVersionChoice("");
  };
  const warmPlanogramImages = (item?: Planogram | null) => {
    if (!item || typeof window === "undefined") return;
    const placedProductIds = new Set(
        item.sections.flatMap((section) =>
          section.shelves.flatMap((shelf) =>
            shelf.placements.map((placement) => placement.productId),
          ),
        ),
      ),
      images = [
        ...new Set(
          item.products
            .filter((product) => placedProductIds.has(product.id))
            .map((product) => product.image)
            .filter((image): image is string => Boolean(image)),
        ),
      ].slice(0, 80);
    const run = () => {
      for (const src of images) {
        const image = new Image();
        image.decoding = "async";
        image.src = src;
      }
    };
    if ("requestIdleCallback" in window)
      window.requestIdleCallback(run, { timeout: 2500 });
    else window.setTimeout(run, 1200);
  };
  const applySignedInUser = (user: AppUser) => {
    loaded.current = false;
    fullWorkspaceHydrated.current = false;
    fullWorkspaceHydrationInFlight.current = false;
    idlePrefetchedPlanograms.current.clear();
    prefetchPlanogramLoads.current.clear();
    openedPlanograms.current.clear();
    sourcePogLoads.current.clear();
    failedSourcePogLoads.current.clear();
    setWorkspaceLoadFailed(false);
    cloudRevision.current = null;
    conflictRef.current = false;
    pendingCloudSave.current = null;
    setCloudConflict(null);
    setSaved("saved");
    setSaveMessage("");
    setBooting(true);
    setBootMessage("Checking your saved workspace");
    setAuth({ status: "signed-in", user });
  };
  const signOut = async () => {
    await fetch("/api/session", {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    }).catch(() => {});
    loaded.current = false;
    setAnalyticsOwner(false);
    setAnalyticsData(null);
    setWorkspaceState(initial);
    setSelected(initial.activeId);
    setBooting(false);
    setAuth({ status: "signed-out" });
  };
  const loadAnalytics = async (days = analyticsDays, audience = analyticsAudience) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/analytics?days=${days}&audience=${audience}`);
      if (response.status === 403) {
        setAnalyticsOwner(false);
        return;
      }
      if (!response.ok) throw new Error("Unable to load analytics");
      const data = (await response.json()) as AnalyticsData;
      setAnalyticsOwner(true);
      setAnalyticsData(data);
    } finally {
      setAnalyticsLoading(false);
    }
  };
  const setWorkspace = (update: React.SetStateAction<Workspace>) =>
    setWorkspaceState((current) => {
      const next =
        typeof update === "function"
          ? (update as (value: Workspace) => Workspace)(current)
          : update;
      if (loaded.current && next !== current) {
        undoStack.current = [...undoStack.current.slice(-49), current];
        redoStack.current = [];
      }
      return next;
    });

  const plan =
    workspace.planograms.find((p) => p.id === workspace.activeId) ??
    workspace.planograms[0];
  const pogOptions = planogramSummaries.length
    ? planogramSummaries
    : workspace.planograms.map((item) => ({
        id: item.id,
        title: item.title,
        productCount: item.products.length,
        sectionCount: item.sections.length,
      }));
  const sourcePogOptions = pogOptions.filter((item) => item.id !== plan.id),
    resolvedSourcePogId = sourcePogOptions.some((item) => item.id === sourcePogId)
      ? sourcePogId
      : (sourcePogOptions[0]?.id ?? "");
  const sourcePog =
    (resolvedSourcePogId
      ? openedPlanograms.current.get(resolvedSourcePogId) ??
        workspace.planograms.find((p) => p.id === resolvedSourcePogId && p.id !== plan.id)
      : null) ?? null;
  const sourcePlacements = useMemo(
    () =>
      sourcePog
        ? sourcePog.sections.flatMap((section) =>
            section.shelves.flatMap((shelf) =>
              shelf.placements.map((placement) => ({
                section,
                shelf,
                placement,
                product: sourcePog.products.find(
                  (item) => item.id === placement.productId,
                ),
              })),
            ),
          )
        : [],
    [sourcePog, sourcePogCacheVersion],
  );
  const filteredSourcePlacements = sourcePlacements.filter(({ product, section, shelf }) =>
    product
      ? (product.name + product.brand + product.upc + product.sku + section.name + shelf.name)
          .toLowerCase()
          .includes(sourceProductQuery.toLowerCase())
      : false,
  );
  const loadPlanogramFromCloud = async (
    id: string,
    options: { signal?: AbortSignal; updateMetadata?: boolean } = {},
  ) => {
    const cached = openedPlanograms.current.get(id);
    if (cached) return cached;
    const existing = prefetchPlanogramLoads.current.get(id);
    if (existing) return existing;
    const load = (async () => {
      const planogramIndex = pogOptions.findIndex((item) => item.id === id),
        query = new URLSearchParams({ planogramId: id });
      if (planogramIndex >= 0) query.set("planogramIndex", String(planogramIndex));
      const response = await fetch(`/api/state?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
        signal: options.signal,
      });
      if (!response.ok) throw new Error("Unable to open POG");
      const result = await response.json();
      if (options.updateMetadata) {
        if (Array.isArray(result?.planogramSummaries))
          setPlanogramSummaries(
            result.planogramSummaries.filter(
              (item: Partial<PlanogramSummary>) => item.id && item.title,
            ) as PlanogramSummary[],
          );
        setPartialWorkspace(Boolean(result?.partialWorkspace));
      }
      if (result?.revision) cloudRevision.current = result.revision;
      if (!result?.state) return null;
      const loadedWorkspace = normalize(result.state),
        loadedPlan =
          loadedWorkspace.planograms.find((item) => item.id === id) ??
          loadedWorkspace.planograms.find((item) => item.id === loadedWorkspace.activeId) ??
          loadedWorkspace.planograms[0] ??
          null;
      rememberOpenedPlanogram(loadedPlan);
      warmPlanogramImages(loadedPlan);
      return loadedPlan;
    })().finally(() => {
      prefetchPlanogramLoads.current.delete(id);
    });
    prefetchPlanogramLoads.current.set(id, load);
    return load;
  };
  useEffect(() => {
    if (!resolvedSourcePogId || resolvedSourcePogId === sourcePogId) return;
    setSourcePogId(resolvedSourcePogId);
  }, [resolvedSourcePogId, sourcePogId]);
  useEffect(() => {
    if (
      !copyDrawerOpen ||
      !resolvedSourcePogId ||
      sourcePog ||
      sourcePogLoads.current.has(resolvedSourcePogId) ||
      failedSourcePogLoads.current.has(resolvedSourcePogId)
    )
      return;
    let cancelled = false;
    sourcePogLoads.current.add(resolvedSourcePogId);
    setSourcePogLoading(true);
    setCopyMessage("Loading source POG...");
    loadPlanogramFromCloud(resolvedSourcePogId, { updateMetadata: true })
      .then((loadedSource) => {
        if (cancelled) return;
        if (loadedSource) {
          failedSourcePogLoads.current.delete(loadedSource.id);
          setSourcePogCacheVersion((value) => value + 1);
          setCopyMessage("");
        }
      })
      .catch((error) => {
        failedSourcePogLoads.current.add(resolvedSourcePogId);
        if (!cancelled)
          setCopyMessage(error instanceof Error ? error.message : "Unable to load source POG.");
      })
      .finally(() => {
        sourcePogLoads.current.delete(resolvedSourcePogId);
        if (!cancelled) setSourcePogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    copyDrawerOpen,
    resolvedSourcePogId,
    sourcePog,
    pogOptions,
  ]);
  useEffect(() => {
    setSelectedPogProductIds([]);
    setBulkDimensions({ width: "", height: "", depth: "" });
  }, [plan.id]);
  const activeSection =
    plan.sections.find((section) => section.id === activeSectionId) ??
    plan.sections[0];
  const activeShelf =
    activeSection.shelves.find((shelf) => shelf.id === activeShelfId) ??
    activeSection.shelves.find((shelf) =>
      shelf.placements.some((placement) => placement.id === selectedPlacement),
    ) ?? activeSection.shelves[0];
  const activeShelfIndex = activeSection.shelves.findIndex(
      (shelf) => shelf.id === activeShelf?.id,
    ),
    activeShelfElevation =
      activeShelfIndex >= 0
        ? Math.round(
            (plan.fixtureHeight -
              activeSection.shelves
                .slice(0, activeShelfIndex + 1)
                .reduce((sum, shelf) => sum + shelf.height, 0) +
              1) *
              10,
          ) / 10
        : 1,
    activeShelfMinElevation =
      activeShelfIndex >= 0 && activeShelfIndex < activeSection.shelves.length - 1
        ? Math.max(
            1,
            activeShelfElevation -
              (activeSection.shelves[activeShelfIndex + 1].height - 1),
          )
        : activeShelfElevation,
    activeShelfMaxElevation = activeShelf
      ? Math.min(
          plan.fixtureHeight,
          activeShelfElevation + Math.max(0, activeShelf.height - 1),
        )
      : activeShelfElevation;
  const productById = useMemo(
    () => new Map(plan.products.map((item) => [item.id, item])),
    [plan.products],
  );
  const product = selected ? productById.get(selected) : undefined;
  const filtered = useMemo(
    () =>
      plan.products.filter((p) =>
        (p.name + p.brand + p.upc).toLowerCase().includes(query.toLowerCase()),
      ),
    [plan.products, query],
  );
  const renderedProducts = useMemo(
    () => filtered.slice(0, MAX_PRODUCT_LIBRARY_ROWS),
    [filtered],
  );
  const allShelves = useMemo(
    () => plan.sections.flatMap((section) => section.shelves),
    [plan.sections],
  );
  const facings = useMemo(
    () =>
      allShelves.reduce(
        (n, s) => n + s.placements.reduce((a, p) => a + p.facings, 0),
        0,
      ),
    [allShelves],
  );
  const capacity = useMemo(
    () =>
      allShelves.reduce(
        (total, shelf) =>
          total +
          shelf.placements.reduce((sum, placement) => {
            const item = productById.get(placement.productId);
            return (
              sum + placement.facings * Math.max(1, item?.unitsPerFacing ?? 1)
            );
          }, 0),
        0,
      ),
    [allShelves, productById],
  );
  const linearSpace = useMemo(() => {
    const shelves = plan.sections.flatMap((section) =>
      section.shelves.map((shelf, shelfIndex) => {
        const available = Math.max(0, shelf.width ?? section.width);
        const used = shelf.placements.reduce((sum, placement) => {
          const item = productById.get(placement.productId);
          return sum + (item ? productDisplaySize(item).width * placement.facings : 0);
        }, 0);
        const remaining = available - used;
        return {
          id: shelf.id,
          sectionId: section.id,
          sectionName: section.name,
          shelfName: shelf.name || `Shelf ${shelfIndex + 1}`,
          available,
          used,
          remaining,
          utilization: available > 0 ? (used / available) * 100 : 0,
        };
      }),
    );
    const sections = plan.sections.map((section) => {
      const sectionShelves = shelves.filter((shelf) => shelf.sectionId === section.id);
      const available = sectionShelves.reduce((sum, shelf) => sum + shelf.available, 0);
      const used = sectionShelves.reduce((sum, shelf) => sum + shelf.used, 0);
      return {
        id: section.id,
        name: section.name,
        shelves: sectionShelves.length,
        available,
        used,
        remaining: available - used,
        utilization: available > 0 ? (used / available) * 100 : 0,
      };
    });
    const available = shelves.reduce((sum, shelf) => sum + shelf.available, 0);
    const used = shelves.reduce((sum, shelf) => sum + shelf.used, 0);
    return {
      shelves,
      sections,
      available,
      used,
      remaining: available - used,
      utilization: available > 0 ? (used / available) * 100 : 0,
    };
  }, [plan.sections, productById]);
  const pogProductRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        product: Product;
        facings: number;
        capacity: number;
        linearInches: number;
        sections: Set<string>;
        shelves: Set<string>;
      }
    >();
    for (const section of plan.sections) {
      for (const shelf of section.shelves) {
        for (const placement of shelf.placements) {
          const product = productById.get(placement.productId);
          if (!product) continue;
          const current = rows.get(product.id) ?? {
            product,
            facings: 0,
            capacity: 0,
            linearInches: 0,
            sections: new Set<string>(),
            shelves: new Set<string>(),
          };
          current.facings += placement.facings;
          current.capacity +=
            placement.facings * Math.max(1, product.unitsPerFacing ?? 1);
          current.linearInches +=
            productDisplaySize(product).width * placement.facings;
          current.sections.add(section.name);
          current.shelves.add(`${section.name} / ${shelf.name}`);
          rows.set(product.id, current);
        }
      }
    }
    return [...rows.values()].sort((left, right) =>
      left.product.name.localeCompare(right.product.name),
    );
  }, [plan.sections, productById]);
  const spaceGroupOptions = useMemo(
    () => [
      { value: "category", label: "Category" },
      { value: "subcategory", label: "Subcategory" },
      { value: "manufacturer", label: "Manufacturer" },
      { value: "brand", label: "Brand" },
      ...(workspace.customProductColumns ?? []).map((column) => ({
        value: column,
        label: column,
      })),
    ],
    [workspace.customProductColumns],
  );
  const spaceMetricTotal = useMemo(
    () =>
      pogProductRows.reduce((sum, row) => {
        const value = Number(row.product.performance?.[spaceMetric]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [pogProductRows, spaceMetric],
  );
  const spaceProductsWithMetric = useMemo(
    () =>
      pogProductRows.filter((row) =>
        Number.isFinite(Number(row.product.performance?.[spaceMetric])),
      ).length,
    [pogProductRows, spaceMetric],
  );
  const pogProductQualityRows = useMemo(
    () =>
      pogProductRows.map((row) => {
        const issues: string[] = [];
        if (!row.product.upc?.trim()) issues.push("UPC");
        if (!row.product.brand?.trim()) issues.push("Brand");
        if (!row.product.manufacturer?.trim()) issues.push("Manufacturer");
        if (!row.product.category?.trim()) issues.push("Category");
        if (!row.product.subcategory?.trim()) issues.push("Subcategory");
        if (!(Number(row.product.width) > 0)) issues.push("Width");
        if (!(Number(row.product.height) > 0)) issues.push("Height");
        if (!(Number(row.product.depth) > 0)) issues.push("Depth");
        if (!Number.isFinite(Number(row.product.performance?.[spaceMetric]))) {
          issues.push(spaceMetric === "sales" ? "Dollar sales" : spaceMetric === "units" ? "Unit sales" : "Unit velocity");
        }
        return { ...row, issues };
      }),
    [pogProductRows, spaceMetric],
  );
  const pogProductIssueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of pogProductQualityRows)
      for (const issue of row.issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [pogProductQualityRows]);
  const visiblePogProductRows = useMemo(() => {
    const issueIds = new Set(
      pogProductQualityRows.filter((row) => row.issues.length).map((row) => row.product.id),
    );
    const normalizedQuery = pogProductQuery.trim().toLowerCase();
    const result = pogProductRows.filter((row) => {
      const hasIssues = issueIds.has(row.product.id);
      if (pogProductFilter === "missing" && !hasIssues) return false;
      if (pogProductFilter === "complete" && hasIssues) return false;
      if (!normalizedQuery) return true;
      return [
        row.product.name,
        row.product.upc,
        row.product.sku,
        row.product.brand,
        row.product.manufacturer,
        row.product.category,
        row.product.subcategory,
        ...Object.values(row.product.customFields ?? {}),
      ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
    });
    const metricIndex = (row: (typeof pogProductRows)[number]) => {
      const performance = Number(row.product.performance?.[spaceMetric]);
      const performanceShare = Number.isFinite(performance) && spaceMetricTotal > 0 ? performance / spaceMetricTotal : -1;
      const spaceShare = linearSpace.used > 0 ? row.linearInches / linearSpace.used : 0;
      return spaceShare > 0 ? performanceShare / spaceShare : -1;
    };
    return [...result].sort((left, right) => {
      if (pogProductSort === "linear") return right.linearInches - left.linearInches;
      if (pogProductSort === "sales") return Number(right.product.performance?.sales ?? -1) - Number(left.product.performance?.sales ?? -1);
      if (pogProductSort === "spaceIndex") return metricIndex(right) - metricIndex(left);
      if (pogProductSort === "manufacturer")
        return (left.product.manufacturer || "Unassigned").localeCompare(right.product.manufacturer || "Unassigned") || left.product.name.localeCompare(right.product.name);
      return left.product.name.localeCompare(right.product.name);
    });
  }, [linearSpace.used, pogProductFilter, pogProductQualityRows, pogProductQuery, pogProductRows, pogProductSort, spaceMetric, spaceMetricTotal]);
  const renderedPogProductRows = useMemo(
    () => visiblePogProductRows.slice(0, MAX_POG_PRODUCT_ROWS),
    [visiblePogProductRows],
  );
  const spaceHierarchy = useMemo(() => {
    const valueFor = (product: Product, field: SpaceGroupField) => {
      if (field === "category") return product.category?.trim() || "Unassigned";
      if (field === "subcategory") return product.subcategory?.trim() || "Unassigned";
      if (field === "manufacturer") return product.manufacturer?.trim() || "Unassigned";
      if (field === "brand") return product.brand?.trim() || "Unassigned";
      return product.customFields?.[field]?.trim() || "Unassigned";
    };
    const build = (
      rows: typeof pogProductRows,
      level: number,
      parentPath: string,
    ): SpaceHierarchyNode[] => {
      const field = spaceGroups[level];
      if (!field) return [];
      const grouped = new Map<string, typeof pogProductRows>();
      for (const row of rows) {
        const label = valueFor(row.product, field);
        grouped.set(label, [...(grouped.get(label) ?? []), row]);
      }
      return [...grouped.entries()]
        .map(([label, groupRows]) => {
          const path = `${parentPath}/${field}:${label}`;
          return {
            path,
            label,
            level,
            linearInches: groupRows.reduce((sum, row) => sum + row.linearInches, 0),
            performance: groupRows.reduce((sum, row) => {
              const value = Number(row.product.performance?.[spaceMetric]);
              return sum + (Number.isFinite(value) ? value : 0);
            }, 0),
            products: groupRows.length,
            children: build(groupRows, level + 1, path),
            productRows: level === spaceGroups.length - 1 ? groupRows : [],
          };
        })
        .sort((left, right) => right.linearInches - left.linearInches || left.label.localeCompare(right.label));
    };
    return build(pogProductRows, 0, "root");
  }, [pogProductRows, spaceGroups, spaceMetric]);
  const spaceHierarchyRows = useMemo(() => {
    const visible: SpaceHierarchyDisplayRow[] = [];
    const append = (nodes: SpaceHierarchyNode[]) => {
      for (const node of nodes) {
        visible.push({ kind: "group", node });
        if (!expandedSpaceGroups.includes(node.path)) continue;
        if (node.children.length) append(node.children);
        else
          for (const row of node.productRows)
            visible.push({ kind: "product", level: node.level + 1, row });
      }
    };
    append(spaceHierarchy);
    return visible;
  }, [expandedSpaceGroups, spaceHierarchy]);
  const maxPlacementFacings = Math.max(
    1,
    ...allShelves.flatMap((shelf) =>
      shelf.placements.map((placement) => placement.facings),
    ),
  );
  const maxPlacementCapacity = Math.max(
    1,
    ...allShelves.flatMap((shelf) =>
      shelf.placements.map((placement) => {
        const item = plan.products.find(
          (value) => value.id === placement.productId,
        );
        return placement.facings * Math.max(1, item?.unitsPerFacing ?? 1);
      }),
    ),
  );
  const performanceModes: ColorMode[] = [
    "sales",
    "units",
    "velocity",
    "profit",
    "growth",
  ];
  const activePerformanceMetric = performanceModes.includes(
    plan.colorMode ?? "none",
  )
    ? (plan.colorMode as keyof PerformanceData)
    : null;
  const performanceValues = activePerformanceMetric
    ? plan.products
        .map((item) => Number(item.performance?.[activePerformanceMetric]))
        .filter((value) => Number.isFinite(value))
    : [];
  const performanceMin = performanceValues.length
    ? Math.min(...performanceValues)
    : 0;
  const performanceMax = performanceValues.length
    ? Math.max(...performanceValues)
    : 0;
  const colorLabel = (item: Product, placement?: Placement) => {
    switch (plan.colorMode) {
      case "colorGroup":
        return item.colorGroup?.trim() || "Unassigned";
      case "manufacturer":
        return item.manufacturer?.trim() || "Unassigned";
      case "brand":
        return item.brand.trim() || "Unassigned";
      case "size":
        return item.width <= 3
          ? "Small (≤3 in)"
          : item.width <= 6
            ? "Medium (3–6 in)"
            : "Large (>6 in)";
      case "facings":
        return placement
          ? String(placement.facings) +
              " facing" +
              (placement.facings === 1 ? "" : "s")
          : "Facings";
      case "capacity": {
        const value = placement
          ? placement.facings * Math.max(1, item.unitsPerFacing ?? 1)
          : 0;
        return placement ? String(value) + " units" : "Capacity";
      }
      case "sales":
      case "units":
      case "velocity":
      case "profit":
      case "growth": {
        const value = item.performance?.[plan.colorMode];
        if (typeof value !== "number") return "No data";
        if (plan.colorMode === "sales" || plan.colorMode === "profit")
          return value.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          });
        if (plan.colorMode === "growth") return value.toFixed(1) + "%";
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      default:
        return "";
    }
  };
  const displayColor = (item: Product, placement?: Placement) => {
    if (plan.colorMode === "none") return "transparent";
    if (plan.colorMode === "facings" && placement) {
      const score = placement.facings / maxPlacementFacings;
      return score > 0.66 ? "#dc2626" : score > 0.33 ? "#f59e0b" : "#16a34a";
    }
    if (plan.colorMode === "capacity" && placement) {
      const score =
        (placement.facings * Math.max(1, item.unitsPerFacing ?? 1)) /
        maxPlacementCapacity;
      return score > 0.66 ? "#dc2626" : score > 0.33 ? "#f59e0b" : "#16a34a";
    }
    if (activePerformanceMetric) {
      const value = item.performance?.[activePerformanceMetric];
      if (typeof value !== "number" || !Number.isFinite(value))
        return "#94a3b8";
      const score =
        performanceMax === performanceMin
          ? 0.5
          : (value - performanceMin) / (performanceMax - performanceMin);
      return score >= 0.67 ? "#16a34a" : score >= 0.34 ? "#f59e0b" : "#dc2626";
    }
    const label = colorLabel(item, placement);
    return plan.customColors?.[label] ?? colorForText(label);
  };
  const showSolidColors =
    plan.colorMode !== "none" && plan.hideImagesForColor === true;
  const colorLegend = useMemo(() => {
    if (plan.colorMode === "none") return [];
    if (
      plan.colorMode === "facings" ||
      plan.colorMode === "capacity" ||
      performanceModes.includes(plan.colorMode ?? "none")
    )
      return [
        {
          label: "Low",
          color:
            plan.colorMode === "facings" || plan.colorMode === "capacity"
              ? "#16a34a"
              : "#dc2626",
        },
        { label: "Medium", color: "#f59e0b" },
        {
          label: "High",
          color:
            plan.colorMode === "facings" || plan.colorMode === "capacity"
              ? "#dc2626"
              : "#16a34a",
        },
        ...(performanceModes.includes(plan.colorMode ?? "none")
          ? [{ label: "No data", color: "#94a3b8" }]
          : []),
      ];
    const seen = new Map<string, string>();
    for (const item of plan.products) {
      const label = colorLabel(item);
      if (!seen.has(label))
        seen.set(label, plan.customColors?.[label] ?? colorForText(label));
    }
    return [...seen].map(([label, color]) => ({ label, color }));
  }, [plan.colorMode, plan.products, plan.customColors]);
  const selectedProductCapacity = product
    ? allShelves.reduce(
        (total, shelf) =>
          total +
          shelf.placements
            .filter((placement) => placement.productId === product.id)
            .reduce(
              (sum, placement) =>
                sum +
                placement.facings * Math.max(1, product.unitsPerFacing ?? 1),
              0,
            ),
        0,
      )
    : 0;
  const planVersions = useMemo(
    () =>
      (workspace.versions ?? [])
        .filter((version) => version.planogramId === plan.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [plan.id, workspace.versions],
  );
  const validationIssues = useMemo(() => {
    const issues: { level: "error" | "warning"; message: string }[] = [];
    const identifiers = new Map<string, number>();
    for (const item of plan.products) {
      if (!item.upc.trim() && !(item.sku ?? "").trim())
        issues.push({
          level: "error",
          message: item.name + " needs a UPC or SKU.",
        });
      if (!item.image)
        issues.push({
          level: "warning",
          message: item.name + " is missing an image.",
        });
      if (item.width <= 0 || item.height <= 0 || item.depth <= 0)
        issues.push({
          level: "error",
          message: item.name + " has invalid dimensions.",
        });
      const key =
        item.upc.replace(/\D/g, "") || (item.sku ?? "").trim().toLowerCase();
      if (key) identifiers.set(key, (identifiers.get(key) ?? 0) + 1);
    }
    for (const [identifier, count] of identifiers)
      if (count > 1)
        issues.push({
          level: "error",
          message:
            "Duplicate product identifier: " + identifier + " (" + count + ").",
        });
    for (const section of plan.sections)
      for (const shelf of section.shelves) {
        const shelfWidth = shelf.width ?? section.width;
        const used = shelf.placements.reduce((sum, placement) => {
          const item = plan.products.find(
            (value) => value.id === placement.productId,
          );
          return (
            sum +
            (item ? productDisplaySize(item).width * placement.facings : 0)
          );
        }, 0);
        if (used > shelfWidth + 0.01)
          issues.push({
            level: "error",
            message:
              section.name +
              " / " +
              shelf.name +
              " exceeds width by " +
              (used - shelfWidth).toFixed(1) +
              " in.",
          });
        for (const placement of shelf.placements) {
          const item = plan.products.find(
            (value) => value.id === placement.productId,
          );
          if (!item) continue;
          if (productDisplaySize(item).height > shelf.height)
            issues.push({
              level: "error",
              message: item.name + " is too tall for " + shelf.name + ".",
            });
          if (
            placement.facings < (item.minFacings ?? 1) ||
            placement.facings > (item.maxFacings ?? 8)
          )
            issues.push({
              level: "warning",
              message:
                item.name +
                " is outside its facing rules on " +
                shelf.name +
                ".",
            });
        }
      }
    return issues;
  }, [plan]);
  const validationScore = Math.max(
    0,
    100 -
      validationIssues.filter((issue) => issue.level === "error").length * 12 -
      validationIssues.filter((issue) => issue.level === "warning").length * 4,
  );

  const prepareCloudSnapshot = async (snapshot: Workspace) => {
    const keys: Record<string, string> = {};
    let changed = false;
    const preparePlanogram = async (item: Planogram) => {
      if (!item.sourcePsaText) return item;
      let key = keys[item.id] || item.sourcePsaKey;
      if (!key) {
        const response = await fetch("/api/psa", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              planogramId: item.id,
              sourceText: item.sourcePsaText,
            }),
          }),
          result = await response.json();
        if (!response.ok || !result?.key)
          throw new Error("Unable to retain PSA source");
        key = result.key;
      }
      keys[item.id] = key;
      changed = true;
      return { ...item, sourcePsaKey: key, sourcePsaText: "" };
    };
    const planograms: Planogram[] = [];
    for (const item of snapshot.planograms)
      planograms.push(await preparePlanogram(item));
    const versions: SavedVersion[] | undefined = snapshot.versions
      ? []
      : undefined;
    if (snapshot.versions && versions)
      for (const item of snapshot.versions) {
        const planogram = await preparePlanogram(item.planogram);
        versions.push(planogram === item.planogram ? item : { ...item, planogram });
      }
    const trash: DeletedPlanogram[] | undefined = snapshot.trash
      ? []
      : undefined;
    if (snapshot.trash && trash)
      for (const item of snapshot.trash) {
        const planogram = await preparePlanogram(item.planogram);
        trash.push(planogram === item.planogram ? item : { ...item, planogram });
      }
    return {
      compacted: changed
        ? { ...snapshot, planograms, versions, trash }
        : snapshot,
      keys,
    };
  };

  const prepareStateRequest = async (
    state: Workspace,
    baseRevision: number | null,
    force: boolean,
    activeOnly = false,
  ) => {
    const json = JSON.stringify(state),
      headers: Record<string, string> = {
        "content-type": "application/json",
        "x-planogram-state-payload": "workspace-json",
        "x-planogram-base-revision": baseRevision === null ? "" : String(baseRevision),
        "x-planogram-force": force ? "1" : "0",
        "x-planogram-active-only": activeOnly ? "1" : "0",
        "x-planogram-planogram-count": String(state.planograms.length),
        "x-planogram-summary-count": String(
          Math.max(planogramSummaries.length, state.planograms.length),
        ),
      };
    if (json.length < 500_000 || typeof CompressionStream === "undefined")
      return {
        body: json as BodyInit,
        headers,
      };
    const stream = new Blob([json])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
      body = await new Response(stream).arrayBuffer();
    return {
      body: body as BodyInit,
      headers: {
        ...headers,
        "content-type": "application/octet-stream",
        "x-planogram-compression": "gzip",
      },
    };
  };

  const performCloudSave = async (snapshot: Workspace, force = false) => {
    if (!loaded.current) throw new Error("Saved workspace has not loaded. Open recovery before saving.");
    if (conflictRef.current && !force) {
      setSaved("conflict");
      return "conflict" as const;
    }
    const prepared = await prepareCloudSnapshot(snapshot),
      request = await prepareStateRequest(
        prepared.compacted,
        cloudRevision.current,
        force,
        partialWorkspace,
      );
    const response = await fetch("/api/state", {
        method: "PUT",
        headers: request.headers,
        body: request.body,
        credentials: "include",
      }),
      result = await response.json().catch(() => null);
    if (response.status === 401)
      throw new Error("Cloud save needs sign-in. Use Save As POGX for a backup.");
    if (response.status === 413)
      throw new Error("This project is too large to save. Use Save As POGX while I reduce the cloud save size.");
    if (response.status === 409 && result?.state && result?.revision) {
      conflictRef.current = true;
      setCloudConflict({
        state: normalize(result.state),
        revision: result.revision,
      });
      setSaved("conflict");
      return "conflict" as const;
    }
    if (response.status === 409)
      throw new Error("A newer saved copy exists. Reload the workspace before saving again.");
    if (!response.ok || !result?.revision) throw new Error("Unable to save");
    cloudRevision.current = result.revision;
    const psaSources = { ...prepared.keys, ...(result?.psaSources ?? {}) };
    if (Object.keys(psaSources).length) {
      const applyPsaSources = (target: Planogram): Planogram => {
        const key = psaSources[target.id];
        return key
          ? { ...target, sourcePsaKey: key, sourcePsaText: "" }
          : target;
      };
      suppressNextCloudDirty.current = true;
      setWorkspaceState((current) => ({
        ...current,
        planograms: current.planograms.map(applyPsaSources),
        versions: (current.versions ?? []).map((version) => ({
          ...version,
          planogram: applyPsaSources(version.planogram),
        })),
        trash: (current.trash ?? []).map((deleted) => ({
          ...deleted,
          planogram: applyPsaSources(deleted.planogram),
        })),
      }));
    }
    return "saved" as const;
  };

  const clearSaveRetry = () => {
    if (saveRetryTimer.current !== null) {
      window.clearTimeout(saveRetryTimer.current);
      saveRetryTimer.current = null;
    }
  };

  const flushCloudSave = async () => {
    if (saveInFlight.current || conflictRef.current) return;
    const attempt = pendingCloudSave.current;
    if (!attempt) return;
    pendingCloudSave.current = null;
    saveInFlight.current = true;
    clearSaveRetry();
    setSaved(saveRetryCount.current ? "retrying" : "saving");
    let shouldContinue = false;
    try {
      const outcome = await performCloudSave(attempt.snapshot, attempt.force);
      if (outcome === "conflict") return;
      confirmedSaveSequence.current = attempt.sequence;
      saveRetryCount.current = 0;
      shouldContinue = Boolean(
        pendingCloudSave.current &&
          pendingCloudSave.current.sequence > confirmedSaveSequence.current,
      );
      setSaved(
        shouldContinue
          ? "saving"
          : cloudDirty.current
            ? "pending"
            : "saved",
      );
    } catch (error) {
      pendingCloudSave.current = {
        snapshot: latestWorkspace.current,
        force: attempt.force,
        sequence: ++saveSequence.current,
      };
      cloudDirty.current = false;
      saveRetryCount.current += 1;
      setSaved(saveRetryCount.current >= 5 ? "backup" : "retrying");
      setSaveMessage(
        error instanceof Error ? error.message : "Unable to save right now.",
      );
      const delay = Math.min(1500 * 2 ** (saveRetryCount.current - 1), 30000);
      saveRetryTimer.current = window.setTimeout(() => {
        saveRetryTimer.current = null;
        void flushCloudSave();
      }, delay);
    } finally {
      saveInFlight.current = false;
      if (shouldContinue)
        window.setTimeout(() => void flushCloudSave(), 0);
    }
  };

  const queueCloudSave = (snapshot: Workspace, force = false) => {
    if (conflictRef.current && !force) {
      setSaved("conflict");
      return;
    }
    const sequence = ++saveSequence.current;
    pendingCloudSave.current = { snapshot, force, sequence };
    cloudDirty.current = false;
    setSaved(saveRetryCount.current ? "retrying" : "saving");
    if (!saveInFlight.current && saveRetryTimer.current === null)
      window.setTimeout(() => void flushCloudSave(), 0);
  };

  const saveWorkspaceNow = async () => {
    if (!loaded.current) {
      setSaveMessage("Still loading your saved workspace.");
      return;
    }
    if (conflictRef.current) {
      setSaved("conflict");
      setSaveMessage("Choose which copy to keep before saving.");
      return;
    }
    if (saveInFlight.current) {
      pendingCloudSave.current = {
        snapshot: latestWorkspace.current,
        force: false,
        sequence: ++saveSequence.current,
      };
      setSaved("saving");
      setSaveMessage("Finishing the current save, then saving your latest change.");
      return;
    }
    clearSaveRetry();
    setManualSaveRunning(true);
    setSaved("saving");
    setSaveMessage("Saving now...");
    const sequence = ++saveSequence.current,
      snapshot = latestWorkspace.current;
    pendingCloudSave.current = null;
    saveInFlight.current = true;
    try {
      const outcome = await performCloudSave(snapshot);
      if (outcome === "conflict") return;
      confirmedSaveSequence.current = sequence;
      cloudDirty.current = false;
      saveRetryCount.current = 0;
      setSaved("saved");
      setSaveMessage(
        `Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
      );
    } catch (error) {
      pendingCloudSave.current = {
        snapshot: latestWorkspace.current,
        force: false,
        sequence: ++saveSequence.current,
      };
      cloudDirty.current = false;
      saveRetryCount.current = 0;
      setSaved("backup");
      setSaveMessage(
        error instanceof Error ? error.message : "Unable to save right now.",
      );
    } finally {
      saveInFlight.current = false;
      setManualSaveRunning(false);
      if (
        pendingCloudSave.current &&
        pendingCloudSave.current.sequence > confirmedSaveSequence.current
      )
        window.setTimeout(() => void flushCloudSave(), 0);
    }
  };

  const useCloudCopy = () => {
    if (!cloudConflict) return;
    cloudRevision.current = cloudConflict.revision;
    conflictRef.current = false;
    setWorkspaceState(cloudConflict.state);
    if (workspaceProductCount(cloudConflict.state) > MAX_LOCAL_RECOVERY_PRODUCTS)
      forgetLocalRecovery(recoveryStorageKey.current, true);
    else {
      try {
        window.localStorage.setItem(
          recoveryStorageKey.current,
          JSON.stringify(cloudConflict.state),
        );
      } catch {}
    }
    setCloudConflict(null);
    setSaved("saved");
  };

  const keepThisCopy = () => {
    if (!cloudConflict) return;
    cloudRevision.current = cloudConflict.revision;
    conflictRef.current = false;
    setCloudConflict(null);
    queueCloudSave(workspace, true);
  };

  useEffect(() => {
    let cancelled = false;
    setBootMessage("Checking access");
    fetch("/api/session", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((session: { authenticated?: boolean } & Partial<AppUser>) => {
        if (cancelled) return;
        if (session.authenticated && session.email) {
          applySignedInUser({
            email: session.email,
            displayName: session.displayName || session.email,
            isOwner: Boolean(session.isOwner),
            provider: session.provider === "chatgpt" ? "chatgpt" : "beta",
          });
        } else {
          setBooting(false);
          setAuth({ status: "signed-out" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBooting(false);
        setAuth({
          status: "signed-out",
          message: "Unable to check access. Try signing in again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth.status !== "signed-in") return;
    const startedAt = Date.now();
    let cancelled = false,
      revealTimer: number | null = null,
      signedOut = false;
    let loadSucceeded = false;
    loaded.current = false;
    setWorkspaceLoadFailed(false);
    const revealEditor = () => {
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      revealTimer = window.setTimeout(() => {
        if (!cancelled) setBooting(false);
      }, remaining);
    };
    setBootMessage("Checking your saved workspace");
    fetch("/api/state?active=1", { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          signedOut = true;
          setAuth({
            status: "signed-out",
            message: "Your session expired. Sign in again to open your workspace.",
          });
          setBooting(false);
          throw new Error("signed-out");
        }
        if (!r.ok) throw new Error("Saved workspace could not be loaded");
        return r.json();
      })
      .then((v) => {
        if (cancelled) return;
        if (!v || v.error || (v.state === null && !v.storageKey))
          throw new Error("Saved workspace is unavailable");
        loadSucceeded = true;
        cloudRevision.current = v?.revision ?? null;
        if (Array.isArray(v?.planogramSummaries))
          setPlanogramSummaries(
            v.planogramSummaries.filter(
              (item: Partial<PlanogramSummary>) => item.id && item.title,
            ) as PlanogramSummary[],
          );
        setPartialWorkspace(Boolean(v?.partialWorkspace));
        if (v?.storageKey)
          recoveryStorageKey.current = `planogram-studio-recovery-${v.storageKey}`;
        if (v?.state) {
          setBootMessage("Restoring saved POGs and product images");
          const cloud = normalize(v.state);
          if (v?.partialWorkspace || workspaceProductCount(cloud) > MAX_LOCAL_RECOVERY_PRODUCTS) {
            forgetLocalRecovery(
              recoveryStorageKey.current,
              Boolean(v?.migratedFromLegacy),
            );
            const activePlan = cloud.planograms.find((item) => item.id === cloud.activeId) ?? cloud.planograms[0];
            rememberOpenedPlanogram(activePlan);
            suppressNextCloudDirty.current = true;
            setWorkspace(cloud);
            setSaved("saved");
            return;
          }
          const local = window.localStorage.getItem(recoveryStorageKey.current) ||
            (v?.migratedFromLegacy
              ? window.localStorage.getItem("planogram-studio-recovery")
              : null);
          if (local) {
            setBootMessage("Comparing saved workspace with this device");
            const recovery = normalize(JSON.parse(local)),
              hasPendingPsa = recovery.planograms.some(
                (item) =>
                  !!item.sourcePsaText &&
                  !cloud.planograms.some((saved) => saved.id === item.id),
              );
            suppressNextCloudDirty.current = true;
            setWorkspace(
              hasPendingPsa
                ? restoreWorkspaceProductImages(recovery, [cloud])
                : restoreWorkspaceProductImages(cloud, [recovery]),
            );
            setSaved("saved");
          } else {
            suppressNextCloudDirty.current = true;
            setWorkspace(cloud);
            setSaved("saved");
          }
        } else {
          setBootMessage("Looking for a recovery copy on this device");
          const local = window.localStorage.getItem(recoveryStorageKey.current);
          if (local) {
            suppressNextCloudDirty.current = true;
            setWorkspace(normalize(JSON.parse(local)));
          }
          else setBootMessage("Preparing a new workspace");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        loadSucceeded = false;
        setWorkspaceLoadFailed(true);
        if (signedOut || error instanceof Error && error.message === "signed-out")
          return;
        setBootMessage("Opening your offline recovery copy");
        try {
          const local = window.localStorage.getItem(
            recoveryStorageKey.current,
          );
          if (local) {
            suppressNextCloudDirty.current = true;
            setWorkspace(normalize(JSON.parse(local)));
          }
        } catch {}
        setSaved("offline");
      })
      .finally(() => {
        if (cancelled || signedOut) return;
        loaded.current = loadSucceeded;
        setBootMessage("Workspace ready");
        revealEditor();
      });
    return () => {
      cancelled = true;
      if (revealTimer !== null) window.clearTimeout(revealTimer);
    };
  }, [auth.status, auth.status === "signed-in" ? auth.user.email : ""]);
  useEffect(() => {
    if (
      auth.status !== "signed-in" ||
      !partialWorkspace ||
      fullWorkspaceHydrated.current ||
      fullWorkspaceHydrationInFlight.current
    )
      return;
    let cancelled = false;
    fullWorkspaceHydrationInFlight.current = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/state", { credentials: "include", cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Unable to hydrate workspace");
          return response.json();
        })
        .then((result) => {
          if (cancelled || !result?.state) return;
          const hydrated = normalize(result.state);
          if (!hydrated.planograms.length) return;
          rememberWorkspacePlanograms(hydrated);
          if (Array.isArray(result?.planogramSummaries))
            setPlanogramSummaries(
              result.planogramSummaries.filter(
                (item: Partial<PlanogramSummary>) => item.id && item.title,
              ) as PlanogramSummary[],
            );
          if (result?.revision) cloudRevision.current = result.revision;
          const currentActiveId = latestWorkspace.current.activeId,
            activeExists = hydrated.planograms.some((item) => item.id === currentActiveId);
          fullWorkspaceHydrated.current = true;
          suppressNextCloudDirty.current = true;
          setWorkspace({
            ...hydrated,
            activeId: activeExists ? currentActiveId : hydrated.activeId,
          });
          hydrated.planograms.slice(0, 8).forEach(warmPlanogramImages);
        })
        .catch(() => {
          fullWorkspaceHydrated.current = false;
        })
        .finally(() => {
          fullWorkspaceHydrationInFlight.current = false;
        });
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      fullWorkspaceHydrationInFlight.current = false;
    };
  }, [
    auth.status,
    auth.status === "signed-in" ? auth.user.email : "",
    partialWorkspace,
  ]);
  useEffect(() => {
    if (
      auth.status !== "signed-in" ||
      !partialWorkspace ||
      fullWorkspaceHydrated.current ||
      planogramSummaries.length < 2
    )
      return;
    let cancelled = false,
      timer: number | null = null;
    const schedule = (delay: number) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), delay);
    };
    const run = async () => {
      if (cancelled) return;
      if (
        switchingPogId ||
        cloudDirty.current ||
        saveInFlight.current ||
        conflictRef.current ||
        copyDrawerOpen
      ) {
        schedule(3500);
        return;
      }
      const activeIndex = Math.max(
          0,
          planogramSummaries.findIndex((item) => item.id === workspace.activeId),
        ),
        candidates = [
          ...planogramSummaries.slice(activeIndex + 1),
          ...planogramSummaries.slice(0, activeIndex),
        ],
        next = candidates.find(
          (item) =>
            item.id !== workspace.activeId &&
            !openedPlanograms.current.has(item.id) &&
            !idlePrefetchedPlanograms.current.has(item.id),
        );
      if (!next) return;
      idlePrefetchedPlanograms.current.add(next.id);
      try {
        const loadedPlan = await loadPlanogramFromCloud(next.id);
        if (!loadedPlan) idlePrefetchedPlanograms.current.delete(next.id);
      } catch {
        idlePrefetchedPlanograms.current.delete(next.id);
      }
      if (!cancelled) schedule(9000);
    };
    schedule(3000);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    auth.status,
    auth.status === "signed-in" ? auth.user.email : "",
    copyDrawerOpen,
    partialWorkspace,
    planogramSummaries,
    switchingPogId,
    workspace.activeId,
  ]);
  useEffect(() => {
    setImageStatus("idle");
    setImageMessage("");
  }, [selected]);
  useEffect(() => {
    if (auth.status !== "signed-in") return;
    trackEvent("session", "app_opened", "success", {
      device: window.innerWidth < 760 ? "mobile" : "desktop",
    });
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest(
        ".app-ribbon button, .app-ribbon label, .workspace-switch button, .canvas-toolbar button, .project-meta summary, .color-rule-manager summary",
      ) as HTMLElement | null;
      if (!control) return;
      const action = (control.dataset.analyticsAction || control.getAttribute("aria-label") || control.getAttribute("title") || control.querySelector(".desktop-label")?.textContent || control.textContent || "control")
        .replace(/\s+/g, " ").trim().slice(0, 80);
      if (action) trackEvent("action", action);
    };
    const errorHandler = (event: ErrorEvent) =>
      trackEvent("error", "javascript_error", "error", { message: String(event.message || "Unknown error").slice(0, 180) });
    const rejectionHandler = (event: PromiseRejectionEvent) =>
      trackEvent("error", "unhandled_request", "error", { message: String(event.reason?.message || event.reason || "Unknown error").slice(0, 180) });
    document.addEventListener("click", clickHandler, true);
    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      document.removeEventListener("click", clickHandler, true);
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, [auth.status, auth.status === "signed-in" ? auth.user.email : ""]);
  useEffect(() => {
    if (auth.status !== "signed-in") return;
    trackEvent("navigation", `ribbon_${activeRibbonTab}`);
  }, [activeRibbonTab, auth.status]);
  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      trackEvent("search", filtered.length ? "product_search_results" : "product_search_no_results", filtered.length ? "success" : "friction");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [query, filtered.length]);
  useEffect(() => {
    if (saved === "offline") trackEvent("error", "cloud_save_unavailable", "error");
  }, [saved]);
  useEffect(() => {
    if (imageStatus === "error") trackEvent("error", "product_image_upload", "error");
  }, [imageStatus]);
  useEffect(() => {
    if (upcImageStatus === "error") trackEvent("error", "upc_image_lookup", "error");
  }, [upcImageStatus]);
  useEffect(() => {
    if (!loaded.current) return;
    latestWorkspace.current = workspace;
    const activePlan = workspace.planograms.find((item) => item.id === workspace.activeId);
    if (partialWorkspace && activePlan)
      rememberOpenedPlanogram(activePlan);
    if (recoverySaveTimer.current !== null) {
      window.clearTimeout(recoverySaveTimer.current);
      recoverySaveTimer.current = null;
    }
    if (workspaceProductCount(workspace) > MAX_LOCAL_RECOVERY_PRODUCTS) {
      try {
        window.localStorage.removeItem(recoveryStorageKey.current);
      } catch {}
    } else {
      const snapshot = workspace;
      recoverySaveTimer.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(
            recoveryStorageKey.current,
            JSON.stringify(snapshot),
          );
        } catch {}
        recoverySaveTimer.current = null;
      }, LOCAL_RECOVERY_DELAY_MS);
    }
    if (suppressNextCloudDirty.current) {
      suppressNextCloudDirty.current = false;
      return;
    }
    cloudDirty.current = true;
    setSaveMessage("");
    setSaved((current) =>
      conflictRef.current
        ? "conflict"
        : current === "retrying" || current === "backup"
          ? current
          : "pending",
    );
  }, [workspace]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!loaded.current || !cloudDirty.current || conflictRef.current) return;
      if (isLargeWorkspace(latestWorkspace.current)) {
        setSaved("pending");
        setSaveMessage("Large workspace ready. Use Save after important edits.");
        return;
      }
      queueCloudSave(latestWorkspace.current);
    }, 120000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const retry = () => {
      if (!loaded.current) return;
      saveRetryCount.current = 0;
      if (saveRetryTimer.current !== null) {
        window.clearTimeout(saveRetryTimer.current);
        saveRetryTimer.current = null;
      }
      if (isLargeWorkspace(workspace)) {
        setSaved("pending");
        setSaveMessage("Large workspace ready. Use Save after important edits.");
        return;
      }
      queueCloudSave(workspace);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [workspace]);
  useEffect(
    () => () => {
      if (saveRetryTimer.current !== null)
        window.clearTimeout(saveRetryTimer.current);
      if (recoverySaveTimer.current !== null)
        window.clearTimeout(recoverySaveTimer.current);
    },
    [],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saved === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!loaded.current) return;
      setWorkspace((current) => {
        const active = current.planograms.find(
          (item) => item.id === current.activeId,
        );
        if (!active) return current;
        const checkpoint: SavedVersion = {
          id: uid("auto-version"),
          planogramId: active.id,
          name: "Automatic checkpoint",
          createdAt: new Date().toISOString(),
          planogram: structuredClone(active),
          automatic: true,
        };
        const named = (current.versions ?? []).filter(
            (version) =>
              version.planogramId !== active.id || !version.automatic,
          ),
          automatic = [
            ...(current.versions ?? []).filter(
              (version) =>
                version.planogramId === active.id && version.automatic,
            ),
            checkpoint,
          ].slice(-10);
        return { ...current, versions: [...named, ...automatic] };
      });
    }, 300000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!plan.sections.some((section) => section.id === activeSectionId))
      setActiveSectionId(plan.sections[0]?.id ?? null);
  }, [activeSectionId, plan.id, plan.sections]);
  useEffect(() => {
    const shelfElements = Array.from(
      document.querySelectorAll<HTMLElement>(".shelf-space"),
    );
    shelfElements.forEach((element) => {
      const section = plan.sections.find(
          (value) => value.id === element.dataset.sectionId,
        ),
        shelf = section?.shelves.find(
          (value) => value.id === element.dataset.shelfId,
        );
      if (!section || !shelf) return;
      const usedWidth = shelf.placements.reduce((sum, placement) => {
          const item = plan.products.find(
            (value) => value.id === placement.productId,
          );
          return sum + (item?.width ?? 0) * placement.facings;
        }, 0),
        tooTall = shelf.placements.some(
          (placement) =>
            (plan.products.find((value) => value.id === placement.productId)
              ?.height ?? 0) > shelf.height,
        ),
        warnings = [
          usedWidth > (shelf.width ?? section.width)
            ? `Over width by ${(usedWidth - (shelf.width ?? section.width)).toFixed(1)}\"`
            : "",
          tooTall ? "Product too tall" : "",
        ].filter(Boolean);
      element.classList.toggle(
        "fit-warning",
        plan.showWarnings !== false && warnings.length > 0,
      );
      element.dataset.fitWarning = warnings.join(" · ");
      const nodes = Array.from(
        element.querySelectorAll<HTMLElement>(".placed-group"),
      );
      shelf.placements.forEach((placement, index) =>
        nodes[index]?.classList.toggle(
          "multi-selected",
          selectedPlacements.includes(placement.id),
        ),
      );
    });
  }, [plan, selectedPlacements]);
  useEffect(() => {
    if (!multiSelectMode) return;
    const selectMultiple = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".placement-tools")) return;
      const group = target.closest<HTMLElement>(".placed-group"),
        shelfElement = group?.closest<HTMLElement>(".shelf-space");
      if (!group || !shelfElement) return;
      const section = plan.sections.find(
          (value) => value.id === shelfElement.dataset.sectionId,
        ),
        shelf = section?.shelves.find(
          (value) => value.id === shelfElement.dataset.shelfId,
        ),
        index = Array.from(
          shelfElement.querySelectorAll(".placed-group"),
        ).indexOf(group),
        placement = shelf?.placements[index];
      if (!section || !placement) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const item = plan.products.find(
        (value) => value.id === placement.productId,
      );
      setSelected(item?.id ?? null);
      setActiveSectionId(section.id);
      setSelectedPlacements((current) => {
        const next = current.includes(placement.id)
          ? current.filter((id) => id !== placement.id)
          : [...current, placement.id];
        setSelectedPlacement(
          next.includes(placement.id) ? placement.id : (next.at(-1) ?? null),
        );
        return next;
      });
    };
    document.addEventListener("click", selectMultiple, true);
    return () => document.removeEventListener("click", selectMultiple, true);
  }, [multiSelectMode, plan]);

  const updatePlan = (fn: (p: Planogram) => Planogram) =>
    setWorkspace((w) => ({
      ...w,
      planograms: w.planograms.map((p) => (p.id === w.activeId ? fn(p) : p)),
    }));
  const setRuleColor = (label: string, color: string) =>
    updatePlan((p) => ({
      ...p,
      customColors: { ...(p.customColors ?? {}), [label]: color },
    }));
  const renameColorGroup = (oldLabel: string, newLabel: string) => {
    const clean = newLabel.trim();
    if (!clean || clean === oldLabel) return;
    updatePlan((p) => {
      const customColors = { ...(p.customColors ?? {}) };
      if (customColors[oldLabel]) {
        customColors[clean] = customColors[oldLabel];
        delete customColors[oldLabel];
      }
      return {
        ...p,
        customColors,
        products: p.products.map((item) =>
          (item.colorGroup?.trim() || "Unassigned") === oldLabel
            ? { ...item, colorGroup: clean }
            : item,
        ),
      };
    });
  };
  const saveColorTemplate = () => {
    const name = window.prompt("Name this color template")?.trim();
    if (!name) return;
    const template: ColorTemplate = {
      id: uid("color-template"),
      name,
      colors: { ...(plan.customColors ?? {}) },
    };
    setWorkspace((w) => ({
      ...w,
      colorTemplates: [...(w.colorTemplates ?? []), template],
    }));
    setColorTemplateChoice(template.id);
  };
  const applyColorTemplate = () => {
    const template = (workspace.colorTemplates ?? []).find(
      (item) => item.id === colorTemplateChoice,
    );
    if (!template) return;
    updatePlan((p) => ({ ...p, customColors: { ...template.colors } }));
  };
  const resetRuleColors = () => updatePlan((p) => ({ ...p, customColors: {} }));
  const undo = () => {
    setWorkspaceState((current) => {
      const previous = undoStack.current.pop();
      if (!previous) return current;
      redoStack.current = [...redoStack.current.slice(-49), current];
      return previous;
    });
    setSelectedPlacement(null);
  };
  const redo = () => {
    setWorkspaceState((current) => {
      const next = redoStack.current.pop();
      if (!next) return current;
      undoStack.current = [...undoStack.current.slice(-49), current];
      return next;
    });
    setSelectedPlacement(null);
  };
  const withTotalWidth = (
    p: Planogram,
    sections: FixtureSection[],
  ): Planogram => ({
    ...p,
    sections,
    fixtureWidth: sections.reduce((sum, section) => sum + section.width, 0),
  });

  const createPog = () => {
    const id = uid("pog"),
      sectionId = uid("section"),
      blank: Planogram = {
        id,
        title: `Planogram ${pogOptions.length + 1}`,
        fixtureWidth: 42,
        fixtureHeight: 72,
        products: structuredClone(plan.products),
        sections: [
          {
            id: sectionId,
            name: "Section 1",
            width: 42,
            shelves: blankShelves(42),
          },
        ],
        autoArrange: true,
        clientName: "",
        locationName: "",
        projectNotes: "",
      };
    setWorkspace((w) => ({
      ...w,
      activeId: id,
      planograms: [...w.planograms, blank],
    }));
    setPlanogramSummaries((current) => [
      ...current.filter((item) => item.id !== id),
      { id, title: blank.title, productCount: blank.products.length, sectionCount: blank.sections.length },
    ]);
    setSelected(blank.products[0]?.id ?? null);
    setActiveSectionId(sectionId);
    setSelectedPlacement(null);
    setVersionChoice("");
  };
  const duplicatePog = () => {
    const id = uid("pog");
    const copy: Planogram = {
      ...structuredClone(plan),
      id,
      title: `${plan.title} Copy`,
      sections: plan.sections.map((section) => ({
        ...structuredClone(section),
        id: uid("section"),
        shelves: section.shelves.map((shelf) => ({
          ...structuredClone(shelf),
          id: uid("shelf"),
          placements: shelf.placements.map((placement) => ({
            ...placement,
            id: uid("placement"),
          })),
        })),
      })),
    };
    setWorkspace((w) => ({
      ...w,
      activeId: id,
      planograms: [...w.planograms, copy],
    }));
    setPlanogramSummaries((current) => [
      ...current.filter((item) => item.id !== id),
      { id, title: copy.title, productCount: copy.products.length, sectionCount: copy.sections.length },
    ]);
    setActiveSectionId(copy.sections[0].id);
    setSelectedPlacement(null);
  };
  const deletePog = () => {
    if (pogOptions.length === 1) return;
    const remainingSummaries = pogOptions.filter((p) => p.id !== plan.id),
      remaining = workspace.planograms.filter((p) => p.id !== plan.id);
    if (!remaining.length) {
      void switchPog(remainingSummaries[0].id);
      setPlanogramSummaries(remainingSummaries);
      return;
    }
    setWorkspace((w) => ({
      ...w,
      activeId: remaining[0].id,
      planograms: remaining,
      trash: [
        ...(w.trash ?? []).filter((item) => item.planogram.id !== plan.id),
        {
          id: uid("deleted-pog"),
          deletedAt: new Date().toISOString(),
          planogram: structuredClone(plan),
        },
      ].slice(-20),
    }));
    setSelected(remaining[0].products[0]?.id ?? null);
    setActiveSectionId(remaining[0].sections[0]?.id ?? null);
    setSelectedPlacement(null);
    setVersionChoice("");
  };
  const restoreDeletedPog = (deletedId: string) => {
    const deleted = (workspace.trash ?? []).find(
      (item) => item.id === deletedId,
    );
    if (!deleted) return;
    const restored = normalizePlan(structuredClone(deleted.planogram)),
      existingIds = new Set(workspace.planograms.map((item) => item.id));
    if (existingIds.has(restored.id)) restored.id = uid("pog");
    setWorkspace((current) => ({
      ...current,
      activeId: restored.id,
      planograms: [...current.planograms, restored],
      trash: (current.trash ?? []).filter((item) => item.id !== deletedId),
    }));
    setPlanogramSummaries((current) => [
      ...current.filter((item) => item.id !== restored.id),
      { id: restored.id, title: restored.title, productCount: restored.products.length, sectionCount: restored.sections.length },
    ]);
    setSelected(restored.products[0]?.id ?? null);
    setActiveSectionId(restored.sections[0]?.id ?? null);
    setSelectedPlacement(null);
  };
  const switchPog = async (id: string) => {
    if (id === workspace.activeId || switchingPogId) return;
    setSwitchingPogId(id);
    try {
      if (cloudDirty.current) {
        setSaveMessage("Saving current POG before switching...");
        queueCloudSave(latestWorkspace.current);
        await flushCloudSave();
      }
      const cachedPlan = openedPlanograms.current.get(id);
      if (cachedPlan) {
        activateLocalPlanogram(cachedPlan);
        setSaveMessage("");
        return;
      }
      setBootMessage("Opening selected POG");
      const loadedPlan = await loadPlanogramFromCloud(id, { updateMetadata: true });
      if (loadedPlan) {
        activateLocalPlanogram(loadedPlan);
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Unable to open POG.");
    } finally {
      setSwitchingPogId("");
    }
    setSelectedPlacement(null);
    setVersionChoice("");
  };

  const addSection = () => {
    const id = uid("section"),
      source = activeSection ?? plan.sections[0],
      width = source?.width ?? 42,
      shelves = source
        ? source.shelves.map((shelf, index) => ({
            ...structuredClone(shelf),
            id: uid("shelf"),
            name: `Shelf ${index + 1}`,
            width: Math.min(shelf.width ?? width, width),
            placements: [],
          }))
        : blankShelves(width);
    updatePlan((p) =>
      withTotalWidth(p, [
        ...p.sections,
        { id, name: `Section ${p.sections.length + 1}`, width, shelves },
      ]),
    );
    setActiveSectionId(id);
    setSelectedPlacement(null);
  };
  const duplicateSection = () => {
    if (!activeSection) return;
    const copy: FixtureSection = {
      ...structuredClone(activeSection),
      id: uid("section"),
      name: `${activeSection.name} Copy`,
      shelves: activeSection.shelves.map((shelf) => ({
        ...structuredClone(shelf),
        id: uid("shelf"),
        placements: shelf.placements.map((placement) => ({
          ...placement,
          id: uid("placement"),
        })),
      })),
    };
    updatePlan((p) => {
      const index = p.sections.findIndex(
          (section) => section.id === activeSection.id,
        ),
        sections = [...p.sections];
      sections.splice(index + 1, 0, copy);
      return withTotalWidth(p, sections);
    });
    setActiveSectionId(copy.id);
    setSelectedPlacement(null);
    setSelectedPlacements([]);
  };
  const removeSection = () => {
    if (plan.sections.length === 1 || !activeSection) return;
    const remaining = plan.sections.filter(
      (section) => section.id !== activeSection.id,
    );
    updatePlan((p) => withTotalWidth(p, remaining));
    setActiveSectionId(remaining[0].id);
    setSelectedPlacement(null);
  };
  const updateSection = (sectionId: string, patch: Partial<FixtureSection>) =>
    updatePlan((p) =>
      withTotalWidth(
        p,
        p.sections.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      ),
    );
  const editSectionWidth = (value: number) => {
    if (!activeSection) return;
    const width = Math.max(1, Math.min(300, value || 1));
    updatePlan((p) =>
      withTotalWidth(
        p,
        p.sections.map((section) =>
          section.id === activeSection.id
            ? {
                ...section,
                width,
                shelves: section.shelves.map((shelf) => ({
                  ...shelf,
                  width: Math.min(shelf.width ?? section.width, width),
                })),
              }
            : section,
        ),
      ),
    );
  };
  const editAllSectionWidths = (value: number) => {
    const width = Math.max(1, Math.min(300, value || 1));
    updatePlan((p) =>
      withTotalWidth(
        p,
        p.sections.map((section) => ({
          ...section,
          width,
          shelves: section.shelves.map((shelf) => ({
            ...shelf,
            width:
              shelf.width == null || Math.abs(shelf.width - section.width) < 0.01
                ? width
                : Math.min(shelf.width, width),
          })),
        })),
      ),
    );
  };
  const editAllShelfLengths = (value: number) => {
    const width = Math.max(1, Math.min(300, value || 1));
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) => ({
        ...section,
        shelves: section.shelves.map((shelf) => ({
          ...shelf,
          width: Math.min(section.width, width),
          sourcePsaFixtureLine: undefined,
        })),
      })),
    }));
  };
  const editFixture = (key: "fixtureWidth" | "fixtureHeight", value: number) =>
    updatePlan((p) => {
      const next = Math.max(1, Math.min(600, value || 1));
      if (key === "fixtureHeight") return { ...p, fixtureHeight: next };
      const scale = next / Math.max(1, p.fixtureWidth),
        sections = p.sections.map((section) => {
          const width = Math.max(1, section.width * scale);
          return {
            ...section,
            width,
            shelves: section.shelves.map((shelf) => ({
              ...shelf,
              width: Math.min(width, (shelf.width ?? section.width) * scale),
            })),
          };
        });
      return withTotalWidth(p, sections);
    });

  const updateProductsAcrossPlanograms = (
    productIds: string[],
    updater: (product: Product) => Product,
  ) =>
    setWorkspace((current) => {
      const active = current.planograms.find((item) => item.id === current.activeId);
      if (!active) return current;
      const selectedSources = active.products.filter((item) => productIds.includes(item.id));
      if (!selectedSources.length) return current;
      return {
        ...current,
        planograms: current.planograms.map((target) => ({
          ...target,
          products: target.products.map((item) => {
            const source = target.id === active.id
              ? selectedSources.find((candidate) => candidate.id === item.id)
              : selectedSources.find((candidate) => hasReliableCatalogMatch(item, candidate));
            return source ? updater(item) : item;
          }),
        })),
      };
    });
  const updateProduct = (
    key: keyof Product,
    value: string | number | boolean,
  ) => {
    if (!selected) return;
    updateProductsAcrossPlanograms([selected], (item) => ({ ...item, [key]: value }));
  };
  const updatePogProductField = (
    productId: string,
    key: keyof Product,
    value: string | number,
  ) =>
    updateProductsAcrossPlanograms([productId], (item) => ({ ...item, [key]: value }));
  const updatePogCustomField = (
    productId: string,
    column: string,
    value: string,
  ) =>
    updateProductsAcrossPlanograms([productId], (item) => ({
      ...item,
      customFields: { ...(item.customFields ?? {}), [column]: value },
    }));
  const addCustomProductColumn = () => {
    const column = window.prompt("Name the new product column (for example, Segment or Better For You)")?.trim();
    if (!column) return;
    const reserved = ["category", "subcategory", "manufacturer", "brand"];
    if (
      [...reserved, ...(workspace.customProductColumns ?? [])].some(
        (item) => item.toLowerCase() === column.toLowerCase(),
      )
    ) {
      alert("That column already exists.");
      return;
    }
    setWorkspace((current) => ({
      ...current,
      customProductColumns: [...(current.customProductColumns ?? []), column],
    }));
  };
  const setSpaceGroupLevel = (level: number, value: string) => {
    setSpaceGroups((current) => {
      if (!value) return current.slice(0, level);
      const next = current.slice(0, Math.max(level + 1, current.length));
      next[level] = value;
      return next.filter((field, index) => field && next.indexOf(field) === index).slice(0, 3);
    });
    setExpandedSpaceGroups([]);
  };
  const saveAnalyticsView = () => {
    const name = window.prompt("Name this analytics view")?.trim();
    if (!name) return;
    const existing = (workspace.analyticsViews ?? []).find(
      (view) => view.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing && !window.confirm(`Replace the saved view “${existing.name}”?`)) return;
    const savedView: SavedAnalyticsView = {
      id: existing?.id ?? uid("analytics-view"),
      name,
      metric: spaceMetric,
      groups: spaceGroups.filter(Boolean).slice(0, 3),
    };
    setWorkspace((current) => ({
      ...current,
      analyticsViews: existing
        ? (current.analyticsViews ?? []).map((view) => view.id === existing.id ? savedView : view)
        : [...(current.analyticsViews ?? []), savedView],
    }));
    setSavedAnalyticsViewId(savedView.id);
  };
  const applyAnalyticsView = () => {
    const view = (workspace.analyticsViews ?? []).find((item) => item.id === savedAnalyticsViewId);
    if (!view) return;
    setSpaceMetric(view.metric);
    setSpaceGroups(view.groups);
    setExpandedSpaceGroups([]);
  };
  const deleteAnalyticsView = () => {
    const view = (workspace.analyticsViews ?? []).find((item) => item.id === savedAnalyticsViewId);
    if (!view || !window.confirm(`Delete the saved view “${view.name}”?`)) return;
    setWorkspace((current) => ({
      ...current,
      analyticsViews: (current.analyticsViews ?? []).filter((item) => item.id !== view.id),
    }));
    setSavedAnalyticsViewId("");
  };
  const openProductQualityIssue = (productId: string, productName: string) => {
    setPogProductFilter("missing");
    setPogProductQuery(productName);
    setEditingPogProducts(true);
    window.setTimeout(() => {
      document.getElementById(`pog-product-${productId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };
  const togglePogProductSelection = (productId: string) =>
    setSelectedPogProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  const toggleAllVisiblePogProducts = () => {
    const visibleIds = renderedPogProductRows.map((row) => row.product.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPogProductIds.includes(id));
    setSelectedPogProductIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };
  const applyBulkProductDimensions = () => {
    const updates = (Object.entries(bulkDimensions) as Array<["width" | "height" | "depth", string]>)
      .map(([field, value]) => [field, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0);
    if (!selectedPogProductIds.length || !updates.length) {
      alert("Select at least one product and enter a width, height or depth.");
      return;
    }
    updateProductsAcrossPlanograms(
      selectedPogProductIds,
      (item) => updates.reduce((next, [field, value]) => ({ ...next, [field]: value }), item),
    );
    setBulkDimensions({ width: "", height: "", depth: "" });
  };
  const syncPogFieldsToMasterLibrary = () => {
    const sources = pogProductRows.map((row) => row.product);
    if (!sources.length) return;
    let updated = 0,
      added = 0;
    setWorkspace((current) => ({
      ...current,
      planograms: current.planograms.map((target) => {
        if (target.id === plan.id) return target;
        const products = target.products.map((item) => ({ ...item }));
        for (const source of sources) {
          const index = products.findIndex((item) => sameCatalogProduct(item, source));
          if (index >= 0) {
            products[index] = syncAllProductFieldsExceptPerformance(products[index], source);
            updated++;
          } else {
            products.push({
              ...structuredClone(source),
              id: uid("product"),
              performance: {},
              sourcePsaId: undefined,
              sourcePsaLine: undefined,
            });
            added++;
          }
        }
        return { ...target, products };
      }),
    }));
    alert(
      `${sources.length} placed products synced to the master library. ${updated} matching records updated and ${added} added. Sales metrics were not changed.`,
    );
  };
  const syncProductToAllPlanograms = () => {
    if (!product) return;
    const upc = product.upc.replace(/\D/g, ""),
      sku = (product.sku ?? "").trim().toLowerCase();
    if (!upc && !sku) {
      alert("Add a UPC or SKU before syncing this product.");
      return;
    }
    let added = 0,
      updated = 0;
    setWorkspace((current) => ({
      ...current,
      planograms: current.planograms.map((target) => {
        if (target.id === plan.id) return target;
        const index = target.products.findIndex(
          (item) =>
            (!!upc && item.upc.replace(/\D/g, "") === upc) ||
            (!!sku && (item.sku ?? "").trim().toLowerCase() === sku),
        );
        if (index >= 0) {
          updated++;
          const products = [...target.products],
            existing = products[index];
          products[index] = syncAllProductFieldsExceptPerformance(existing, product);
          return { ...target, products };
        }
        added++;
        return {
          ...target,
          products: [
            ...target.products,
            { ...structuredClone(product), id: uid("product"), performance: {} },
          ],
        };
      }),
    }));
    alert(
      "Product library synced: " +
        updated +
        " updated, " +
        added +
        " added across other planograms.",
    );
  };
  const syncAllProductsToMasterLibrary = () => {
    const master: Product[] = [];
    for (const item of workspace.planograms.flatMap((target) => target.products)) {
      const index = master.findIndex((candidate) => sameCatalogProduct(candidate, item));
      if (index >= 0) master[index] = mergeCatalogProduct(master[index], item);
      else master.push(structuredClone(item));
    }
    setWorkspace((current) => ({
      ...current,
      planograms: current.planograms.map((target) => {
        const result = syncCatalogProducts(target, master);
        return result.planogram;
      }),
    }));
    alert(`${master.length.toLocaleString()} products are now synced in your master library and available in every planogram.`);
  };
  const autoCropMatchedImage = async (match: { id: string; image: string }) => {
    try {
      const response = await fetch(match.image);
      if (!response.ok) return match.image;
      const blob = await response.blob(),
        file = new File([blob], `matched-${match.id}.png`, { type: blob.type || "image/png" });
      return await storeProductImage(file, match.id);
    } catch {
      return match.image;
    }
  };
  const storeMatchedImageWithoutCrop = async (match: { id: string; image: string }) => {
    try {
      const response = await fetch(match.image);
      if (!response.ok) return match.image;
      const blob = await response.blob(),
        extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg",
        file = new File([blob], `matched-${match.id}.${extension}`, { type: blob.type || "image/jpeg" });
      return await storeProductImage(file, match.id, false);
    } catch {
      return match.image;
    }
  };
  const findProductImagesByUpc = async (improveExisting = false) => {
    if (upcLookupRunning.current) return;
    const master: Product[] = [];
    for (const item of workspace.planograms.flatMap((target) => target.products)) {
      const index = master.findIndex((candidate) => sameCatalogProduct(candidate, item));
      if (index >= 0) master[index] = mergeCatalogProduct(master[index], item);
      else master.push(structuredClone(item));
    }
    const candidates = master
      .filter(
        (item) =>
          (improveExisting
            ? Boolean(item.image) && (item.imageLookupVersion ?? 0) < 4
            : !item.image &&
              (!item.imageLookupCheckedAt || (item.imageLookupVersion ?? 0) < 3)) &&
          /\d{8,14}/.test(`${item.sku ?? ""} ${item.upc}`.replace(/\D/g, "")),
      )
      .slice(0, improveExisting ? 5 : 10);
    if (!candidates.length) {
      setUpcImageStatus("done");
      setUpcImageMessage(
        improveExisting
          ? "All current product images have been checked by the improved matcher."
          : master.some((item) => !item.image)
          ? "No unchecked UPCs remain. Products without matches can still use manual photo upload."
          : "Every product already has an image.",
      );
      return;
    }
    upcLookupRunning.current = true;
    setUpcImageStatus("searching");
    setUpcImageMessage(`Checking ${candidates.length} UPCs…`);
    try {
      const response = await fetch("/api/upc-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            products: candidates.map(({ id, upc, sku, name, brand }) => ({ id, upc, sku, name, brand })),
          }),
        }),
        result = (await response.json()) as {
          error?: string;
          matches?: Array<{
            id: string;
            image: string;
            sourceUrl: string;
            source?: string;
            qualityScore?: number;
          }>;
          missing?: string[];
      };
      if (!response.ok) throw new Error(result.error || "Unable to search UPCs.");
      for (const match of result.matches ?? [])
        match.image = await autoCropMatchedImage(match);
      const checkedAt = new Date().toISOString(),
        matches = new Map((result.matches ?? []).map((match) => [match.id, match])),
        checkedIds = new Set([
          ...(result.matches ?? []).map((match) => match.id),
          ...(result.missing ?? []),
        ]);
      setWorkspace((current) => ({
        ...current,
        planograms: current.planograms.map((target) => ({
          ...target,
          products: target.products.map((item) => {
            const source = candidates.find((candidate) =>
              sameCatalogProduct(candidate, item),
            );
            if (!source || !checkedIds.has(source.id)) return item;
            const match = matches.get(source.id);
            return {
              ...item,
              image: match?.image || item.image,
              imageSource: match?.source || item.imageSource,
              imageSourceUrl: match?.sourceUrl || item.imageSourceUrl,
              imageLookupCheckedAt: checkedAt,
              imageLookupVersion: improveExisting ? 4 : 3,
              imageQualityScore: match?.qualityScore ?? item.imageQualityScore,
              ...(match ? { imageRotation: 0, imageFlipped: false } : {}),
            };
          }),
        })),
      }));
      const found = matches.size;
      setUpcImageStatus("done");
      setUpcImageMessage(
        `${found} ${improveExisting ? "higher-quality image" : "image"}${found === 1 ? "" : "s"} ${improveExisting ? "updated" : "added"}. Click again to check the next UPCs.`,
      );
    } catch (error) {
      setUpcImageStatus("error");
      setUpcImageMessage(
        error instanceof Error ? error.message : "Unable to search UPCs.",
      );
    } finally {
      upcLookupRunning.current = false;
    }
  };
  const findNewerImageForProduct = async (item: Product) => {
    if (upcLookupRunning.current) return;
    if (!/\d{8,14}/.test(`${item.sku ?? ""} ${item.upc}`.replace(/\D/g, ""))) {
      setUpcImageStatus("error");
      setUpcImageMessage("Add a UPC or item ID before searching for a newer image.");
      return;
    }
    upcLookupRunning.current = true;
    setPendingImageMatch(null);
    setUpcImageStatus("searching");
    setUpcImageMessage(`Searching for a newer image for ${item.name}…`);
    try {
      const response = await fetch("/api/upc-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            products: [{ id: item.id, upc: item.upc, sku: item.sku, name: item.name, brand: item.brand }],
          }),
        }),
        result = (await response.json()) as {
          error?: string;
          matches?: Array<{
            id: string;
            image: string;
            sourceUrl: string;
            source?: string;
            qualityScore?: number;
          }>;
      };
      if (!response.ok) throw new Error(result.error || "Unable to search this UPC.");
      const match = result.matches?.[0];
      if (!match) {
        setUpcImageStatus("done");
        setUpcImageMessage("No newer image was found. Your current image was kept.");
        return;
      }
      match.image = await storeMatchedImageWithoutCrop(match);
      setPendingImageMatch({ product: item, ...match });
      setUpcImageStatus("done");
      setUpcImageMessage("Review the new image before replacing your current one.");
    } catch (error) {
      setUpcImageStatus("error");
      setUpcImageMessage(error instanceof Error ? error.message : "Unable to search this UPC.");
    } finally {
      upcLookupRunning.current = false;
    }
  };
  const acceptPendingImage = () => {
    if (!pendingImageMatch) return;
    const { product: item, ...match } = pendingImageMatch,
      checkedAt = new Date().toISOString();
      setWorkspace((current) => ({
        ...current,
        planograms: current.planograms.map((target) => ({
          ...target,
          products: target.products.map((candidate) =>
            sameCatalogProduct(candidate, item)
              ? {
                  ...candidate,
                  image: match.image,
                  imageSource: match.source,
                  imageSourceUrl: match.sourceUrl,
                  imageLookupCheckedAt: checkedAt,
                  imageLookupVersion: 4,
                  imageQualityScore: match.qualityScore,
                  imageRotation: 0,
                  imageFlipped: false,
                }
              : candidate,
          ),
        })),
      }));
      setUpcImageStatus("done");
      setUpcImageMessage("A refreshed image was found and saved to this product in your library.");
      setPendingImageMatch(null);
  };
  const restoreImagesFromSavedCopies = () => {
    let restoredCount = 0;
    setWorkspace((current) => {
      const before = new Map(
          current.planograms.flatMap((target) =>
            target.products.map((item) => [`${target.id}:${item.id}`, item.image ?? ""]),
          ),
        ),
        restored = restoreWorkspaceProductImages(current);
      restoredCount = restored.planograms.reduce(
        (total, target) =>
          total +
          target.products.filter(
            (item) =>
              !before.get(`${target.id}:${item.id}`) &&
              Boolean(item.image),
          ).length,
        0,
      );
      return restoredCount ? restored : current;
    });
    setUpcImageStatus("done");
    setUpcImageMessage(
      restoredCount
        ? `${restoredCount} product image${restoredCount === 1 ? "" : "s"} restored from saved POGs, checkpoints or backups.`
        : "No missing product images were found in saved POGs, checkpoints or backups.",
    );
  };
  useEffect(() => {
    if (!loaded.current || !autoUpcLookup || upcImageStatus === "searching")
      return;
    const hasUncheckedUpc = workspace.planograms.some((target) =>
      target.products.some(
        (item) =>
          !item.image &&
          (!item.imageLookupCheckedAt || (item.imageLookupVersion ?? 0) < 3) &&
          `${item.sku ?? ""}${item.upc}`.replace(/\D/g, "").length >= 8,
      ),
    );
    if (!hasUncheckedUpc) return;
    const timer = window.setTimeout(
      () => void findProductImagesByUpc(),
      upcImageStatus === "idle" ? 2000 : 65000,
    );
    return () => window.clearTimeout(timer);
  }, [autoUpcLookup, upcImageStatus, workspace]);
  const addProduct = () => {
    const id = uid("product"),
      item: Product = {
        id,
        name: "New product",
        brand: "",
        manufacturer: "",
        colorGroup: "",
        description: "",
        upc: "",
        sku: "",
        category: "",
        subcategory: "",
        price: 0,
        width: 4,
        height: 7,
        depth: 2,
        unitsPerFacing: 1,
        orientation: "front",
        merchStyle: "unit",
        minFacings: 1,
        recommendedFacings: 1,
        maxFacings: 8,
        color: colors[plan.products.length % colors.length],
      };
    updatePlan((p) => ({ ...p, products: [...p.products, item] }));
    setSelected(id);
  };
  const productMatchKey = (item: Product) =>
    item.upc.replace(/\D/g, "") ||
    (item.sku ?? "").trim().toLowerCase() ||
    item.name.trim().toLowerCase();
  const placeProductFromPog = (
    sourcePlan: Planogram,
    sourceProduct: Product,
    sourcePlacement?: Placement,
    targetSectionId = activeSection?.id,
    targetShelfId = activeShelf?.id,
    targetX?: number,
  ) => {
    if (!targetSectionId || !targetShelfId) {
      setCopyMessage("Select a target shelf first.");
      return;
    }
    const matchKey = productMatchKey(sourceProduct);
    let placedProductId = "";
    let placedShelfName = "the selected shelf";
    updatePlan((targetPlan) => {
      const targetSection = targetPlan.sections.find(
          (section) => section.id === targetSectionId,
        ),
        targetShelf = targetSection?.shelves.find(
          (shelf) => shelf.id === targetShelfId,
        );
      if (targetShelf) placedShelfName = targetShelf.name;
      const existing = targetPlan.products.find(
          (item) =>
            sameCatalogProduct(item, sourceProduct) ||
            productMatchKey(item) === matchKey,
        ),
        productId = existing?.id ?? uid("product"),
        copiedProduct: Product = existing
          ? mergeProductImageFields(existing, sourceProduct)
          : {
              ...structuredClone(sourceProduct),
              id: productId,
              sourcePsaId: undefined,
              sourcePsaLine: undefined,
            },
        placementId = uid("placement");
      placedProductId = productId;
      return {
        ...targetPlan,
        products: existing
          ? targetPlan.products.map((item) =>
              item.id === existing.id ? copiedProduct : item,
            )
          : [...targetPlan.products, copiedProduct],
        sections: targetPlan.sections.map((section) =>
          section.id === targetSectionId
            ? {
                ...section,
                shelves: section.shelves.map((shelf) =>
                  shelf.id === targetShelfId
                    ? {
                        ...shelf,
                        placements: [
                          ...shelf.placements,
                          {
                            id: placementId,
                            productId,
                            facings: sourcePlacement?.facings ?? 1,
                            x: targetX ??
                              Math.min(85, 6 + shelf.placements.length * 12),
                          },
                        ],
                      }
                    : shelf,
                ),
              }
            : section,
        ),
      };
    });
    setSelected(placedProductId);
    setSelectedPlacement(null);
    setCopyMessage(
      `${sourceProduct.name} copied from ${sourcePlan.title} to ${placedShelfName}.`,
    );
  };
  const copyProductFromPog = (
    sourcePlan: Planogram,
    sourceProduct: Product,
    sourcePlacement?: Placement,
  ) => placeProductFromPog(sourcePlan, sourceProduct, sourcePlacement);
  const removeProduct = () => {
    if (!selected) return;
    updatePlan((p) => ({
      ...p,
      products: p.products.filter((item) => item.id !== selected),
      sections: p.sections.map((section) => ({
        ...section,
        shelves: section.shelves.map((shelf) => ({
          ...shelf,
          placements: shelf.placements.filter(
            (placement) => placement.productId !== selected,
          ),
        })),
      })),
    }));
    setSelected(null);
    setSelectedPlacement(null);
  };

  const addShelf = () => {
    if (!activeSection) return;
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === activeSection.id
          ? {
              ...section,
              shelves: [
                ...section.shelves,
                {
                  id: uid("shelf"),
                  name: `Shelf ${section.shelves.length + 1}`,
                  height: 11,
                  width: section.width,
                  placements: [],
                },
              ],
            }
          : section,
      ),
    }));
  };
  const duplicateShelf = () => {
    if (!activeSection || !activeShelf) return;
    const copy: Shelf = {
      ...structuredClone(activeShelf),
      id: uid("shelf"),
      name: `${activeShelf.name} Copy`,
      placements: activeShelf.placements.map((placement) => ({
        ...placement,
        id: uid("placement"),
      })),
    };
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) => {
        if (section.id !== activeSection.id) return section;
        const index = section.shelves.findIndex(
            (shelf) => shelf.id === activeShelf.id,
          ),
          shelves = [...section.shelves];
        shelves.splice(index + 1, 0, copy);
        return { ...section, shelves };
      }),
    }));
    setSelectedPlacement(null);
    setSelectedPlacements([]);
  };
  const updateShelf = (
    sectionId: string,
    shelfId: string,
    patch: Partial<Shelf>,
  ) =>
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.map((shelf) =>
                shelf.id === shelfId ? { ...shelf, ...patch } : shelf,
              ),
            }
          : section,
      ),
    }));
  const arrangeShelfProducts = (
    mode: "pack" | "squeeze" | "expand" | "space",
  ) => {
    if (!activeShelf) return;
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) => {
        if (section.id !== activeSection.id) return section;
        return {
          ...section,
          shelves: section.shelves.map((shelf) => {
            if (shelf.id !== activeShelf.id || !shelf.placements.length) return shelf;
            const shelfWidth = shelf.width ?? section.width,
              productWidth = (placement: Placement) => {
                const item = p.products.find((product) => product.id === placement.productId);
                return item ? productDisplaySize(item).width : 0;
              },
              placements = shelf.placements
                .map((placement) => ({ ...placement }))
                .sort((a, b) => a.x - b.x);
            const used = () => placements.reduce(
              (sum, placement) => sum + productWidth(placement) * placement.facings,
              0,
            );
            if (mode === "squeeze") {
              let guard = 0;
              while (used() > shelfWidth + 0.01 && guard < 500) {
                const reducible = placements
                  .filter((placement) => {
                    const item = p.products.find((product) => product.id === placement.productId);
                    return placement.facings > (item?.minFacings ?? 1);
                  })
                  .sort((a, b) => b.facings - a.facings || b.x - a.x)[0];
                if (!reducible) break;
                reducible.facings -= 1;
                guard += 1;
              }
            }
            if (mode === "expand") {
              let changed = true,
                guard = 0;
              while (changed && guard < 500) {
                changed = false;
                for (const placement of placements) {
                  const item = p.products.find((product) => product.id === placement.productId),
                    width = productWidth(placement);
                  if (
                    item &&
                    placement.facings < (item.maxFacings ?? 8) &&
                    used() + width <= shelfWidth + 0.01
                  ) {
                    placement.facings += 1;
                    changed = true;
                  }
                }
                guard += 1;
              }
            }
            const totalWidth = used(),
              distribute = mode === "space" || mode === "expand",
              gap = distribute && placements.length > 1 && totalWidth < shelfWidth
                ? (shelfWidth - totalWidth) / (placements.length - 1)
                : 0;
            let cursor = 0;
            return {
              ...shelf,
              placements: placements.map((placement) => {
                const width = productWidth(placement) * placement.facings,
                  next = {
                    ...placement,
                    x: Math.max(0, Math.min(100, (cursor / Math.max(1, shelfWidth)) * 100)),
                  };
                cursor += width + gap;
                return next;
              }),
            };
          }),
        };
      }),
    }));
  };
  const moveShelfVertically = (sectionId: string, shelfId: string, delta: number) =>
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const index = section.shelves.findIndex((shelf) => shelf.id === shelfId);
        if (index < 0 || index === section.shelves.length - 1) return section;
        const shelves = section.shelves.map((shelf) => ({ ...shelf }));
        const current = shelves[index];
        const below = shelves[index + 1];
        const actual = Math.max(1 - current.height, Math.min(delta, below.height - 1));
        current.height = Math.round((current.height + actual) * 10) / 10;
        below.height = Math.round((below.height - actual) * 10) / 10;
        current.sourcePsaPositionY = undefined;
        below.sourcePsaPositionY = undefined;
        return { ...section, shelves };
      }),
    }));
  const setShelfElevation = (
    sectionId: string,
    shelfId: string,
    elevation: number,
  ) => {
    const section = plan.sections.find((value) => value.id === sectionId),
      index = section?.shelves.findIndex((shelf) => shelf.id === shelfId) ?? -1;
    if (!section || index < 0 || index === section.shelves.length - 1) return;
    const currentElevation =
      plan.fixtureHeight -
      section.shelves
        .slice(0, index + 1)
        .reduce((sum, shelf) => sum + shelf.height, 0) +
      1;
    moveShelfVertically(sectionId, shelfId, currentElevation - elevation);
  };
  const startShelfMove = (
    event: React.PointerEvent<HTMLDivElement>,
    sectionId: string,
    shelfId: string,
  ) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const section = plan.sections.find((value) => value.id === sectionId),
      index = section?.shelves.findIndex((shelf) => shelf.id === shelfId) ?? -1;
    if (!section || index < 0 || index === section.shelves.length - 1) return;

    event.preventDefault();
    event.stopPropagation();
    setActiveSectionId(sectionId);
    setActiveShelfId(shelfId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startY = event.clientY,
      currentHeight = section.shelves[index].height,
      belowHeight = section.shelves[index + 1].height,
      shelvesElement = event.currentTarget.closest<HTMLElement>(".shelves"),
      pixelsPerInch = Math.max(
        1,
        (shelvesElement?.getBoundingClientRect().height ?? plan.fixtureHeight) /
          plan.fixtureHeight,
      );

    const move = (pointerEvent: PointerEvent) => {
      const requested = (pointerEvent.clientY - startY) / pixelsPerInch,
        actual = Math.max(
          1 - currentHeight,
          Math.min(requested, belowHeight - 1),
        );
      updatePlan((p) => ({
        ...p,
        sections: p.sections.map((candidate) =>
          candidate.id !== sectionId
            ? candidate
            : {
                ...candidate,
                shelves: candidate.shelves.map((shelf, shelfIndex) => {
                  if (shelfIndex === index)
                    return {
                      ...shelf,
                      height: Math.round((currentHeight + actual) * 10) / 10,
                      sourcePsaPositionY: undefined,
                    };
                  if (shelfIndex === index + 1)
                    return {
                      ...shelf,
                      height: Math.round((belowHeight - actual) * 10) / 10,
                      sourcePsaPositionY: undefined,
                    };
                  return shelf;
                }),
              },
        ),
      }));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.classList.remove("shelf-drag-active");
    };
    document.body.classList.add("shelf-drag-active");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };
  const distributeShelvesEvenly = () => {
    if (!activeSection?.shelves.length) return;
    const opening = Math.max(
      1,
      Math.round((plan.fixtureHeight / activeSection.shelves.length) * 10) / 10,
    );
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === activeSection.id
          ? {
              ...section,
              shelves: section.shelves.map((shelf) => ({
                ...shelf,
                height: opening,
                sourcePsaPositionY: undefined,
              })),
            }
          : section,
      ),
    }));
  };
  const removeShelf = (sectionId: string, shelfId: string) =>
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.filter((shelf) => shelf.id !== shelfId),
            }
          : section,
      ),
    }));

  const dropProduct = (
    e: React.DragEvent<HTMLDivElement>,
    sectionId: string,
    shelfId: string,
  ) => {
    e.preventDefault();
    const sourcePayload = e.dataTransfer.getData("sourcePogProduct");
    const rect = e.currentTarget.getBoundingClientRect(),
      x = Math.max(
        0,
        Math.min(92, ((e.clientX - rect.left) / rect.width) * 100),
      );
    if (sourcePayload) {
      try {
        const parsed = JSON.parse(sourcePayload) as {
          planogramId?: string;
          productId?: string;
          placementId?: string;
        };
        const sourcePlan = parsed.planogramId
            ? openedPlanograms.current.get(parsed.planogramId) ??
              workspace.planograms.find((item) => item.id === parsed.planogramId)
            : undefined,
          sourceProduct = sourcePlan?.products.find(
            (item) => item.id === parsed.productId,
          ),
          sourcePlacement = sourcePlan?.sections
            .flatMap((section) => section.shelves)
            .flatMap((shelf) => shelf.placements)
            .find((placement) => placement.id === parsed.placementId);
        if (sourcePlan && sourceProduct) {
          placeProductFromPog(
            sourcePlan,
            sourceProduct,
            sourcePlacement,
            sectionId,
            shelfId,
            x,
          );
          setActiveSectionId(sectionId);
          setActiveShelfId(shelfId);
          return;
        }
      } catch {}
    }
    const productId = e.dataTransfer.getData("productId");
    if (!productId) return;
    const id = uid("placement");
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.map((shelf) =>
                shelf.id === shelfId
                  ? {
                      ...shelf,
                      placements: [
                        ...shelf.placements,
                        { id, productId, x, facings: 1 },
                      ],
                    }
                  : shelf,
              ),
            }
          : section,
      ),
    }));
    setActiveSectionId(sectionId);
    setSelectedPlacement(id);
  };
  const tapPlace = (sectionId: string, shelfId: string) => {
    if (
      !selected ||
      typeof window === "undefined" ||
      !window.matchMedia("(max-width:760px)").matches
    )
      return;
    setActiveSectionId(sectionId);
    if (selectedPlacement) {
      updatePlan((p) => {
        let moving: Placement | undefined,
          currentSection = "",
          currentShelf = "";
        for (const section of p.sections)
          for (const shelf of section.shelves) {
            const found = shelf.placements.find(
              (placement) => placement.id === selectedPlacement,
            );
            if (found) {
              moving = found;
              currentSection = section.id;
              currentShelf = shelf.id;
            }
          }
        if (
          !moving ||
          (currentSection === sectionId && currentShelf === shelfId)
        )
          return p;
        return {
          ...p,
          sections: p.sections.map((section) => ({
            ...section,
            shelves: section.shelves.map((shelf) => ({
              ...shelf,
              placements: [
                ...shelf.placements.filter(
                  (placement) => placement.id !== selectedPlacement,
                ),
                ...(section.id === sectionId && shelf.id === shelfId
                  ? [
                      {
                        ...moving!,
                        x: Math.min(85, 8 + shelf.placements.length * 12),
                      },
                    ]
                  : []),
              ],
            })),
          })),
        };
      });
      return;
    }
    const id = uid("placement");
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.map((shelf) =>
                shelf.id === shelfId
                  ? {
                      ...shelf,
                      placements: [
                        ...shelf.placements,
                        {
                          id,
                          productId: selected,
                          x: Math.min(85, 6 + shelf.placements.length * 14),
                          facings: 1,
                        },
                      ],
                    }
                  : shelf,
              ),
            }
          : section,
      ),
    }));
    setSelectedPlacement(id);
  };
  const editPlacement = (
    sectionId: string,
    shelfId: string,
    id: string,
    fn: (placement: Placement) => Placement,
  ) =>
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.map((shelf) =>
                shelf.id === shelfId
                  ? {
                      ...shelf,
                      placements: shelf.placements.map((placement) =>
                        placement.id === id ? fn(placement) : placement,
                      ),
                    }
                  : shelf,
              ),
            }
          : section,
      ),
    }));
  const removePlacement = (sectionId: string, shelfId: string, id: string) =>
    updatePlan((p) => ({
      ...p,
      sections: p.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              shelves: section.shelves.map((shelf) =>
                shelf.id === shelfId
                  ? {
                      ...shelf,
                      placements: shelf.placements.filter(
                        (placement) => placement.id !== id,
                      ),
                    }
                  : shelf,
              ),
            }
          : section,
      ),
    }));
  function arrangePlacements(
    p: Planogram,
    section: FixtureSection,
    shelf: Shelf,
    placements: Placement[],
    movingId: string,
    desiredX: number,
  ) {
    if (p.autoArrange === false)
      return placements.map((placement) =>
        placement.id === movingId ? { ...placement, x: desiredX } : placement,
      );
    const shelfWidth = shelf.width ?? section.width,
      entries = placements
        .map((placement) => {
          const item = p.products.find(
              (product) => product.id === placement.productId,
            ),
            displaySize = item
              ? productDisplaySize(item)
              : { width: 1, height: 1 },
            width = Math.min(
              96,
              (displaySize.width / Math.max(1, shelfWidth)) *
                100 *
                placement.facings,
            ),
            target = placement.id === movingId ? desiredX : placement.x;
          return { placement, width, target };
        })
        .sort((a, b) => a.target + a.width / 2 - (b.target + b.width / 2)),
      totalWidth = entries.reduce((sum, entry) => sum + entry.width, 0),
      gap =
        entries.length > 1
          ? Math.max(
              0,
              Math.min(1.5, (100 - totalWidth) / (entries.length - 1)),
            )
          : 0,
      movingIndex = Math.max(
        0,
        entries.findIndex((entry) => entry.placement.id === movingId),
      ),
      widthBefore =
        entries
          .slice(0, movingIndex)
          .reduce((sum, entry) => sum + entry.width, 0) +
        movingIndex * gap,
      total = Math.min(100, totalWidth + Math.max(0, entries.length - 1) * gap);
    let cursor = Math.max(0, Math.min(100 - total, desiredX - widthBefore));
    return entries.map((entry) => {
      const value = {
        ...entry.placement,
        x: Math.max(0, Math.min(100 - entry.width, cursor)),
      };
      cursor += entry.width + gap;
      return value;
    });
  }
  const startMove = (
    e: React.PointerEvent<HTMLDivElement>,
    sectionId: string,
    shelfId: string,
    placementId: string,
    x: number,
    productId: string,
  ) => {
    if (panMode) return;
    if ((e.target as HTMLElement).closest(".placement-tools")) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const placementIds = selectedPlacements.includes(placementId)
        ? selectedPlacements
        : [placementId],
      elements =
        placementIds.length > 1
          ? Array.from(
              document.querySelectorAll<HTMLDivElement>(
                ".placed-group.multi-selected",
              ),
            )
          : [e.currentTarget];
    elements.forEach((element) => {
      element.classList.add("dragging");
      element.style.willChange = "transform";
    });
    const dropZones = Array.from(
      document.querySelectorAll<HTMLElement>(".shelf-space"),
    )
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        sectionId: element.dataset.sectionId ?? "",
        shelfId: element.dataset.shelfId ?? "",
      }))
      .filter((zone) => zone.sectionId && zone.shelfId && zone.rect.height > 0);
    document.body.classList.add("product-drag-active");
    dragRef.current = {
      sectionId,
      shelfId,
      placementId,
      placementIds,
      productId,
      element: e.currentTarget,
      elements,
      startClientX: e.clientX,
      startClientY: e.clientY,
      grabFraction: Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      ),
      targetSectionId: sectionId,
      targetShelfId: shelfId,
      targetX: x,
      highlighted: null,
      dropZones,
      previewed: [],
      moved: false,
    };
    if (!selectedPlacements.includes(placementId))
      setSelectedPlacements([placementId]);
    setSelected(productId);
    setSelectedPlacement(placementId);
    setActiveSectionId(sectionId);
  };
  const moveProduct = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    const dx = e.clientX - drag.startClientX,
      dy = e.clientY - drag.startClientY;
    drag.elements.forEach((element) => {
      element.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    });
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    const targetZone = drag.dropZones
      .map((zone) => {
        const padding = 14,
          dx = Math.max(
            zone.rect.left - padding - e.clientX,
            0,
            e.clientX - (zone.rect.right + padding),
          ),
          dy = Math.max(
            zone.rect.top - padding - e.clientY,
            0,
            e.clientY - (zone.rect.bottom + padding),
          );
        return {
          zone,
          distance:
            dx === 0 && dy === 0
              ? Math.abs(e.clientY - (zone.rect.top + zone.rect.bottom) / 2)
              : Number.POSITIVE_INFINITY,
        };
      })
      .filter((candidate) => Number.isFinite(candidate.distance))
      .sort((a, b) => a.distance - b.distance)[0]?.zone;
    if (!targetZone) {
      drag.highlighted?.classList.remove("drag-over");
      drag.highlighted = null;
      return;
    }
    const target = targetZone.element,
      targetSectionId = targetZone.sectionId,
      targetShelfId = targetZone.shelfId;
    if (drag.highlighted !== target) {
      drag.highlighted?.classList.remove("drag-over");
      target.classList.add("drag-over");
      drag.highlighted = target;
    }
    const section = plan.sections.find((value) => value.id === targetSectionId),
      shelf = section?.shelves.find((value) => value.id === targetShelfId),
      placement = plan.sections
        .flatMap((value) => value.shelves.flatMap((item) => item.placements))
        .find((value) => value.id === drag.placementId),
      item = plan.products.find((value) => value.id === drag.productId);
    if (!section || !shelf || !placement || !item) return;
    const displaySize = productDisplaySize(item),
      rect = targetZone.rect,
      shelfWidth = shelf.width ?? section.width,
      groupWidth = Math.min(
        96,
        (displaySize.width / shelfWidth) * 100 * placement.facings,
      ),
      pointerX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    drag.targetSectionId = targetSectionId;
    drag.targetShelfId = targetShelfId;
    drag.targetX = Math.max(
      0,
      Math.min(100 - groupWidth, pointerX - drag.grabFraction * groupWidth),
    );
    drag.previewed.forEach((node) => {
      node.style.transform = "";
      node.classList.remove("reflow-preview");
    });
    drag.previewed = [];
    const arranged = arrangePlacements(
        plan,
        section,
        shelf,
        [
          ...shelf.placements.filter(
            (value) => !drag.placementIds.includes(value.id),
          ),
          placement,
        ],
        drag.placementId,
        drag.targetX,
      ),
      nodes = Array.from(target.querySelectorAll<HTMLElement>(".placed-group"));
    shelf.placements.forEach((current, index) => {
      const node = nodes[index],
        next = arranged.find((value) => value.id === current.id),
        currentItem = plan.products.find(
          (value) => value.id === current.productId,
        );
      if (
        !node ||
        drag.elements.includes(node as HTMLDivElement) ||
        !next ||
        !currentItem
      )
        return;
      const currentDisplaySize = productDisplaySize(currentItem),
        width = Math.min(
          96,
          (currentDisplaySize.width / shelfWidth) * 100 * current.facings,
        ),
        currentX = Math.min(current.x, 100 - width),
        shift = ((next.x - currentX) / 100) * rect.width;
      node.style.transform = `translate3d(${shift}px,0,0)`;
      node.classList.add("reflow-preview");
      drag.previewed.push(node);
    });
  };
  const finishMove = (
    e: React.PointerEvent<HTMLDivElement>,
    commit: boolean,
  ) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.elements.forEach((element) => {
      element.style.transform = "";
      element.style.willChange = "";
      element.classList.remove("dragging");
    });
    drag.highlighted?.classList.remove("drag-over");
    drag.previewed.forEach((node) => {
      node.style.transform = "";
      node.classList.remove("reflow-preview");
    });
    document.body.classList.remove("product-drag-active");
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (!commit || !drag.moved) return;
    setWorkspace((w) => ({
      ...w,
      planograms: w.planograms.map((p) => {
        if (p.id !== w.activeId) return p;
        const movings = p.sections
            .flatMap((section) =>
              section.shelves.flatMap((shelf) => shelf.placements),
            )
            .filter((placement) => drag.placementIds.includes(placement.id)),
          primary = movings.find(
            (placement) => placement.id === drag.placementId,
          );
        if (!primary) return p;
        const sections = p.sections.map((section) => ({
          ...section,
          shelves: section.shelves.map((shelf) => ({
            ...shelf,
            placements: shelf.placements.filter(
              (placement) => !drag.placementIds.includes(placement.id),
            ),
          })),
        }));
        return {
          ...p,
          sections: sections.map((section) => ({
            ...section,
            shelves: section.shelves.map((shelf) => {
              if (
                section.id !== drag.targetSectionId ||
                shelf.id !== drag.targetShelfId
              )
                return shelf;
              const incoming = movings.map((moving) => ({
                  ...moving,
                  x: Math.max(
                    0,
                    Math.min(96, drag.targetX + (moving.x - primary.x)),
                  ),
                })),
                combined = [...shelf.placements, ...incoming];
              return {
                ...shelf,
                placements:
                  p.autoArrange === false
                    ? combined
                    : arrangePlacements(
                        p,
                        section,
                        shelf,
                        combined,
                        primary.id,
                        drag.targetX,
                      ),
              };
            }),
          })),
        };
      }),
    }));
    setActiveSectionId(drag.targetSectionId);
  };
  const endMove = (e: React.PointerEvent<HTMLDivElement>) =>
    finishMove(e, e.type !== "pointercancel");

  const movePlacementWithKeyboard = (
    e: React.KeyboardEvent<HTMLDivElement>,
    sectionId: string,
    shelfId: string,
    placement: Placement,
  ) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removePlacement(sectionId, shelfId, placement.id);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      editPlacement(sectionId, shelfId, placement.id, (value) => ({
        ...value,
        x: Math.max(
          0,
          Math.min(96, value.x + (e.key === "ArrowLeft" ? -step : step)),
        ),
      }));
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const shelves = plan.sections.flatMap((section) =>
        section.shelves.map((shelf) => ({ section, shelf })),
      ),
      currentIndex = shelves.findIndex(
        ({ section, shelf }) =>
          section.id === sectionId && shelf.id === shelfId,
      ),
      target = shelves[currentIndex + (e.key === "ArrowUp" ? -1 : 1)];
    if (!target) return;
    updatePlan((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        shelves: section.shelves.map((shelf) => {
          if (section.id === sectionId && shelf.id === shelfId)
            return {
              ...shelf,
              placements: shelf.placements.filter(
                (item) => item.id !== placement.id,
              ),
            };
          if (section.id === target.section.id && shelf.id === target.shelf.id)
            return { ...shelf, placements: [...shelf.placements, placement] };
          return shelf;
        }),
      })),
    }));
    setActiveSectionId(target.section.id);
  };

  const prepareImage = async (file: File) => {
    if (file.size > 20_000_000) throw new Error("Photo must be under 20 MB.");
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
    try {
      const bitmap = await createImageBitmap(file),
        maximum = 800,
        scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
      const scan = document.createElement("canvas");
      scan.width = Math.max(1, Math.round(bitmap.width * scale));
      scan.height = Math.max(1, Math.round(bitmap.height * scale));
      const scanContext = scan.getContext("2d", { willReadFrequently: true });
      scanContext?.drawImage(bitmap, 0, 0, scan.width, scan.height);
      const pixels = scanContext?.getImageData(0, 0, scan.width, scan.height).data;
      let left = scan.width,
        top = scan.height,
        right = -1,
        bottom = -1;
      if (pixels) {
        for (let y = 0; y < scan.height; y += 1) {
          for (let x = 0; x < scan.width; x += 1) {
            const offset = (y * scan.width + x) * 4,
              alpha = pixels[offset + 3],
              nearWhite = pixels[offset] > 246 && pixels[offset + 1] > 246 && pixels[offset + 2] > 246;
            if (alpha < 18 || nearWhite) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      const foundProduct = right >= left && bottom >= top;
      if (foundProduct) {
        const margin = Math.max(4, Math.round(Math.max(right - left, bottom - top) * 0.035));
        left = Math.max(0, left - margin);
        top = Math.max(0, top - margin);
        right = Math.min(scan.width - 1, right + margin);
        bottom = Math.min(scan.height - 1, bottom + margin);
      } else {
        left = 0;
        top = 0;
        right = scan.width - 1;
        bottom = scan.height - 1;
      }
      const canvas = document.createElement("canvas"),
        cropWidth = right - left + 1,
        cropHeight = bottom - top + 1;
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      canvas.getContext("2d")?.drawImage(scan, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.74),
      );
      const meaningfullyCropped = cropWidth < scan.width * 0.97 || cropHeight < scan.height * 0.97;
      return blob && (meaningfullyCropped || scale < 1 || blob.size < file.size)
        ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
            type: "image/webp",
          })
        : file;
    } catch {
      return file;
    }
  };

  const storeProductImage = async (
    file: File,
    productId: string,
    prepare = true,
  ) => {
    const prepared = prepare ? await prepareImage(file) : file,
      form = new FormData();
    form.set("file", prepared);
    form.set("productId", productId);
    const response = await fetch("/api/images", { method: "POST", body: form }),
      result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to upload photo.");
    return result.url as string;
  };

  const uploadImage = async (file?: File) => {
    if (!file || !selected) return;
    setImageStatus("uploading");
    setImageMessage("Preparing photo…");
    try {
      setImageMessage("Uploading photo…");
      const imageUrl = await storeProductImage(file, selected);
      updateProductsAcrossPlanograms([selected], (item) => ({
        ...item,
        image: imageUrl,
        imageSource: undefined,
        imageSourceUrl: undefined,
        imageLookupCheckedAt: undefined,
        imageLookupVersion: undefined,
      }));
      setImageStatus("done");
      setImageMessage("Photo added");
    } catch (error) {
      setImageStatus("error");
      setImageMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload photo. Please try again.",
      );
    }
  };
  const autoCropProductImage = async (item: Product) => {
    if (!item.image || imageStatus === "uploading") return;
    setImageStatus("uploading");
    setImageMessage("Auto-cropping image…");
    try {
      const response = await fetch(item.image);
      if (!response.ok) throw new Error("Unable to load this image.");
      const blob = await response.blob(),
        file = new File([blob], `${item.name || "product"}.png`, { type: blob.type || "image/png" }),
        imageUrl = await storeProductImage(file, item.id);
      setWorkspace((current) => ({
        ...current,
        planograms: current.planograms.map((target) => ({
          ...target,
          products: target.products.map((candidate) =>
            sameCatalogProduct(candidate, item)
              ? { ...candidate, image: imageUrl, imageRotation: 0, imageFlipped: false }
              : candidate,
          ),
        })),
      }));
      setImageStatus("done");
      setImageMessage("Image auto-cropped and saved");
    } catch (error) {
      setImageStatus("error");
      setImageMessage(error instanceof Error ? error.message : "Unable to auto-crop this image.");
    }
  };
  const openManualCropImage = (
    productId: string,
    productName: string,
    image: string,
  ) => {
    setManualCrop({
      productId,
      productName,
      image,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      naturalWidth: 1,
      naturalHeight: 1,
    });
    setImageMessage("");
  };
  const openManualCrop = (item: Product) => {
    if (item.image) openManualCropImage(item.id, item.name, item.image);
  };
  const beginManualCropDrag = (
    event: React.PointerEvent<HTMLElement>,
    mode: "move" | "nw" | "ne" | "sw" | "se",
  ) => {
    if (!manualCrop) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.closest<HTMLElement>(".manual-crop-stage");
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    stage.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: {
        x: manualCrop.x,
        y: manualCrop.y,
        width: manualCrop.width,
        height: manualCrop.height,
      },
      stageWidth: bounds.width,
      stageHeight: bounds.height,
    };
  };
  const moveManualCrop = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    event.preventDefault();
    const dx = ((event.clientX - drag.startClientX) / Math.max(1, drag.stageWidth)) * 100,
      dy = ((event.clientY - drag.startClientY) / Math.max(1, drag.stageHeight)) * 100,
      minimum = 6,
      clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
    setManualCrop((current) => {
      if (!current) return current;
      let { x, y, width, height } = drag.startCrop;
      if (drag.mode === "move") {
        x = clamp(x + dx, 0, 100 - width);
        y = clamp(y + dy, 0, 100 - height);
      } else {
        if (drag.mode === "nw" || drag.mode === "sw") {
          const right = x + width;
          x = clamp(x + dx, 0, right - minimum);
          width = right - x;
        }
        if (drag.mode === "ne" || drag.mode === "se")
          width = clamp(width + dx, minimum, 100 - x);
        if (drag.mode === "nw" || drag.mode === "ne") {
          const bottom = y + height;
          y = clamp(y + dy, 0, bottom - minimum);
          height = bottom - y;
        }
        if (drag.mode === "sw" || drag.mode === "se")
          height = clamp(height + dy, minimum, 100 - y);
      }
      return { ...current, x, y, width, height };
    });
  };
  const finishManualCropDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    cropDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const applyManualCrop = async () => {
    if (!manualCrop || imageStatus === "uploading") return;
    setImageStatus("uploading");
    setImageMessage("Saving manual crop…");
    try {
      const response = await fetch(manualCrop.image);
      if (!response.ok) throw new Error("Unable to load this image.");
      const sourceBlob = await response.blob(),
        bitmap = await createImageBitmap(sourceBlob),
        sourceX = Math.max(0, Math.round((manualCrop.x / 100) * bitmap.width)),
        sourceY = Math.max(0, Math.round((manualCrop.y / 100) * bitmap.height)),
        sourceWidth = Math.max(1, Math.min(bitmap.width - sourceX, Math.round((manualCrop.width / 100) * bitmap.width))),
        sourceHeight = Math.max(1, Math.min(bitmap.height - sourceY, Math.round((manualCrop.height / 100) * bitmap.height))),
        canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare the crop.");
      context.clearRect(0, 0, sourceWidth, sourceHeight);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      bitmap.close();
      const croppedBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!croppedBlob) throw new Error("Unable to create the cropped image.");
      const file = new File([croppedBlob], `${manualCrop.productName || "product"}-cropped.png`, { type: "image/png" }),
        item = plan.products.find((candidate) => candidate.id === manualCrop.productId),
        imageUrl = await storeProductImage(file, manualCrop.productId, false);
      if (!item) throw new Error("This product is no longer available.");
      setWorkspace((current) => ({
        ...current,
        planograms: current.planograms.map((target) => ({
          ...target,
          products: target.products.map((candidate) =>
            sameCatalogProduct(candidate, item)
              ? { ...candidate, image: imageUrl, imageRotation: 0, imageFlipped: false }
              : candidate,
          ),
        })),
      }));
      setManualCrop(null);
      setPendingImageMatch(null);
      setImageStatus("done");
      setImageMessage("Manual crop saved");
    } catch (error) {
      setImageStatus("error");
      setImageMessage(error instanceof Error ? error.message : "Unable to save this crop.");
    }
  };
  const exportPogx = async () => {
    let portablePlan = plan;
    if (!plan.sourcePsaText && plan.sourcePsaKey) {
      try {
        const response = await fetch(
          `/api/psa?key=${encodeURIComponent(plan.sourcePsaKey)}`,
        );
        if (response.ok)
          portablePlan = { ...plan, sourcePsaText: await response.text() };
      } catch {}
    }
    const file = {
      format: "planogram-studio-pogx",
      version: 1,
      exportedAt: new Date().toISOString(),
      planogram: portablePlan,
    };
    downloadBlob(
      new Blob([JSON.stringify(file, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `${safeFileName(plan.title)}.pogx`,
    );
    if (saveAsMenuRef.current) saveAsMenuRef.current.open = false;
  };
  const exportWorkspaceJson = () => {
    downloadBlob(
      new Blob([serializedWorkspaceFile()], {
        type: "application/json;charset=utf-8",
      }),
      `planogram-studio-workspace-${new Date().toISOString().slice(0, 10)}.json`,
    );
    if (saveAsMenuRef.current) saveAsMenuRef.current.open = false;
  };
  const serializedWorkspaceFile = () => {
    const portableWorkspace = {
      ...workspace,
      planograms: fullWorkspaceHydrated.current
        ? workspace.planograms
        : [
            ...workspace.planograms,
            ...[...openedPlanograms.current.values()].filter(
              (cached) => !workspace.planograms.some((item) => item.id === cached.id),
            ),
          ],
    };
    return JSON.stringify(
      {
        format: "planogram-studio-workspace",
        version: 1,
        exportedAt: new Date().toISOString(),
        workspace: portableWorkspace,
      },
      null,
      2,
    );
  };
  const openDesktopWorkspace = async () => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const result = await bridge.openWorkspace();
    if (!result?.contents) return;
    try {
      const parsed = JSON.parse(result.contents),
        imported = normalize(parsed?.workspace ?? parsed);
      const activePlan = imported.planograms.find((item) => item.id === imported.activeId) ?? imported.planograms[0];
      fullWorkspaceHydrated.current = true;
      rememberWorkspacePlanograms(imported);
      suppressNextCloudDirty.current = true;
      setWorkspace(imported);
      setActiveSectionId(activePlan?.sections[0]?.id ?? null);
      setSelected(activePlan?.products[0]?.id ?? null);
      setSaved("saved");
      setSaveMessage(`Opened ${result.path}`);
    } catch {
      alert("That file is not a valid Planogram Studio workspace.");
    }
  };
  const saveDesktopWorkspace = async (saveAs = false) => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const result = saveAs
      ? await bridge.saveWorkspaceAs(serializedWorkspaceFile())
      : await bridge.saveWorkspace(serializedWorkspaceFile());
    if (result?.path) {
      setSaved("saved");
      setSaveMessage(`Saved ${result.path}`);
    }
  };
  const chooseDesktopImageFolder = async () => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const productMap = new Map<string, Pick<Product, "id" | "upc" | "sku" | "brand" | "name">>();
    for (const product of workspaceImageSources(workspace)) {
      productMap.set(product.id, {
        id: product.id,
        upc: product.upc,
        sku: product.sku,
        brand: product.brand,
        name: product.name,
      });
    }
    const result = await bridge.chooseImageFolder([...productMap.values()]);
    if (!result) return;
    const matches = result.matches ?? {},
      matchCount = Object.keys(matches).length;
    if (!matchCount) {
      setSaveMessage(`No product image matches found in ${result.path}. Scanned ${result.scanned.toLocaleString()} files.`);
      return;
    }
    const relinkProducts = (products: Product[]) =>
      products.map((product) => {
        const match = matches[product.id];
        return match
          ? {
              ...product,
              image: match.url,
              imageSource: "Local image folder",
              imageSourceUrl: result.path,
              localImagePath: match.path,
              imageLookupCheckedAt: new Date().toISOString(),
              imageQualityScore: Math.max(product.imageQualityScore ?? 0, Math.round(match.score / 10)),
            }
          : product;
      });
    setWorkspace((current) => ({
      ...current,
      planograms: current.planograms.map((target) => ({
        ...target,
        products: relinkProducts(target.products),
      })),
      versions: (current.versions ?? []).map((version) => ({
        ...version,
        planogram: {
          ...version.planogram,
          products: relinkProducts(version.planogram.products),
        },
      })),
      trash: (current.trash ?? []).map((deleted) => ({
        ...deleted,
        planogram: {
          ...deleted.planogram,
          products: relinkProducts(deleted.planogram.products),
        },
      })),
    }));
    setSaved("pending");
    setSaveMessage(
      `Linked ${matchCount.toLocaleString()} product images from ${result.path}. Use Save local to keep this desktop workspace.`,
    );
  };
  const importAll = (file?: File) =>
    file?.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.format === "planogram-studio-workspace" && parsed?.workspace) {
          const imported = normalize(parsed.workspace);
          const activePlan = imported.planograms.find((item) => item.id === imported.activeId) ?? imported.planograms[0];
          setWorkspace(imported);
          setActiveSectionId(activePlan?.sections[0]?.id ?? null);
          setSelected(activePlan?.products[0]?.id ?? null);
          return;
        }
        if (parsed?.format === "planogram-studio-pogx" && parsed?.planogram) {
          const importedPlan = normalizePlan(parsed.planogram as Planogram);
          setWorkspace((current) => ({
            ...current,
            activeId: importedPlan.id,
            planograms: [
              ...current.planograms.filter((item) => item.id !== importedPlan.id),
              importedPlan,
            ],
          }));
          setActiveSectionId(importedPlan.sections[0]?.id ?? null);
          setSelected(importedPlan.products[0]?.id ?? null);
          return;
        }
        setWorkspace(normalize(parsed));
      } catch {
        alert("That file is not a valid planogram file.");
      }
    });
  const importPsaFile = async (
    file?: File,
    selectedPlanogramLine?: number,
    importingBatch = false,
  ) => {
    if (!file) return;
    try {
      const text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
      const planogramOptions = listPsaPlanograms(text);
      if (selectedPlanogramLine == null && planogramOptions.length > 1) {
        const menu = planogramOptions
          .map((option, index) => `${index + 1}. ${option.title}`)
          .join("\n");
        const choice = window.prompt(
          `This PSA contains ${planogramOptions.length} planograms.\n\n${menu}\n\nEnter a number to open one, or type ALL to import every planogram as a separate project.`,
          "ALL",
        );
        if (choice == null) return;
        const normalizedChoice = choice.trim().toUpperCase();
        if (normalizedChoice === "ALL") {
          for (const option of planogramOptions) {
            await importPsaFile(file, option.sourcePlanogramLine, true);
          }
          alert(
            `${planogramOptions.length} planograms imported as separate projects.\n\n${planogramOptions.map((option) => `• ${option.title}`).join("\n")}`,
          );
          return;
        }
        const selectedIndex = Number.parseInt(normalizedChoice, 10) - 1;
        const selectedOption = planogramOptions[selectedIndex];
        if (!selectedOption) {
          alert(`Enter a number from 1 to ${planogramOptions.length}, or type ALL.`);
          return;
        }
        await importPsaFile(file, selectedOption.sourcePlanogramLine);
        return;
      }

      const imported = parsePsa(text, file.name, selectedPlanogramLine),
        details = [
          `PSA version ${imported.version}`,
          `${imported.summary.sections} section${imported.summary.sections === 1 ? "" : "s"}`,
          `${imported.summary.shelves} shelves`,
          `${imported.summary.products} products`,
          `${imported.summary.placements} placements`,
        ].join(" · ");
      if (
        !importingBatch &&
        !window.confirm(
          `Open ${file.name} as a new planogram?\n\n${details}` +
            (imported.warnings.length
              ? `\n\nReview notes:\n${imported.warnings.join("\n")}`
              : ""),
        )
      )
        return;

      const library = workspace.planograms.flatMap((item) => item.products),
        productIdentity = (item: { name?: string; upc?: string; sku?: string }) =>
          ({
            name: item.name ?? "",
            upc: item.upc ?? "",
            sku: item.sku ?? "",
          }) as Product,
        findLibraryProduct = (item: (typeof imported.products)[number]) => {
          const identity = productIdentity(item);
          return library.find((candidate) => sameCatalogProduct(candidate, identity));
        },
        productIdBySource = new Map<string, string>(),
        products: Product[] = imported.products.map((item, index) => {
          const existing = findLibraryProduct(item),
            id = uid("product");
          productIdBySource.set(item.sourceId, id);
          return normalizeProduct({
            id,
            name: item.name,
            brand: item.brand || existing?.brand || "",
            manufacturer:
              item.manufacturer || existing?.manufacturer || "",
            colorGroup: existing?.colorGroup || "",
            description: item.description || existing?.description || "",
            upc: item.upc || existing?.upc || "",
            sku: item.sku || existing?.sku || "",
            category: item.category || existing?.category || "",
            subcategory: item.subcategory || existing?.subcategory || "",
            price: existing?.price ?? 0,
            width: item.width,
            height: item.height,
            depth: item.depth,
            unitsPerFacing: item.unitsPerFacing,
            orientation: item.orientation,
            merchStyle: existing?.merchStyle ?? "unit",
            minFacings: existing?.minFacings ?? 1,
            recommendedFacings: existing?.recommendedFacings ?? 1,
            maxFacings: existing?.maxFacings ?? 8,
            performance: existing?.performance ?? {},
            image: existing?.image,
            imageRotation: existing?.imageRotation ?? 0,
            imageFlipped: existing?.imageFlipped ?? false,
            color: existing?.color ?? colors[index % colors.length],
            sourcePsaId: item.sourceId,
            sourcePsaLine: item.sourceLine,
          });
        }),
        id = uid("pog"),
        importedPlan = normalizePlan({
          id,
          title: imported.title,
          fixtureWidth: imported.fixtureWidth,
          fixtureHeight: imported.fixtureHeight,
          products,
          sections: imported.sections.map((section) => ({
            id: `${id}-${section.id}`,
            name: section.name,
            width: section.width,
            sourcePsaX: section.sourceX,
            shelves: section.shelves.map((shelf) => ({
              id: `${id}-${shelf.id}`,
              name: shelf.name,
              height: shelf.height,
              width: shelf.width,
              sourcePsaPositionY: shelf.sourcePositionY,
              sourcePsaFixtureLine: shelf.sourceFixtureLine,
              placements: shelf.placements
                .map((placement) => {
                  const productId = productIdBySource.get(
                    placement.productSourceId,
                  );
                  return productId
                    ? {
                        id: `${id}-${placement.id}`,
                        productId,
                        x: placement.x,
                        facings: placement.facings,
                        sourcePsaLine: placement.sourceLine,
                      }
                    : null;
                })
                .filter((placement): placement is Placement => !!placement),
            })),
          })),
          autoArrange: false,
          sourceFormat: "psa",
          sourceVersion: imported.version,
          sourceFileName: file.name,
          importWarnings: imported.warnings,
          sourcePsaText: text,
          sourcePsaPlanogramLine: imported.sourcePlanogramLine,
          sourcePsaPlanogramEndLine: imported.sourcePlanogramEndLine,
          projectNotes: `Imported from ${file.name}`,
        });

      setWorkspace((current) => {
        const allSources = [
          ...current.planograms.flatMap((target) => target.products),
          ...importedPlan.products,
        ];
        const master: Product[] = [];
        for (const item of allSources) {
          const index = master.findIndex((candidate) => sameCatalogProduct(candidate, item));
          if (index >= 0) master[index] = mergeCatalogProduct(master[index], item);
          else master.push(structuredClone(item));
        }
        return {
          ...current,
          activeId: id,
          planograms: [...current.planograms, importedPlan].map(
            (target) => syncCatalogProducts(target, master).planogram,
          ),
        };
      });
      setActiveSectionId(importedPlan.sections[0]?.id ?? null);
      setSelected(importedPlan.products[0]?.id ?? null);
      setSelectedPlacement(null);
      setSelectedPlacements([]);
      setViewMode(false);
      if (!importingBatch)
        alert(
          `PSA opened successfully.\n\n${details}\nAll imported products were synced to your master library.` +
            (imported.warnings.length
              ? `\n\n${imported.warnings.length} import note${imported.warnings.length === 1 ? "" : "s"} saved in Project details.`
              : ""),
        );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The PSA file could not be opened.",
      );
    }
  };
  type PdfTextItem = {
    text: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const extractPdfData = async (file: File) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      disableWorker: true,
      isEvalSupported: false,
    }).promise;
    const pageTexts: string[] = [],
      pages: Array<{ page: number; width: number; height: number; items: PdfTextItem[] }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber),
        viewport = page.getViewport({ scale: 1 }),
        content = await page.getTextContent(),
        lines = new Map<number, Array<{ x: number; text: string }>>(),
        items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , , x, y] = item.transform,
          lineKey = Math.round(y / 4) * 4,
          row = lines.get(lineKey) ?? [];
        items.push({
          text: item.str.trim(),
          page: pageNumber,
          x,
          y,
          width: "width" in item ? Number(item.width) || 0 : 0,
          height: "height" in item ? Number(item.height) || 0 : 0,
        });
        row.push({ x, text: item.str.trim() });
        lines.set(lineKey, row);
      }
      pages.push({ page: pageNumber, width: viewport.width, height: viewport.height, items });
      pageTexts.push(
        [...lines.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([, row]) =>
            row
              .sort((a, b) => a.x - b.x)
              .map((item) => item.text)
              .join(" "),
          )
          .join("\n"),
      );
    }
    return { text: pageTexts.join("\n\n"), pages };
  };
  const numberFromMatch = (value?: string) =>
    value == null ? undefined : Number.parseFloat(value);
  const cleanPdfProductName = (value: string) =>
    value
      .replace(/\b\d{8,14}\b/g, "")
      .replace(/\b\d+(?:\.\d+)?\s*(?:oz|ounce|ct|count)\b/gi, "")
      .replace(/\b(?:page|printed|file|catman|space team|basepog|pog|planogram|walmart)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  const isPdfNoiseText = (value: string) =>
    /^(?:page:|printed:|file:|catman|space team|basepog|walmart 24ft|4 ft)$/i.test(
      value.trim(),
    );
  const extractCatmanPdfProducts = (
    pages: Array<{ page: number; width: number; height: number; items: PdfTextItem[] }>,
  ) => {
    const productRows: Array<{
      sourceLine: number;
      line: string;
      upc: string;
      name: string;
      brand: string;
      width: number;
      height: number;
      depth: number;
      facings: number;
      page: number;
      x: number;
      y: number;
    }> = [];
    const seen = new Set<string>();
    for (const page of pages.filter((candidate) => candidate.items.length > 50)) {
      const rows = new Map<number, PdfTextItem[]>();
      for (const item of page.items) {
        const key = Math.round(item.y / 7) * 7,
          row = rows.get(key) ?? [];
        row.push(item);
        rows.set(key, row);
      }
      for (const row of rows.values()) {
        const digitItems = row
          .filter((item) => /^\d{2,14}$/.test(item.text))
          .sort((a, b) => a.x - b.x);
        const runs: Array<{ code: string; x: number; y: number }> = [];
        for (const item of digitItems) {
          const previous = runs[runs.length - 1],
            gap = previous ? item.x - previous.x : Infinity;
          if (
            previous &&
            gap >= 0 &&
            gap < 16 &&
            previous.code.length + item.text.length <= 14
          ) {
            previous.code += item.text;
            previous.x = (previous.x + item.x) / 2;
            previous.y = (previous.y + item.y) / 2;
          } else {
            runs.push({ code: item.text, x: item.x, y: item.y });
          }
        }
        for (const run of runs) {
          const upc = run.code.replace(/\D/g, "");
          if (upc.length < 8 || upc.length > 14) continue;
          const nearby = page.items.filter(
            (item) =>
              Math.abs(item.y - run.y) < 18 &&
              Math.abs(item.x - run.x) < 55 &&
              !/^\d{2,14}$/.test(item.text) &&
              !isPdfNoiseText(item.text),
          );
          const rawName = nearby
              .sort((a, b) => a.y - b.y || a.x - b.x)
              .map((item) => item.text)
              .join(" "),
            name = cleanPdfProductName(rawName);
          if (name.split(/\s+/).filter(Boolean).length < 2) continue;
          const key = `${page.page}:${upc}:${Math.round(run.x / 8)}:${Math.round(run.y / 8)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const size = rawName.match(/\b(\d+(?:\.\d+)?)\s*(?:oz|ounce)\b/i),
            tokens = name.split(/\s+/).filter(Boolean),
            brand = tokens.slice(0, Math.min(2, tokens.length)).join(" ");
          productRows.push({
            sourceLine: page.page * 1000 + Math.round(run.y),
            line: rawName || name,
            upc,
            name,
            brand,
            width: 5.5,
            height: size ? Math.max(5, Math.min(14, Number.parseFloat(size[1]) + 2)) : 8,
            depth: 2,
            facings: 1,
            page: page.page,
            x: run.x,
            y: run.y,
          });
        }
      }
    }
    return productRows.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  };
  const importPdfFile = async (file?: File) => {
    if (!file) return;
    try {
      const pdfData = await extractPdfData(file),
        text = pdfData.text,
        lines = text
          .split(/\n+/)
          .map((line) => line.replace(/\s+/g, " ").trim())
          .filter(Boolean);
      if (text.replace(/\s+/g, "").length < 40) {
        alert(
          "This PDF looks image-only or scanned. I could not extract enough text to create a POG yet. OCR support is the next step for those PDFs.",
        );
        return;
      }
      const catmanProductRows = extractCatmanPdfProducts(pdfData.pages);
      const productRows = (catmanProductRows.length >= 10
        ? catmanProductRows
        : lines
        .map((line, index) => {
          const upc = line.match(/\b\d{8,14}\b/)?.[0] ?? "",
            dimensions = line.match(/(\d+(?:\.\d+)?)\s*(?:in|")?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:in|")?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:in|")?)?/i),
            facings = line.match(/\b(?:facings?|faces?|qty|quantity)\s*[:#-]?\s*(\d{1,2})\b/i)?.[1],
            cleaned = line
              .replace(/\b\d{8,14}\b/g, "")
              .replace(/(\d+(?:\.\d+)?)\s*(?:in|")?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:in|")?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:in|")?)?/gi, "")
              .replace(/\b(?:facings?|faces?|qty|quantity)\s*[:#-]?\s*\d{1,2}\b/gi, "")
              .replace(/\b(?:shelf|section|page|planogram|pog)\b.*$/i, "")
              .trim();
          if (!upc && !dimensions && cleaned.split(/\s+/).length < 3) return null;
          const tokens = cleaned.split(/\s+/).filter(Boolean),
            brand = tokens.slice(0, Math.min(2, tokens.length)).join(" "),
            name = cleaned || `PDF Item ${index + 1}`;
          return {
            sourceLine: index + 1,
            line,
            upc,
            name,
            brand,
            width: numberFromMatch(dimensions?.[1]) ?? 5.5,
            height: numberFromMatch(dimensions?.[2]) ?? 8,
            depth: numberFromMatch(dimensions?.[3]) ?? 2,
            facings: Math.max(1, Math.min(12, Number.parseInt(facings ?? "1", 10) || 1)),
            page: 1,
            x: index,
            y: index,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row)
      ).slice(0, 250);
      if (!productRows.length) {
        alert(
          "I could read text from this PDF, but I could not identify usable products. A PDF with UPCs, product names, or dimensions will work better.",
        );
        return;
      }
      const detectedSectionCount =
          new Set(
            (pdfData.pages[0]?.items ?? [])
              .filter((item) => /^4\s*ft$/i.test(item.text))
              .map((item) => Math.round(item.y / 8)),
          ).size || 1,
        sectionCount = Math.max(1, Math.min(8, detectedSectionCount)),
        details = `${productRows.length} product${productRows.length === 1 ? "" : "s"} detected from ${lines.length} text lines`;
      if (
        !window.confirm(
          `Create a new POG from ${file.name}?\n\n${details}\n${catmanProductRows.length >= 10 ? "CatMan layout mode detected." : "Generic PDF text mode detected."}\n\nPDF import may need cleanup after import.`,
        )
      )
        return;
      const library = workspace.planograms.flatMap((item) => item.products),
        id = uid("pog"),
        productIdByIndex = new Map<number, string>(),
        products = productRows.map((item, index) => {
          const identity = { name: item.name, upc: item.upc, sku: "" } as Product,
            existing = library.find((candidate) => sameCatalogProduct(candidate, identity)),
            productId = uid("product");
          productIdByIndex.set(index, productId);
          return normalizeProduct({
            id: productId,
            name: existing?.name || item.name,
            brand: existing?.brand || item.brand,
            manufacturer: existing?.manufacturer || "",
            colorGroup: existing?.colorGroup || "",
            description: existing?.description || item.line,
            upc: item.upc || existing?.upc || "",
            sku: existing?.sku || "",
            category: existing?.category || "",
            subcategory: existing?.subcategory || "",
            price: existing?.price ?? 0,
            width: existing?.width || item.width,
            height: existing?.height || item.height,
            depth: existing?.depth || item.depth,
            unitsPerFacing: existing?.unitsPerFacing ?? 1,
            merchStyle: existing?.merchStyle ?? "unit",
            minFacings: existing?.minFacings ?? 1,
            recommendedFacings: existing?.recommendedFacings ?? item.facings,
            maxFacings: existing?.maxFacings ?? 8,
            performance: existing?.performance ?? {},
            image: existing?.image,
            imageRotation: existing?.imageRotation ?? 0,
            imageFlipped: existing?.imageFlipped ?? false,
            color: existing?.color ?? colors[index % colors.length],
            sourcePsaLine: item.sourceLine,
          });
        }),
        fixtureWidth = sectionCount * 48,
        productsPerSection = Math.ceil(productRows.length / sectionCount),
        sections = Array.from({ length: sectionCount }, (_, sectionIndex) => {
          const sectionRows = productRows.slice(
              sectionIndex * productsPerSection,
              Math.min(productRows.length, (sectionIndex + 1) * productsPerSection),
            ),
            shelfBands: Array<typeof sectionRows> = [];
          for (const row of sectionRows) {
            const band = shelfBands.find(
              (candidate) => Math.abs((candidate[0]?.y ?? row.y) - row.y) < 28,
            );
            if (band) band.push(row);
            else shelfBands.push([row]);
          }
          return {
            id: `${id}-pdf-section-${sectionIndex + 1}`,
            name: `Section ${sectionIndex + 1}`,
            width: 48,
            shelves: shelfBands
              .sort((a, b) => (a[0]?.y ?? 0) - (b[0]?.y ?? 0))
              .map((band, shelfIndex) => {
                const sorted = [...band].sort((a, b) => a.x - b.x),
                  minX = Math.min(...sorted.map((item) => item.x)),
                  maxX = Math.max(...sorted.map((item) => item.x)),
                  span = Math.max(1, maxX - minX);
                return {
                  id: `${id}-pdf-section-${sectionIndex + 1}-shelf-${shelfIndex + 1}`,
                  name: `Shelf ${shelfIndex + 1}`,
                  height: 12,
                  width: 48,
                  placements: sorted.map((item) => {
                    const productIndex = productRows.indexOf(item),
                      productId = productIdByIndex.get(productIndex) ?? products[productIndex]?.id;
                    return {
                      id: `${id}-pdf-placement-${productIndex + 1}`,
                      productId,
                      x: Math.max(0, Math.min(47, ((item.x - minX) / span) * 42)),
                      facings: item.facings,
                      sourcePsaLine: item.sourceLine,
                    };
                  }).filter((placement): placement is Placement => Boolean(placement.productId)),
                };
              }),
          };
        }),
        importedPlan = normalizePlan({
          id,
          title: file.name.replace(/\.pdf$/i, "") || "PDF Planogram",
          fixtureWidth,
          fixtureHeight: Math.max(...sections.map((section) => section.shelves.length), 1) * 12,
          products,
          sections,
          autoArrange: false,
          sourceFormat: "pdf",
          sourceVersion: catmanProductRows.length >= 10 ? "catman-coordinate-v1" : "text-extract-v1",
          sourceFileName: file.name,
          importWarnings: [
            catmanProductRows.length >= 10
              ? "CatMan PDF import used text coordinates around UPC blocks to estimate products, sections and shelf placement."
              : "PDF import is a first-pass text extraction. Review product names, dimensions, shelf placement and facings before using the POG.",
            "Image-only scanned PDFs need OCR before they can be converted.",
          ],
          projectNotes: `Imported from PDF ${file.name}`,
        });
      setWorkspace((current) => ({
        ...current,
        activeId: id,
        planograms: [...current.planograms, importedPlan],
      }));
      setActiveSectionId(importedPlan.sections[0]?.id ?? null);
      setSelected(importedPlan.products[0]?.id ?? null);
      setSelectedPlacement(null);
      setSelectedPlacements([]);
      setViewMode(false);
      alert(`PDF POG created.\n\n${details}\n\nReview the imported layout before saving or exporting.`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The PDF file could not be opened.",
      );
    }
  };
  const importProjectFile = async (file?: File) => {
    if (!file) return;
    setImportingFile(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const isPsa =
        /\.psa$/i.test(file.name) ||
        (await file.slice(0, 64).text()).includes("PROSPACE SCHEMATIC FILE");
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf")
        await importPdfFile(file);
      else if (isPsa) await importPsaFile(file);
      else await importAll(file);
    } finally {
      setImportingFile(false);
    }
  };
  const exportPsaFile = async () => {
    try {
      const sourceText = plan.sourcePsaText
        ? plan.sourcePsaText
        : plan.sourcePsaKey
          ? await fetch(`/api/psa?key=${encodeURIComponent(plan.sourcePsaKey)}`).then(
            async (response) => {
              if (!response.ok) throw new Error("The retained PSA source could not be loaded.");
              return response.text();
            })
          : "";
      const exportPlan = {
          title: plan.title,
          fixtureWidth: plan.fixtureWidth,
          fixtureHeight: plan.fixtureHeight,
          sourcePlanogramLine: plan.sourcePsaPlanogramLine,
          sourcePlanogramEndLine: plan.sourcePsaPlanogramEndLine,
          products: plan.products.map((item) => ({
            id: item.id,
            sourceId: item.sourcePsaId,
            sourceLine: item.sourcePsaLine,
            name: item.name,
            brand: item.brand,
            manufacturer: item.manufacturer,
            upc: item.upc,
            sku: item.sku,
            category: item.category,
            subcategory: item.subcategory,
            width: item.width,
            height: item.height,
            depth: item.depth,
            unitsPerFacing: item.unitsPerFacing,
            orientation: item.orientation,
          })),
          sections: plan.sections.map((section) => ({
            width: section.width,
            sourceX: section.sourcePsaX,
            shelves: section.shelves.map((shelf) => ({
              name: shelf.name,
              height: shelf.height,
              width: shelf.width,
              sourcePositionY: shelf.sourcePsaPositionY,
              sourceFixtureLine: shelf.sourcePsaFixtureLine,
              placements: shelf.placements.map((placement) => ({
                sourceLine: placement.sourcePsaLine,
                productId: placement.productId,
                x: placement.x,
                facings: placement.facings,
              })),
            })),
          })),
        },
        result = sourceText
          ? exportPsa({ ...exportPlan, sourceText })
          : createPsa(exportPlan),
        checked = parsePsa(result.text, `${plan.title}.psa`);
      if (!checked.summary.sections || !checked.summary.products)
        throw new Error("The exported PSA did not pass its structure check.");
      const bytes = result.bytes.slice().buffer as ArrayBuffer;
      downloadBlob(
        new Blob([bytes], { type: "application/octet-stream" }),
        `${safeFileName(plan.title)}-edited.psa`,
      );
      alert(
        "PSA exported successfully. Keep the original file as a backup and open the edited copy in Blue Yonder/JDA to confirm it before replacing production work." +
          (result.warnings.length
            ? `\n\nExport notes:\n${result.warnings.join("\n")}`
            : ""),
      );
      if (saveAsMenuRef.current) saveAsMenuRef.current.open = false;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The PSA file could not be exported.",
      );
    }
  };
  const saveNamedVersion = () => {
    const name = window
      .prompt("Name this restore point", `Version ${planVersions.length + 1}`)
      ?.trim();
    if (!name) return;
    const version: SavedVersion = {
      id: uid("version"),
      planogramId: plan.id,
      name,
      createdAt: new Date().toISOString(),
      planogram: structuredClone(plan),
    };
    setWorkspace((w) => {
      const other = (w.versions ?? []).filter(
          (item) => item.planogramId !== plan.id,
        ),
        current = [
          ...(w.versions ?? []).filter((item) => item.planogramId === plan.id),
          version,
        ].slice(-10);
      return { ...w, versions: [...other, ...current] };
    });
    setVersionChoice(version.id);
  };
  const restoreNamedVersion = () => {
    const version = (workspace.versions ?? []).find(
      (item) => item.id === versionChoice,
    );
    if (!version) return;
    const restored = normalizePlan(structuredClone(version.planogram));
    setWorkspace((w) => ({
      ...w,
      planograms: w.planograms.map((item) =>
        item.id === plan.id ? { ...restored, id: plan.id } : item,
      ),
    }));
    setActiveSectionId(restored.sections[0]?.id ?? null);
    setSelected(restored.products[0]?.id ?? null);
    setSelectedPlacement(null);
    setSelectedPlacements([]);
  };
  const exportCatalogCsv = () => {
    const columns = [
        "name",
        "brand",
        "manufacturer",
        "colorGroup",
        "description",
        "upc",
        "sku",
        "category",
        "subcategory",
        ...(workspace.customProductColumns ?? []),
        "price",
        "width",
        "height",
        "depth",
        "unitsPerFacing",
        "orientation",
        "merchStyle",
        "minFacings",
        "recommendedFacings",
        "maxFacings",
        "sales",
        "units",
        "velocity",
        "profit",
        "growth",
        "imageRotation",
        "imageFlipped",
        "image",
      ],
      rows = plan.products.map((item) => [
        item.name,
        item.brand,
        item.manufacturer,
        item.colorGroup,
        item.description,
        item.upc,
        item.sku,
        item.category,
        item.subcategory,
        ...(workspace.customProductColumns ?? []).map(
          (column) => item.customFields?.[column] ?? "",
        ),
        item.price,
        item.width,
        item.height,
        item.depth,
        item.unitsPerFacing ?? 1,
        item.orientation ?? "front",
        item.merchStyle ?? "unit",
        item.minFacings ?? 1,
        item.recommendedFacings ?? 1,
        item.maxFacings ?? 8,
        item.performance?.sales,
        item.performance?.units,
        item.performance?.velocity,
        item.performance?.profit,
        item.performance?.growth,
        item.imageRotation ?? 0,
        item.imageFlipped ? "true" : "false",
        item.image ?? "",
      ]);
    const csv = [columns, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${safeFileName(plan.title)}-products.csv`,
    );
  };
  const exportPogProductsCsv = () => {
    const columns = [
        "Product name",
        "UPC",
        "SKU / ID",
        "Brand",
        "Manufacturer",
        "Category",
        "Subcategory",
        ...(workspace.customProductColumns ?? []),
        "Width (in)",
        "Height (in)",
        "Depth (in)",
        "Total facings",
        "Unit capacity",
        "Linear inches",
        "Sections",
        "Shelves",
      ],
      excelUpc = (value: string) =>
        /^\d+$/.test(value.trim()) ? `="${value.trim()}"` : value,
      rows = pogProductRows.map((row) => [
        row.product.name,
        excelUpc(row.product.upc),
        row.product.sku,
        row.product.brand,
        row.product.manufacturer,
        row.product.category,
        row.product.subcategory,
        ...(workspace.customProductColumns ?? []).map(
          (column) => row.product.customFields?.[column] ?? "",
        ),
        row.product.width,
        row.product.height,
        row.product.depth,
        row.facings,
        row.capacity,
        Number(row.linearInches.toFixed(2)),
        [...row.sections].join("; "),
        [...row.shelves].join("; "),
      ]);
    const csv = [columns, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    downloadBlob(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      `${safeFileName(plan.title)}-pog-products.csv`,
    );
    trackEvent("export", "pog_products_csv", "success", {
      products: pogProductRows.length,
    });
  };
  const exportSpaceAnalysisCsv = () => {
    const metricLabel =
      spaceMetric === "sales" ? "Dollar sales" : spaceMetric === "units" ? "Unit sales" : "Unit velocity";
    const output: Array<Array<string | number | undefined>> = [[
      "Level",
      "Group by",
      "Group",
      "Products",
      "Linear inches",
      "Space share %",
      metricLabel,
      `${metricLabel} share %`,
      "Performance to space index",
      "Share gap points",
    ]];
    const append = (nodes: SpaceHierarchyNode[]) => {
      for (const node of nodes) {
        const spaceShare = linearSpace.used > 0 ? (node.linearInches / linearSpace.used) * 100 : 0;
        const performanceShare = spaceMetricTotal > 0 ? (node.performance / spaceMetricTotal) * 100 : 0;
        output.push([
          node.level + 1,
          spaceGroupOptions.find((option) => option.value === spaceGroups[node.level])?.label ?? spaceGroups[node.level],
          node.label,
          node.products,
          Number(node.linearInches.toFixed(2)),
          Number(spaceShare.toFixed(2)),
          Number(node.performance.toFixed(2)),
          Number(performanceShare.toFixed(2)),
          spaceShare > 0 ? Number(((performanceShare / spaceShare) * 100).toFixed(1)) : undefined,
          Number((performanceShare - spaceShare).toFixed(2)),
        ]);
        append(node.children);
      }
    };
    append(spaceHierarchy);
    const csv = output.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadBlob(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      `${safeFileName(plan.title)}-space-analysis.csv`,
    );
    trackEvent("export", "space_analysis_csv", "success", { metric: spaceMetric });
  };
  const exportEnterpriseData = () => {
    let sectionOffset = 0;
    const exchange = {
      schema: "planogram-exchange/v1",
      generatedAt: new Date().toISOString(),
      source: "Planogram Studio Pro",
      measurementUnit: "in",
      targetAdapters: {
        blueYonderPsa: "sample-required",
        apolloXml: "sample-required",
      },
      planogram: {
        id: plan.id,
        code: plan.planogramCode ?? "",
        name: plan.title,
        client: plan.clientName ?? "",
        retailer: plan.retailerName ?? "",
        location: plan.locationName ?? "",
        effectiveDate: plan.effectiveDate ?? "",
        width: plan.fixtureWidth,
        height: plan.fixtureHeight,
        notes: plan.projectNotes ?? "",
      },
      products: plan.products.map((item) => ({
        id: item.id,
        upc: item.upc,
        sku: item.sku ?? "",
        name: item.name,
        brand: item.brand,
        manufacturer: item.manufacturer ?? "",
        colorGroup: item.colorGroup ?? "",
        category: item.category ?? "",
        subcategory: item.subcategory ?? "",
        customFields: item.customFields ?? {},
        description: item.description,
        dimensions: {
          width: item.width,
          height: item.height,
          depth: item.depth,
        },
        price: item.price,
        unitsPerFacing: item.unitsPerFacing ?? 1,
        orientation: item.orientation ?? "front",
        merchStyle: item.merchStyle ?? "unit",
        facingRules: {
          minimum: item.minFacings ?? 1,
          recommended: item.recommendedFacings ?? 1,
          maximum: item.maxFacings ?? 8,
        },
        performance: item.performance ?? {},
        imageTransform: {
          rotation: item.imageRotation ?? 0,
          flipped: item.imageFlipped ?? false,
        },
        image: item.image ?? null,
      })),
      sections: plan.sections.map((section, sectionIndex) => {
        const offset = sectionOffset;
        sectionOffset += section.width;
        return {
          id: section.id,
          name: section.name,
          index: sectionIndex + 1,
          x: offset,
          width: section.width,
          shelves: section.shelves.map((shelf, shelfIndex) => {
            const shelfWidth = shelf.width ?? section.width;
            return {
              id: shelf.id,
              name: shelf.name,
              index: shelfIndex + 1,
              width: shelfWidth,
              height: shelf.height,
              positions: shelf.placements.map((placement, positionIndex) => {
                const item = plan.products.find(
                  (value) => value.id === placement.productId,
                );
                return {
                  id: placement.id,
                  index: positionIndex + 1,
                  productId: placement.productId,
                  upc: item?.upc ?? "",
                  sku: item?.sku ?? "",
                  xPercent: placement.x,
                  x: offset + (placement.x / 100) * shelfWidth,
                  facings: placement.facings,
                  capacity:
                    placement.facings * Math.max(1, item?.unitsPerFacing ?? 1),
                  orientation: item?.orientation ?? "front",
                  merchStyle: item?.merchStyle ?? "unit",
                };
              }),
            };
          }),
        };
      }),
    };
    downloadBlob(
      new Blob([JSON.stringify(exchange, null, 2)], {
        type: "application/json",
      }),
      `${safeFileName(plan.title)}.pogx`,
    );
  };
  const importCatalogCsv = async (file?: File) => {
    if (!file) return;
    try {
      const rows = parseCsv(await file.text()).filter((row) =>
        row.some((cell) => cell.trim()),
      );
      if (rows.length < 2) throw new Error("The CSV has no product rows.");
      const headers = rows[0].map((value) => value.trim().toLowerCase()),
        index = (name: string) => headers.indexOf(name.toLowerCase()),
        knownColumns = new Set([
          "name", "brand", "manufacturer", "colorgroup", "description", "upc", "sku",
          "category", "subcategory", "price", "width", "height", "depth", "unitsperfacing",
          "orientation", "merchstyle", "minfacings", "recommendedfacings", "maxfacings",
          "sales", "units", "velocity", "profit", "growth", "imagerotation", "imageflipped", "image",
        ]),
        importedCustomColumns = rows[0]
          .map((value) => value.trim())
          .filter((value) => value && !knownColumns.has(value.toLowerCase()));
      let nameIndex = index("name");
      if (nameIndex < 0) {
        const chosen = window
          .prompt(
            "Which column contains the product name?\n\nAvailable columns: " +
              rows[0].join(", "),
          )
          ?.trim()
          .toLowerCase();
        nameIndex = chosen ? headers.indexOf(chosen) : -1;
      }
      if (nameIndex < 0) throw new Error("Choose a valid product-name column.");
      const validRows = rows.slice(1).filter((row) => row[nameIndex]?.trim()),
        invalidRows = rows.slice(1).filter((row) => !row[nameIndex]?.trim());
      if (
        !window.confirm(
          "Import preview\n\n" +
            validRows.length +
            " product rows will be applied.\n" +
            invalidRows.length +
            " rows are missing a product name and will be skipped.\n\nContinue?",
        )
      )
        return;
      const textAt = (row: string[], name: string) => {
          const position = index(name);
          return position >= 0 ? (row[position] ?? "").trim() : "";
        },
        numberAt = (row: string[], name: string, fallback: number) => {
          const value = Number(textAt(row, name));
          return Number.isFinite(value) && value > 0 ? value : fallback;
        };
      let imported = 0;
      updatePlan((current) => {
        const products = [...current.products];
        for (const row of validRows) {
          const name = row[nameIndex]?.trim();
          if (!name) continue;
          const upc = textAt(row, "upc"),
            existingIndex = upc
              ? products.findIndex((item) => item.upc === upc)
              : -1,
            existing = existingIndex >= 0 ? products[existingIndex] : undefined,
            orientation = textAt(row, "orientation"),
            merchStyle = textAt(row, "merchStyle"),
            csvImage = textAt(row, "image"),
            item: Product = mergeProductImageFields(
              {
                id: existing?.id ?? uid("product"),
                name,
                brand: textAt(row, "brand") || existing?.brand || "",
                manufacturer:
                  textAt(row, "manufacturer") || existing?.manufacturer || "",
                colorGroup:
                  textAt(row, "colorGroup") || existing?.colorGroup || "",
                description:
                  textAt(row, "description") || existing?.description || "",
                upc,
                sku: textAt(row, "sku") || existing?.sku || "",
                category: textAt(row, "category") || existing?.category || "",
                subcategory:
                  textAt(row, "subcategory") || existing?.subcategory || "",
                customFields: {
                  ...(existing?.customFields ?? {}),
                  ...Object.fromEntries(
                    importedCustomColumns.map((column) => [column, textAt(row, column)]),
                  ),
                },
                width: numberAt(row, "width", existing?.width ?? 4),
                height: numberAt(row, "height", existing?.height ?? 7),
                depth: numberAt(row, "depth", existing?.depth ?? 2),
                price: numberAt(row, "price", existing?.price ?? 0),
                unitsPerFacing: Math.max(
                  1,
                  Math.round(
                    numberAt(
                      row,
                      "unitsPerFacing",
                      existing?.unitsPerFacing ?? 1,
                    ),
                  ),
                ),
                orientation: ["front", "side", "top"].includes(orientation)
                  ? (orientation as Product["orientation"])
                  : (existing?.orientation ?? "front"),
                merchStyle: ["unit", "case", "tray", "stack"].includes(merchStyle)
                  ? (merchStyle as Product["merchStyle"])
                  : (existing?.merchStyle ?? "unit"),
                minFacings: Math.max(
                  1,
                  Math.round(
                    numberAt(row, "minFacings", existing?.minFacings ?? 1),
                  ),
                ),
                recommendedFacings: Math.max(
                  1,
                  Math.round(
                    numberAt(
                      row,
                      "recommendedFacings",
                      existing?.recommendedFacings ?? 1,
                    ),
                  ),
                ),
                maxFacings: Math.max(
                  1,
                  Math.round(
                    numberAt(row, "maxFacings", existing?.maxFacings ?? 8),
                  ),
                ),
                image: csvImage || existing?.image,
                color: existing?.color ?? colors[products.length % colors.length],
              },
              existing,
              csvImage ? ({ image: csvImage } as Product) : undefined,
            );
          if (existingIndex >= 0) products[existingIndex] = item;
          else products.push(item);
          imported++;
        }
        return { ...current, products };
      });
      if (importedCustomColumns.length)
        setWorkspace((current) => ({
          ...current,
          customProductColumns: [
            ...(current.customProductColumns ?? []),
            ...importedCustomColumns.filter(
              (column) =>
                !(current.customProductColumns ?? []).some(
                  (existing) => existing.toLowerCase() === column.toLowerCase(),
                ),
            ),
          ],
        }));
      alert(
        `${imported} product${imported === 1 ? "" : "s"} imported. Matching UPCs were updated.`,
      );
      if (
        invalidRows.length &&
        window.confirm("Download the skipped-row error report?")
      ) {
        const report = [rows[0], ...invalidRows]
          .map((row) => row.map(csvEscape).join(","))
          .join("\r\n");
        downloadBlob(
          new Blob([report], { type: "text/csv;charset=utf-8" }),
          safeFileName(file.name.replace(/\.csv$/i, "")) + "-errors.csv",
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The product CSV could not be imported.",
      );
    }
  };
  const importPerformanceCsv = async (file?: File) => {
    if (!file) return;
    try {
      const rows = parseCsv(await file.text()).filter((row) =>
        row.some((cell) => cell.trim()),
      );
      if (rows.length < 2) throw new Error("The CSV has no data rows.");
      const normalizeHeader = (value: string) =>
          value.toLowerCase().replace(/[^a-z0-9]/g, ""),
        headers = rows[0].map(normalizeHeader),
        findColumn = (aliases: string[]) =>
          headers.findIndex((header) =>
            aliases.map(normalizeHeader).includes(header),
          ),
        upcIndex = findColumn(["upc", "upc code", "barcode", "gtin"]),
        skuIndex = findColumn([
          "sku",
          "item",
          "item number",
          "item id",
          "product id",
        ]),
        metricColumns: Record<
          keyof Omit<PerformanceData, "updatedAt">,
          number
        > = {
          sales: findColumn([
            "sales",
            "sales dollars",
            "revenue",
            "dollar sales",
          ]),
          units: findColumn(["units", "unit sales", "quantity", "qty"]),
          velocity: findColumn([
            "velocity",
            "units per store per week",
            "units/store/week",
            "upsw",
          ]),
          profit: findColumn(["profit", "gross profit", "margin dollars"]),
          growth: findColumn([
            "growth",
            "growth percent",
            "percent change",
            "change percent",
          ]),
        };
      if (upcIndex < 0 && skuIndex < 0)
        throw new Error("Add a UPC or SKU column so products can be matched.");
      const availableMetrics = Object.entries(metricColumns).filter(
        ([, index]) => index >= 0,
      ) as [keyof Omit<PerformanceData, "updatedAt">, number][];
      if (!availableMetrics.length)
        throw new Error(
          "Add at least one metric column: sales, units, velocity, profit or growth.",
        );
      const numberValue = (value: string) => {
        const clean = value.trim(),
          negative = /^\(.*\)$/.test(clean),
          parsed = Number(clean.replace(/[,$%()\s]/g, ""));
        return Number.isFinite(parsed)
          ? negative
            ? -parsed
            : parsed
          : undefined;
      };
      let matched = 0,
        unmatched = 0;
      const updates = new Map<string, PerformanceData>();
      for (const row of rows.slice(1)) {
        const upc =
            upcIndex >= 0 ? (row[upcIndex] ?? "").replace(/\D/g, "") : "",
          sku = skuIndex >= 0 ? (row[skuIndex] ?? "").trim().toLowerCase() : "",
          item = plan.products.find(
            (product) =>
              (!!upc && product.upc.replace(/\D/g, "") === upc) ||
              (!!sku && (product.sku ?? "").trim().toLowerCase() === sku),
          );
        if (!item) {
          unmatched++;
          continue;
        }
        const performance: PerformanceData = {
          ...(item.performance ?? {}),
          ...(updates.get(item.id) ?? {}),
          updatedAt: new Date().toISOString(),
        };
        for (const [metric, column] of availableMetrics) {
          const value = numberValue(row[column] ?? "");
          if (value !== undefined) performance[metric] = value;
        }
        updates.set(item.id, performance);
        matched++;
      }
      updatePlan((current) => ({
        ...current,
        products: current.products.map((item) =>
          updates.has(item.id)
            ? { ...item, performance: updates.get(item.id) }
            : item,
        ),
      }));
      alert(
        matched +
          " row" +
          (matched === 1 ? "" : "s") +
          " matched. " +
          unmatched +
          " unmatched. Metrics: " +
          availableMetrics.map(([metric]) => metric).join(", ") +
          ".",
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The performance CSV could not be imported.",
      );
    }
  };
  const printPlanogram = () => window.print();
  const setViewerZoom = (value: number) =>
    setViewZoom(Math.max(0.1, Math.min(3, Number(value.toFixed(2)))));
  const fitViewer = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewMode) {
      setViewZoom(1);
    } else {
      const baseWidth = Math.max(760, plan.sections.length * 280),
        baseHeight = baseWidth * (plan.fixtureHeight / Math.max(1, plan.fixtureWidth)),
        availableWidth = Math.max(100, viewer.clientWidth - 48),
        availableHeight = Math.max(100, viewer.clientHeight - 48);
      setViewerZoom(Math.min(1, availableWidth / baseWidth, availableHeight / baseHeight));
    }
    requestAnimationFrame(() =>
      viewerRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }),
    );
  };
  const viewerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      (!viewMode && !panMode) ||
      (event.target as HTMLElement).closest(".viewer-controls") ||
      event.button !== 0
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    viewPointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    viewGesture.current.lastX = event.clientX;
    viewGesture.current.lastY = event.clientY;
    if (viewPointers.current.size === 2) {
      const [a, b] = [...viewPointers.current.values()];
      viewGesture.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
      viewGesture.current.startZoom = viewZoom;
    }
  };
  const viewerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((!viewMode && !panMode) || !viewPointers.current.has(event.pointerId)) return;
    event.preventDefault();
    viewPointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (viewPointers.current.size === 2) {
      const [a, b] = [...viewPointers.current.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (viewGesture.current.startDistance)
        setViewerZoom(
          viewGesture.current.startZoom *
            (distance / viewGesture.current.startDistance),
        );
      return;
    }
    const dx = event.clientX - viewGesture.current.lastX,
      dy = event.clientY - viewGesture.current.lastY;
    event.currentTarget.scrollLeft -= dx;
    event.currentTarget.scrollTop -= dy;
    viewGesture.current.lastX = event.clientX;
    viewGesture.current.lastY = event.clientY;
  };
  const viewerPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    viewPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const remaining = [...viewPointers.current.values()][0];
    if (remaining) {
      viewGesture.current.lastX = remaining.x;
      viewGesture.current.lastY = remaining.y;
    }
    viewGesture.current.startDistance = 0;
  };

  const exportPlanogramImage = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const margin = 90,
        projectLine = [plan.clientName, plan.locationName]
          .filter(Boolean)
          .join(" · "),
        referenceLine = [
          plan.retailerName,
          plan.planogramCode ? "POG " + plan.planogramCode : "",
          plan.effectiveDate
            ? "Effective " +
              new Date(plan.effectiveDate + "T00:00:00").toLocaleDateString()
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        headerHeight = 145 + (projectLine ? 35 : 0) + (referenceLine ? 32 : 0),
        legendRows =
          plan.exportLegend !== false && colorLegend.length
            ? Math.ceil(colorLegend.length / 6)
            : 0,
        legendHeight = legendRows ? 42 + legendRows * 34 : 0,
        fixtureRatio = plan.fixtureHeight / Math.max(1, plan.fixtureWidth);
      let fixtureWidth = 1420,
        fixtureHeight = fixtureWidth * fixtureRatio;
      if (fixtureHeight > 3200) {
        const scale = 3200 / fixtureHeight;
        fixtureWidth *= scale;
        fixtureHeight = 3200;
      }
      const pageWidth = Math.max(900, Math.round(fixtureWidth + margin * 2));
      const canvas = document.createElement("canvas");
      canvas.width = pageWidth;
      canvas.height = Math.round(
        headerHeight + legendHeight + fixtureHeight + margin,
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to create image");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#152334";
      ctx.font = "700 42px Inter, Arial, sans-serif";
      ctx.fillText(plan.title, margin, 66);
      if (projectLine) {
        ctx.fillStyle = "#315f5a";
        ctx.font = "600 21px Inter, Arial, sans-serif";
        ctx.fillText(projectLine, margin, 103);
      }
      if (referenceLine) {
        ctx.fillStyle = "#4e5f6e";
        ctx.font = "600 19px Inter, Arial, sans-serif";
        ctx.fillText(referenceLine, margin, projectLine ? 136 : 103);
      }
      ctx.fillStyle = "#667482";
      ctx.font = "500 22px Inter, Arial, sans-serif";
      ctx.fillText(
        `${plan.fixtureWidth.toFixed(1).replace(/\.0$/, "")}\" W × ${plan.fixtureHeight}\" H · ${plan.sections.length} sections · ${allShelves.length} shelves · ${facings} facings · ${capacity} unit capacity`,
        margin,
        105 + (projectLine ? 35 : 0) + (referenceLine ? 32 : 0),
      );
      if (legendRows) {
        const legendY = headerHeight + 4;
        ctx.fillStyle = "#263543";
        ctx.font = "700 18px Inter, Arial, sans-serif";
        ctx.fillText(
          performanceModes.includes(plan.colorMode ?? "none") ||
            plan.colorMode === "facings" ||
            plan.colorMode === "capacity"
            ? "Heat map"
            : "Color groups",
          margin,
          legendY + 20,
        );
        colorLegend.forEach((entry, index) => {
          const column = index % 6,
            row = Math.floor(index / 6),
            x = margin + column * ((pageWidth - margin * 2) / 6),
            y = legendY + 40 + row * 34;
          ctx.fillStyle = entry.color;
          ctx.fillRect(x, y - 14, 18, 18);
          ctx.fillStyle = "#455463";
          ctx.font = "600 15px Inter, Arial, sans-serif";
          ctx.fillText(
            fitText(ctx, entry.label, (pageWidth - margin * 2) / 6 - 30),
            x + 25,
            y,
          );
        });
      }
      const images = new Map<string, HTMLImageElement | null>();
      await Promise.all(
        plan.products
          .filter((item) => item.image)
          .map(async (item) =>
            images.set(item.id, await loadCanvasImage(item.image!)),
          ),
      );
      const frame = 16,
        topCap = 44,
        sectionBand = 34,
        beamHeight = 22,
        fixtureX = (pageWidth - fixtureWidth) / 2,
        fixtureY = headerHeight + legendHeight,
        innerX = fixtureX + frame,
        innerY = fixtureY + frame,
        innerWidth = fixtureWidth - frame * 2,
        innerHeight = fixtureHeight - frame * 2;
      ctx.fillStyle = "#384654";
      ctx.fillRect(fixtureX, fixtureY, fixtureWidth, fixtureHeight);
      ctx.fillStyle = "#263543";
      ctx.fillRect(innerX, innerY, innerWidth, topCap);
      ctx.fillStyle = "#e4ebef";
      ctx.font = "600 18px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${plan.fixtureWidth.toFixed(1).replace(/\.0$/, "")}\" W × ${plan.fixtureHeight}\" H`,
        innerX + innerWidth / 2,
        innerY + 28,
      );
      ctx.textAlign = "left";
      let sectionX = innerX;
      for (const section of plan.sections) {
        const sectionWidth =
          innerWidth * (section.width / Math.max(1, plan.fixtureWidth));
        ctx.fillStyle = "#dfe7ec";
        ctx.fillRect(sectionX, innerY + topCap, sectionWidth, sectionBand);
        ctx.fillStyle = "#263543";
        ctx.font = "700 16px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `${section.name} · ${section.width.toFixed(1).replace(/\.0$/, "")}\"`,
          sectionX + sectionWidth / 2,
          innerY + topCap + 23,
        );
        ctx.textAlign = "left";
        const totalShelfHeight =
            section.shelves.reduce(
              (sum, shelf) => sum + Math.max(0.1, shelf.height),
              0,
            ) || 1,
          openHeight =
            innerHeight -
            topCap -
            sectionBand -
            beamHeight * section.shelves.length;
        let currentY = innerY + topCap + sectionBand;
        for (const shelf of section.shelves) {
          const spaceHeight =
              openHeight * (Math.max(0.1, shelf.height) / totalShelfHeight),
            shelfWidthIn = shelf.width ?? section.width,
            shelfPixelWidth =
              sectionWidth *
              Math.min(1, shelfWidthIn / Math.max(1, section.width)),
            shelfX = sectionX + (sectionWidth - shelfPixelWidth) / 2;
          ctx.fillStyle = "#f7f8fa";
          ctx.fillRect(shelfX, currentY, shelfPixelWidth, spaceHeight);
          ctx.strokeStyle = "#c8d1d8";
          ctx.lineWidth = 2;
          ctx.strokeRect(shelfX, currentY, shelfPixelWidth, spaceHeight);
          for (const placement of shelf.placements) {
            const item = plan.products.find(
              (p) => p.id === placement.productId,
            );
            if (!item) continue;
            const displaySize = productDisplaySize(item),
              groupWidth =
                (displaySize.width / Math.max(0.1, shelfWidthIn)) *
                shelfPixelWidth *
                placement.facings,
              groupHeight =
                (displaySize.height / Math.max(0.1, shelf.height)) *
                spaceHeight,
              groupPercent = (groupWidth / shelfPixelWidth) * 100,
              groupX =
                shelfX +
                (Math.max(0, Math.min(placement.x, 100 - groupPercent)) / 100) *
                  shelfPixelWidth,
              groupY = currentY + spaceHeight - groupHeight,
              facingWidth = groupWidth / Math.max(1, placement.facings),
              loadedImage = images.get(item.id);
            for (let facing = 0; facing < placement.facings; facing++) {
              const cellX = groupX + facing * facingWidth;
              ctx.fillStyle = showSolidColors
                ? displayColor(item, placement)
                : loadedImage
                  ? "#fff"
                  : item.color;
              ctx.fillRect(
                cellX,
                groupY,
                Math.max(1, facingWidth - 2),
                groupHeight,
              );
              ctx.strokeStyle = "#ffffff88";
              ctx.strokeRect(
                cellX,
                groupY,
                Math.max(1, facingWidth - 2),
                groupHeight,
              );
              if (plan.colorMode !== "none") {
                ctx.strokeStyle = displayColor(item, placement);
                ctx.lineWidth = Math.max(3, Math.min(7, facingWidth / 12));
                ctx.strokeRect(
                  cellX + 1,
                  groupY + 1,
                  Math.max(1, facingWidth - 4),
                  Math.max(1, groupHeight - 2),
                );
                ctx.lineWidth = 2;
              }
              if (loadedImage && !showSolidColors) {
                const rotation = item.imageRotation ?? 0,
                  rotated = rotation === 90 || rotation === 270,
                  fitWidth = rotated ? loadedImage.height : loadedImage.width,
                  fitHeight = rotated ? loadedImage.width : loadedImage.height,
                  scale = Math.min(
                    (facingWidth - 8) / fitWidth,
                    (groupHeight - 8) / fitHeight,
                  ),
                  drawWidth = loadedImage.width * scale,
                  drawHeight = loadedImage.height * scale;
                ctx.save();
                ctx.translate(
                  cellX + facingWidth / 2,
                  groupY + groupHeight / 2,
                );
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.scale(item.imageFlipped ? -1 : 1, 1);
                ctx.drawImage(
                  loadedImage,
                  -drawWidth / 2,
                  -drawHeight / 2,
                  drawWidth,
                  drawHeight,
                );
                ctx.restore();
              } else if (facingWidth > 34 && groupHeight > 38) {
                ctx.fillStyle = "#fff";
                ctx.font = `700 ${Math.max(12, Math.min(19, facingWidth / 5))}px Inter, Arial, sans-serif`;
                ctx.textAlign = "center";
                ctx.fillText(
                  fitText(ctx, item.name, Math.max(10, facingWidth - 10)),
                  cellX + facingWidth / 2,
                  groupY + groupHeight / 2,
                );
                ctx.textAlign = "left";
              }
            }
          }
          currentY += spaceHeight;
          ctx.fillStyle = "#465665";
          ctx.fillRect(shelfX, currentY, shelfPixelWidth, beamHeight);
          const shelfCapacity = shelf.placements.reduce((sum, placement) => {
            const item = plan.products.find(
              (p) => p.id === placement.productId,
            );
            return (
              sum + placement.facings * Math.max(1, item?.unitsPerFacing ?? 1)
            );
          }, 0);
          ctx.fillStyle = "#f0f4f6";
          ctx.font = "600 13px Inter, Arial, sans-serif";
          ctx.fillText(
            fitText(
              ctx,
              `${shelf.name} · ${shelfWidthIn}\" · ${shelfCapacity} units`,
              shelfPixelWidth - 12,
            ),
            shelfX + 7,
            currentY + 16,
          );
          currentY += beamHeight;
        }
        ctx.strokeStyle = "#6c7b88";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          sectionX,
          innerY + topCap,
          sectionWidth,
          innerHeight - topCap,
        );
        sectionX += sectionWidth;
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Unable to create image")),
            "image/png",
          ),
        ),
        safeName =
          (plan.title || "planogram")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "planogram",
        file = new File([blob], `${safeName}.png`, { type: "image/png" });
      const useMobileShare = window.matchMedia(
        "(max-width: 760px) and (pointer: coarse)",
      ).matches;
      try {
        if (
          useMobileShare &&
          navigator.share &&
          navigator.canShare?.({ files: [file] })
        ) {
          await navigator.share({ files: [file], title: plan.title });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("The planogram image could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (auth.status === "signed-out")
    return (
      <LoginScreen
        initialMessage={auth.message}
        onSignedIn={applySignedInUser}
      />
    );

  if (booting || auth.status === "checking")
    return <BootScreen message={bootMessage} />;

  if (workspaceLoadFailed)
    return <main style={{ maxWidth: 640, margin: "48px auto", padding: 24 }}>
      <h1>Your saved workspace could not load</h1>
      <p>This is a loading failure, not a confirmation that your POGs were deleted. Saving is paused to protect your saved work.</p>
      <p><a href="/recovery">Find and download saved POGs and image library records</a></p>
      <button onClick={() => window.location.reload()}>Retry loading</button>
    </main>;

  return (
    <main
      className={`app-shell ${viewMode ? "view-mode" : "edit-mode"} ${workspaceView === "analytics" || workspaceView === "pogProducts" ? "analytics-mode" : ""} ${plan.exportLegend === false ? "export-no-legend" : ""} ribbon-layout`}
    >
      <header className="topbar">
        <div className="brandmark">
          <Layers3 size={22} />
        </div>
        <div className="brand">
          <strong>Planogram</strong>
          <span>Studio Pro</span>
        </div>
        <span className="beta-notice" title="Feature usage and technical errors are recorded during the beta. Planogram contents and product images are not collected.">
          Beta · usage &amp; errors monitored
        </span>
        <label className="pog-open-select">
          <span>Open POG</span>
          <select
            value={plan.id}
            onChange={(event) => void switchPog(event.target.value)}
            disabled={Boolean(switchingPogId)}
            aria-label="Open planogram"
          >
            {pogOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          {switchingPogId && <small>Opening...</small>}
        </label>
        <div className="title-wrap">
          <input
            className="plan-title"
            value={plan.title}
            readOnly={viewMode}
            aria-label="Planogram name"
            onChange={(e) =>
              updatePlan((p) => ({ ...p, title: e.target.value }))
            }
          />
        </div>
        <button
          className={`view-toggle ${viewMode ? "active" : ""}`}
          onClick={() => {
            setPanMode(false);
            setViewMode((value) => {
              if (value) setViewZoom(1);
              return !value;
            });
            setSelectedPlacement(null);
            setSelectedPlacements([]);
            setMultiSelectMode(false);
          }}
          aria-label={viewMode ? "Return to edit mode" : "View planogram"}
          title={viewMode ? "Edit planogram" : "View planogram"}
        >
          {viewMode ? <Pencil size={18} /> : <Eye size={18} />}
          <span>{viewMode ? "Edit" : "View"}</span>
        </button>
        <div className="history-actions">
          <button
            data-analytics-action="Planogram"
            className="icon-btn"
            onClick={undo}
            disabled={!undoStack.current.length}
            aria-label="Undo"
            title="Undo"
          >
            <Undo2 size={17} />
          </button>
          <button
            data-analytics-action="POG Product Library"
            className="icon-btn"
            onClick={redo}
            disabled={!redoStack.current.length}
            aria-label="Redo"
            title="Redo"
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="workspace-switch" role="tablist" aria-label="Workspace view">
          <button
            data-analytics-action="Image Library"
            className={workspaceView === "planogram" ? "active" : ""}
            onClick={() => { setWorkspaceView("planogram"); setShowSpaceAnalytics(false); }}
            role="tab"
            aria-selected={workspaceView === "planogram"}
          >
            <span className="desktop-label">Planogram</span><span className="compact-label">Planogram</span><span className="mobile-label">POG</span>
          </button>
          <button
            className={workspaceView === "pogProducts" ? "active" : ""}
            onClick={() => { setWorkspaceView("pogProducts"); setShowSpaceAnalytics(false); }}
            role="tab"
            aria-selected={workspaceView === "pogProducts"}
          >
            <span className="desktop-label">POG Product Library</span><span className="compact-label">POG Library</span><span className="mobile-label">POG Items</span>
          </button>
          <button
            className={workspaceView === "library" ? "active" : ""}
            onClick={() => {
              setWorkspaceView("library");
              setShowSpaceAnalytics(false);
              setLeftPanelCollapsed(false);
            }}
            role="tab"
            aria-selected={workspaceView === "library"}
          >
            <span className="desktop-label">Image Library</span><span className="compact-label">Images</span><span className="mobile-label">Images</span>
          </button>
          {analyticsOwner && (
            <button
              data-analytics-action="Beta Analytics"
              className={workspaceView === "analytics" ? "active" : ""}
              onClick={() => { setWorkspaceView("analytics"); setShowSpaceAnalytics(false); void loadAnalytics(); }}
              role="tab"
              aria-selected={workspaceView === "analytics"}
            >
              <span className="desktop-label">Beta Analytics</span><span className="compact-label">Beta</span><span className="mobile-label">Analytics</span>
            </button>
          )}
        </div>
        <label
          className={`arrange-toggle ${plan.autoArrange !== false ? "active" : ""}`}
        >
          <input
            type="checkbox"
            checked={plan.autoArrange !== false}
            onChange={(e) =>
              updatePlan((p) => ({ ...p, autoArrange: e.target.checked }))
            }
          />
          <span>Auto arrange</span>
        </label>
        <div className="top-actions">
          {auth.status === "signed-in" && (
            <button
              className="account-button"
              onClick={() => void signOut()}
              title={`Signed in as ${auth.user.email}`}
            >
              <span>{auth.user.email}</span>
              <LogOut size={15} />
            </button>
          )}
          <span className={`save-state ${saved}`} title={saveMessage}>
            {saved === "saving"
              ? "Saving…"
              : saved === "saved"
                ? "All changes saved"
                : saved === "pending"
                  ? "Changes pending"
                : saved === "retrying"
                  ? "Retrying save…"
                  : saved === "backup"
                    ? "Backup needed"
                : saved === "conflict"
                  ? "Newer cloud copy found"
                  : "Save unavailable"}
          </span>
          <button
            className="primary save-now-button"
            onClick={() => void saveWorkspaceNow()}
            disabled={manualSaveRunning}
            title={saveMessage || "Save the current workspace now"}
            data-analytics-action="Save now"
          >
            <Save size={16} />
            {manualSaveRunning ? "Saving" : "Save now"}
          </button>
          <label className="secondary file-button top-import-action">
            <Upload size={16} /> {importingFile ? "Opening..." : "Import"}
            <input
              type="file"
              accept=".pogx,.json,.psa,.pdf,application/json,application/pdf,text/plain"
              onChange={(e) => {
                void importProjectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {isDesktopApp && (
            <>
              <button className="secondary" onClick={() => void openDesktopWorkspace()}>
                <Upload size={16} /> Open local
              </button>
              <button className="secondary" onClick={() => void saveDesktopWorkspace()}>
                <Save size={16} /> Save local
              </button>
              <button className="secondary" onClick={() => void chooseDesktopImageFolder()}>
                <FolderOpen size={16} /> Image folder
              </button>
            </>
          )}
          <label className="secondary file-button top-import-action">
            <FileText size={16} /> {importingFile ? "Opening..." : "Open PSA"}
            <input
              type="file"
              accept=".psa,text/plain"
              onChange={(e) => {
                void importProjectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <details className="save-as-menu" ref={saveAsMenuRef}>
            <summary className="primary">
              <Save size={16} /> Save As
            </summary>
            <div className="save-as-options">
              <button onClick={() => void exportPogx()}>
                <Save size={16} />
                <span><b>POGX</b><small>Editable project file</small></span>
              </button>
              <button onClick={exportWorkspaceJson}>
                <Download size={16} />
                <span><b>Workspace JSON</b><small>All POGs and image records</small></span>
              </button>
              {isDesktopApp && (
                <>
                  <button onClick={() => void saveDesktopWorkspace()}>
                    <Save size={16} />
                    <span><b>Save local</b><small>Desktop workspace file</small></span>
                  </button>
                  <button onClick={() => void saveDesktopWorkspace(true)}>
                    <Download size={16} />
                    <span><b>Save local as</b><small>Choose a .pogstudio file</small></span>
                  </button>
                  <button onClick={() => void chooseDesktopImageFolder()}>
                    <FolderOpen size={16} />
                    <span><b>Image folder</b><small>Match local files to products</small></span>
                  </button>
                </>
              )}
              <button onClick={() => void exportPsaFile()}>
                <Download size={16} />
                <span><b>PSA</b><small>Blue Yonder/JDA file</small></span>
              </button>
              <button onClick={() => {
                if (saveAsMenuRef.current) saveAsMenuRef.current.open = false;
                printPlanogram();
              }}>
                <FileText size={16} />
                <span><b>PDF</b><small>Print or save as PDF</small></span>
              </button>
            </div>
          </details>
        </div>
      </header>
      {cloudConflict && (
        <section className="save-conflict" role="alert" aria-live="assertive">
          <div>
            <strong>A newer saved copy was found</strong>
            <span>
              This planogram was changed in another tab or on another device.
              Choose which copy to keep.
            </span>
          </div>
          <div className="save-conflict-actions">
            <button className="secondary" onClick={useCloudCopy}>
              Use newer cloud copy
            </button>
            <button className="primary" onClick={keepThisCopy}>
              Keep this copy
            </button>
          </div>
        </section>
      )}
      {!viewMode && workspaceView !== "analytics" && workspaceView !== "pogProducts" && (
        <section className="app-ribbon" aria-label="Planogram tools">
          <div className="ribbon-tabs" role="tablist" aria-label="Tool categories">
            {(["file", "fixture", "shelves", "products", "analytics", "view", "export"] as RibbonTab[]).map((tab) => (
              <button
                key={tab}
                className={activeRibbonTab === tab ? "active" : ""}
                onClick={() => setActiveRibbonTab(tab)}
                role="tab"
                aria-selected={activeRibbonTab === tab}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <details className="mobile-ribbon-menu">
            <summary><Menu size={17} /> More</summary>
            <div>
              {(["file", "fixture", "shelves", "products", "analytics", "view", "export"] as RibbonTab[]).map((tab) => (
                <button
                  key={tab}
                  className={activeRibbonTab === tab ? "active" : ""}
                  onClick={(event) => {
                    setActiveRibbonTab(tab);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </details>
          <div className="ribbon-content">
            {activeRibbonTab === "file" && (
              <>
                <div className="ribbon-group">
                  <label className="ribbon-action file-button">
                    <Upload size={17} /> {importingFile ? "Opening..." : "Import POGX/PSA/PDF"}
                    <input
                      type="file"
                      accept=".pogx,.json,.psa,.pdf,application/json,application/pdf,text/plain"
                      onChange={(e) => {
                        void importProjectFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="ribbon-action file-button">
                    <FileText size={17} /> {importingFile ? "Opening..." : "Open PSA"}
                    <input
                      type="file"
                      accept=".psa,text/plain"
                      onChange={(e) => {
                        void importProjectFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="ribbon-group-label">Open</span>
                </div>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={createPog}><Plus size={17} /> New</button>
                  <button className="ribbon-action" onClick={exportWorkspaceJson}><Download size={17} /> Workspace JSON</button>
                  {isDesktopApp && <button className="ribbon-action" onClick={() => void chooseDesktopImageFolder()}><FolderOpen size={17} /> Image folder</button>}
                  <button className="ribbon-action" onClick={duplicatePog}><Copy size={17} /> Duplicate</button>
                  <button className="ribbon-action danger" onClick={deletePog} disabled={pogOptions.length === 1}><Trash2 size={17} /> Delete</button>
                  <span className="ribbon-group-label">Planogram</span>
                </div>
              </>
            )}
            {activeRibbonTab === "fixture" && (
              <>
                <div className="ribbon-group ribbon-inputs">
                  <FixtureInput label="Total width" value={plan.fixtureWidth} onCommit={(value) => editFixture("fixtureWidth", value)} />
                  <FixtureInput label="Total height" value={plan.fixtureHeight} onCommit={(value) => editFixture("fixtureHeight", value)} />
                  <FixtureInput
                    label="All section widths"
                    value={activeSection.width}
                    onCommit={editAllSectionWidths}
                  />
                  <span className="ribbon-group-label">Fixture & all sections</span>
                </div>
                <div className="ribbon-group ribbon-metrics">
                  <span><b>{plan.sections.length}</b> Sections</span>
                  <span><b>{allShelves.length}</b> Shelves</span>
                  <span><b>{facings}</b> Facings</span>
                  <span><b>{capacity}</b> Capacity</span>
                  <span className="ribbon-group-label">Summary</span>
                </div>
                <div className="ribbon-group ribbon-inputs">
                  <FixtureInput
                    label="Section width"
                    value={activeSection.width}
                    onCommit={editSectionWidth}
                  />
                  <span className="ribbon-group-label">Selected section</span>
                </div>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={addSection}><Layers3 size={17} /> Add section</button>
                  <button className="ribbon-action" onClick={duplicateSection}><Copy size={17} /> Duplicate</button>
                  <button className="ribbon-action danger" onClick={removeSection} disabled={plan.sections.length === 1}><Trash2 size={17} /> Delete</button>
                  <span className="ribbon-group-label">Section</span>
                </div>
              </>
            )}
            {activeRibbonTab === "shelves" && (
              <>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={addShelf}><Plus size={17} /> Add shelf</button>
                  <button className="ribbon-action" onClick={duplicateShelf} disabled={!activeShelf}><Copy size={17} /> Duplicate</button>
                  <span className="ribbon-group-label">Shelf</span>
                </div>
                {activeShelf ? (
                  <>
                    <div className="ribbon-group ribbon-inputs">
                      <FixtureInput
                        label="Shelf length"
                        value={activeShelf.width ?? activeSection.width}
                        onCommit={(value) => updateShelf(activeSection.id, activeShelf.id, {
                          width: Math.max(1, Math.min(activeSection.width, value)),
                          sourcePsaFixtureLine: undefined,
                        })}
                      />
                      <FixtureInput
                        label="Height from floor"
                        value={activeShelfElevation}
                        onCommit={(value) => setShelfElevation(activeSection.id, activeShelf.id, value)}
                      />
                      <FixtureInput
                        label="All shelf lengths"
                        value={activeShelf.width ?? activeSection.width}
                        onCommit={editAllShelfLengths}
                      />
                      <span className="ribbon-group-label">Selected shelf & all shelves</span>
                    </div>
                    <div className="ribbon-group">
                      <button className="ribbon-action" onClick={() => arrangeShelfProducts("pack")}>Pack tight</button>
                      <button className="ribbon-action" onClick={() => arrangeShelfProducts("squeeze")}>Squeeze to fit</button>
                      <button className="ribbon-action" onClick={() => arrangeShelfProducts("expand")}>Expand to fill</button>
                      <button className="ribbon-action" onClick={() => arrangeShelfProducts("space")}>Space across</button>
                      <span className="ribbon-group-label">Products on shelf</span>
                    </div>
                    <div className="ribbon-group">
                      <button className="ribbon-action" onClick={() => moveShelfVertically(activeSection.id, activeShelf.id, -1)}><ArrowUp size={17} /> Up 1&quot;</button>
                      <button className="ribbon-action" onClick={() => moveShelfVertically(activeSection.id, activeShelf.id, 1)}><ArrowDown size={17} /> Down 1&quot;</button>
                      <button className="ribbon-action" onClick={distributeShelvesEvenly}>Space evenly</button>
                      <span className="ribbon-group-label">Position</span>
                    </div>
                  </>
                ) : (
                  <div className="ribbon-empty">Select a shelf to edit its length and position.</div>
                )}
              </>
            )}
            {activeRibbonTab === "products" && (
              <>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={() => { setWorkspaceView("library"); setLeftPanelCollapsed(false); }}><Search size={17} /> Image library</button>
                  <button className="ribbon-action" onClick={addProduct}><Plus size={17} /> Add product</button>
                  <button
                    className={`ribbon-action ${copyDrawerOpen ? "active" : ""}`}
                    onClick={() => {
                      setWorkspaceView("planogram");
                      setCopyDrawerOpen((value) => !value);
                      setRightPanelCollapsed(false);
                    }}
                    disabled={pogOptions.length < 2}
                  >
                    <Copy size={17} /> Copy from POG
                  </button>
                  <span className="ribbon-group-label">Image library</span>
                </div>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={syncAllProductsToMasterLibrary}><Layers3 size={17} /> Sync products</button>
                  <button className="ribbon-action" onClick={restoreImagesFromSavedCopies}><RotateCcw size={17} /> Restore images</button>
                  <button className="ribbon-action" onClick={() => void findProductImagesByUpc()} disabled={upcImageStatus === "searching"}><ImagePlus size={17} /> {upcImageStatus === "searching" ? "Finding…" : "Find images"}</button>
                  <button className="ribbon-action" onClick={() => void findProductImagesByUpc(true)} disabled={upcImageStatus === "searching"}><ImagePlus size={17} /> Improve images</button>
                  <button className={`ribbon-action ${autoUpcLookup ? "active" : ""}`} onClick={() => setAutoUpcLookup((value) => !value)}>Auto images {autoUpcLookup ? "on" : "off"}</button>
                  <span className="ribbon-group-label">Product data</span>
                </div>
                <div className="ribbon-group">
                  <label className="ribbon-action file-button">
                    <Upload size={17} /> Products CSV
                    <input type="file" accept=".csv,text/csv" onChange={(e) => { void importCatalogCsv(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <label className="ribbon-action file-button">
                    <Upload size={17} /> Performance CSV
                    <input type="file" accept=".csv,text/csv" onChange={(e) => { void importPerformanceCsv(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <span className="ribbon-group-label">Import data</span>
                </div>
              </>
            )}
            {activeRibbonTab === "analytics" && (
              <>
                <div className="ribbon-group ribbon-metrics linear-inch-metrics">
                  <span><b>{linearSpace.available.toFixed(1)}</b> Available in</span>
                  <span><b>{linearSpace.used.toFixed(1)}</b> Used in</span>
                  <span className={linearSpace.remaining < 0 ? "metric-over" : ""}>
                    <b>{Math.abs(linearSpace.remaining).toFixed(1)}</b>
                    {linearSpace.remaining < 0 ? "Over in" : "Open in"}
                  </span>
                  <span><b>{linearSpace.utilization.toFixed(1)}%</b> Utilized</span>
                  <span className="ribbon-group-label">Linear inches</span>
                </div>
                <div className="ribbon-group">
                  <button
                    className={`ribbon-action ${showSpaceAnalytics ? "active" : ""}`}
                    onClick={() => setShowSpaceAnalytics((value) => !value)}
                  >
                    <Ruler size={18} />
                    {showSpaceAnalytics ? "View planogram" : "Shelf details"}
                  </button>
                  <span className="ribbon-group-label">Space report</span>
                </div>
                <div className="ribbon-group">
                  <button
                    className="ribbon-action"
                    onClick={exportPogProductsCsv}
                    disabled={!pogProductRows.length}
                  >
                    <Download size={18} /> Export POG products
                  </button>
                  <span className="ribbon-group-label">{pogProductRows.length} placed products</span>
                </div>
                <div className="ribbon-group ribbon-note">
                  Used space equals each product&apos;s displayed width multiplied by its facings.
                </div>
              </>
            )}
            {activeRibbonTab === "view" && (
              <>
                <div className="ribbon-group ribbon-navigation-group">
                  <button className="ribbon-action" onClick={fitViewer}>Fit</button>
                  <button className="ribbon-action zoom-step" onClick={() => setViewerZoom(viewZoom - 0.2)} aria-label="Zoom out">−</button>
                  <span className="ribbon-zoom-value">{Math.round(viewZoom * 100)}%</span>
                  <button className="ribbon-action zoom-step" onClick={() => setViewerZoom(viewZoom + 0.2)} aria-label="Zoom in">+</button>
                  <button className="ribbon-action" onClick={() => setViewerZoom(1)}>100%</button>
                  <button
                    className={`ribbon-action ${panMode ? "active" : ""}`}
                    onClick={() => setPanMode((value) => !value)}
                    aria-pressed={panMode}
                    title="Drag the planogram to move around"
                  >
                    <Hand size={17} /> Pan
                  </button>
                  <span className="ribbon-group-label">Zoom &amp; navigation</span>
                </div>
                <div className="ribbon-group">
                  <button className={`ribbon-action ${plan.autoArrange !== false ? "active" : ""}`} onClick={() => updatePlan((p) => ({ ...p, autoArrange: p.autoArrange === false }))}>Auto arrange</button>
                  <button className={`ribbon-action ${multiSelectMode ? "active" : ""}`} onClick={() => setMultiSelectMode((value) => !value)}>Multi-select</button>
                  <button className={`ribbon-action ${plan.showWarnings !== false ? "active" : ""}`} onClick={() => updatePlan((p) => ({ ...p, showWarnings: p.showWarnings === false }))}>Warnings {plan.showWarnings !== false ? "on" : "off"}</button>
                  <span className="ribbon-group-label">Display</span>
                </div>
                <div className="ribbon-group ribbon-color-group">
                  <label className="color-mode">
                    <span>Color by</span>
                    <select value={plan.colorMode ?? "none"} onChange={(e) => updatePlan((p) => ({ ...p, colorMode: e.target.value as ColorMode }))}>
                      <option value="none">None</option><option value="colorGroup">Custom group</option><option value="manufacturer">Manufacturer</option><option value="brand">Brand</option><option value="size">Package width</option><option value="facings">Facings heat map</option><option value="capacity">Capacity heat map</option><option value="sales">Sales performance</option><option value="units">Unit sales</option><option value="velocity">Sales velocity</option><option value="profit">Profit</option><option value="growth">Growth</option>
                    </select>
                  </label>
                  {plan.colorMode !== "none" && <button className={`ribbon-action ${showSolidColors ? "active" : ""}`} onClick={() => updatePlan((p) => ({ ...p, hideImagesForColor: !p.hideImagesForColor }))}>{showSolidColors ? "Show images" : "Show colors"}</button>}
                  <span className="ribbon-group-label">Color coding</span>
                </div>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={() => setLeftPanelCollapsed((value) => !value)}>{leftPanelCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />} Library panel</button>
                  <button className="ribbon-action" onClick={() => setRightPanelCollapsed((value) => !value)}>{rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />} Details panel</button>
                  <span className="ribbon-group-label">Panels</span>
                </div>
              </>
            )}
            {activeRibbonTab === "export" && (
              <>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={() => void exportPogx()}><Save size={17} /> POGX</button>
                  <button className="ribbon-action" onClick={() => void exportPsaFile()}><Download size={17} /> PSA</button>
                  <button className="ribbon-action" onClick={printPlanogram}><FileText size={17} /> PDF</button>
                  <button className="ribbon-action" onClick={() => void exportPlanogramImage()} disabled={exporting}><Download size={17} /> {exporting ? "Creating…" : "PNG"}</button>
                  <span className="ribbon-group-label">Save as</span>
                </div>
                <div className="ribbon-group">
                  <button className="ribbon-action" onClick={exportEnterpriseData}><Download size={17} /> Enterprise data</button>
                  <button className="ribbon-action" onClick={exportCatalogCsv}><Download size={17} /> Products CSV</button>
                  <span className="ribbon-group-label">Data</span>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {workspaceView === "analytics" ? (
        <section className="analytics-dashboard">
          <div className="analytics-heading">
            <div><span className="eyebrow">OWNER VIEW</span><h1>Beta Analytics</h1><p>Usage and reliability signals only; planogram contents are not collected.</p></div>
            <div className="analytics-filters">
              <label><span>People</span><select value={analyticsAudience} onChange={(event) => { const value = event.target.value as "all" | "owner" | "testers"; setAnalyticsAudience(value); void loadAnalytics(analyticsDays, value); }}><option value="testers">Beta testers</option><option value="owner">Owner</option><option value="all">Everyone</option></select></label>
              <label><span>Period</span><select value={analyticsDays} onChange={(event) => { const value = Number(event.target.value); setAnalyticsDays(value); void loadAnalytics(value, analyticsAudience); }}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
              <button onClick={() => void loadAnalytics()} disabled={analyticsLoading}>{analyticsLoading ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>
          <div className="analytics-metrics">
            <article><b>{Number(analyticsData?.summary.testers ?? 0).toLocaleString()}</b><span>{analyticsAudience === "owner" ? "Owner active" : analyticsAudience === "all" ? "Active people" : "Active testers"}</span></article>
            <article><b>{Number(analyticsData?.summary.sessions ?? 0).toLocaleString()}</b><span>Sessions</span></article>
            <article><b>{Number(analyticsData?.summary.actions ?? 0).toLocaleString()}</b><span>Meaningful actions</span></article>
            <article className={Number(analyticsData?.summary.errors ?? 0) ? "needs-attention" : ""}><b>{Number(analyticsData?.summary.errors ?? 0).toLocaleString()}</b><span>Errors</span></article>
          </div>
          <section className="analytics-journey">
            <div><h2>Completion journey</h2><p className="analytics-help">Shows how far people progressed during the selected period.</p></div>
            <div className="analytics-journey-steps">{["Opened", "Started work", "Edited", "Saved", "Exported"].map((stage) => { const item = analyticsData?.journey?.find((row) => row.stage === stage); return <article key={stage}><b>{Number(item?.testers ?? 0)}</b><span>{stage}</span><small>{Number(item?.events ?? 0).toLocaleString()} events</small></article>; })}</div>
          </section>
          <div className="analytics-grid">
            <section><h2>Tester activity</h2><div className="analytics-table"><table><thead><tr><th>Tester</th><th>Role</th><th>Sessions</th><th>Actions</th><th>Errors</th><th>Last active</th></tr></thead><tbody>{(analyticsData?.users ?? []).map((row) => <tr key={row.email}><td>{row.email}</td><td>{row.role}</td><td>{row.sessions}</td><td>{row.actions}</td><td>{row.errors}</td><td>{new Date(row.last_seen).toLocaleString()}</td></tr>)}{!analyticsData?.users?.length && <tr><td colSpan={6}>No activity for this audience and period.</td></tr>}</tbody></table></div></section>
            <section><h2>Confirmed friction</h2><p className="analytics-help">Only failed actions, errors and searches with no results appear here.</p><div className="analytics-table"><table><thead><tr><th>Action</th><th>Result</th><th>Times</th><th>People</th></tr></thead><tbody>{(analyticsData?.friction ?? []).map((row, index) => <tr key={`${row.action}-${row.outcome}-${index}`}><td>{formatAnalyticsAction(row.action)}</td><td><span className={`analytics-outcome ${row.outcome}`}>{row.outcome}</span></td><td>{row.count}</td><td>{row.testers}</td></tr>)}{!analyticsData?.friction?.length && <tr><td colSpan={4}>No confirmed friction signals.</td></tr>}</tbody></table></div></section>
          </div>
          <section className="analytics-errors"><div className="analytics-section-heading"><div><h2>Grouped errors</h2><p className="analytics-help">Repeated copies are combined so one underlying problem does not fill the list.</p></div><span>{Number(analyticsData?.summary.saves ?? 0).toLocaleString()} background saves excluded from actions</span></div><div className="analytics-table"><table><thead><tr><th>Area</th><th>Occurrences</th><th>People</th><th>Last seen</th></tr></thead><tbody>{(analyticsData?.recentErrors ?? []).map((row, index) => <tr key={`${row.action}-${index}`}><td>{formatAnalyticsAction(row.action)}</td><td>{row.count}</td><td>{row.testers}</td><td>{new Date(row.last_seen).toLocaleString()}</td></tr>)}{!analyticsData?.recentErrors?.length && <tr><td colSpan={4}>No errors recorded.</td></tr>}</tbody></table></div></section>
        </section>
      ) : showSpaceAnalytics || workspaceView === "pogProducts" ? (
        <section className={`space-analytics-dashboard ${workspaceView === "pogProducts" ? "pog-products-dashboard" : ""}`}>
          <div className="space-analytics-heading">
            <div>
              <span className="eyebrow">CURRENT PLANOGRAM</span>
              <h1>{workspaceView === "pogProducts" ? "POG Product Library" : "Sales and space allocation"}</h1>
              <p>{workspaceView === "pogProducts" ? `${plan.title} · Products currently placed in this planogram.` : `${plan.title} · Compare each group's performance share with its share of occupied linear inches.`}</p>
            </div>
            {workspaceView !== "pogProducts" && <button onClick={() => setShowSpaceAnalytics(false)}>Back to planogram</button>}
          </div>
          {workspaceView !== "pogProducts" && <>
          <section className="space-analysis-controls">
            <label>
              <span>Performance measure</span>
              <select value={spaceMetric} onChange={(event) => setSpaceMetric(event.target.value as SpaceMetric)}>
                <option value="sales">Dollar sales</option>
                <option value="units">Unit sales</option>
                <option value="velocity">Unit velocity</option>
              </select>
            </label>
            {[0, 1, 2].map((level) => (
              <label key={level}>
                <span>Group {level + 1}</span>
                <select
                  value={spaceGroups[level] ?? ""}
                  onChange={(event) => setSpaceGroupLevel(level, event.target.value)}
                  disabled={level > 0 && !spaceGroups[level - 1]}
                >
                  <option value="">None</option>
                  {spaceGroupOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={spaceGroups.some((field, index) => index !== level && field === option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button onClick={addCustomProductColumn}><Plus size={16} /> Add product column</button>
            <button onClick={exportSpaceAnalysisCsv}><Download size={16} /> Export analysis</button>
          </section>
          <section className="analytics-view-controls" aria-label="Saved analytics views">
            <label>
              <span>Saved view</span>
              <select value={savedAnalyticsViewId} onChange={(event) => setSavedAnalyticsViewId(event.target.value)}>
                <option value="">Choose a saved view…</option>
                {(workspace.analyticsViews ?? []).map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
              </select>
            </label>
            <button onClick={applyAnalyticsView} disabled={!savedAnalyticsViewId}>Apply</button>
            <button onClick={saveAnalyticsView}>Save current view</button>
            <button className="quiet-danger" onClick={deleteAnalyticsView} disabled={!savedAnalyticsViewId}>Delete</button>
          </section>
          <div className="space-analytics-metrics">
            <article><b>{linearSpace.used.toFixed(1)}&quot;</b><span>Occupied linear inches</span></article>
            <article><b>{spaceMetric === "sales" ? spaceMetricTotal.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : spaceMetricTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><span>{spaceMetric === "sales" ? "Dollar sales" : spaceMetric === "units" ? "Unit sales" : "Unit velocity"}</span></article>
            <article><b>{spaceProductsWithMetric}</b><span>Products with performance data</span></article>
            <article className={spaceProductsWithMetric < pogProductRows.length ? "needs-attention" : ""}><b>{pogProductRows.length - spaceProductsWithMetric}</b><span>Products missing performance</span></article>
          </div>
          <section className="space-analytics-section space-allocation-table">
            <div className="space-table-heading">
              <div>
                <h2>Performance versus space</h2>
                <p>Index 100 means performance share equals space share. Positive share gaps indicate an under-spaced opportunity.</p>
              </div>
            </div>
            <div className="analytics-table">
              <table>
                <thead><tr><th>Group / product</th><th>Products</th><th>Linear inches</th><th>Space share</th><th>{spaceMetric === "sales" ? "Dollar sales" : spaceMetric === "units" ? "Unit sales" : "Unit velocity"}</th><th>Performance share</th><th>Index</th><th>Share gap</th></tr></thead>
                <tbody>
                  {spaceHierarchyRows.map((displayRow) => {
                    const isGroup = displayRow.kind === "group";
                    const linearInches = isGroup ? displayRow.node.linearInches : displayRow.row.linearInches;
                    const performance = isGroup
                      ? displayRow.node.performance
                      : Number(displayRow.row.product.performance?.[spaceMetric]);
                    const validPerformance = Number.isFinite(performance);
                    const spaceShare = linearSpace.used > 0 ? (linearInches / linearSpace.used) * 100 : 0;
                    const performanceShare = validPerformance && spaceMetricTotal > 0 ? (performance / spaceMetricTotal) * 100 : 0;
                    const index = validPerformance && spaceShare > 0 ? (performanceShare / spaceShare) * 100 : null;
                    const gap = validPerformance ? performanceShare - spaceShare : null;
                    const level = isGroup ? displayRow.node.level : displayRow.level;
                    return (
                      <tr key={isGroup ? displayRow.node.path : `product-${displayRow.row.product.id}-${level}`} className={isGroup ? "space-group-row" : "space-product-row"}>
                        <td>
                          <div className="space-group-label" style={{ paddingLeft: `${level * 20}px` }}>
                            {isGroup ? (
                              <button
                                onClick={() => setExpandedSpaceGroups((current) => current.includes(displayRow.node.path) ? current.filter((path) => path !== displayRow.node.path) : [...current, displayRow.node.path])}
                                aria-label={expandedSpaceGroups.includes(displayRow.node.path) ? "Collapse group" : "Expand group"}
                              >{expandedSpaceGroups.includes(displayRow.node.path) ? "−" : "+"}</button>
                            ) : <span className="space-product-dot" />}
                            <b>{isGroup ? displayRow.node.label : displayRow.row.product.name}</b>
                          </div>
                        </td>
                        <td>{isGroup ? displayRow.node.products : 1}</td>
                        <td>{linearInches.toFixed(1)}&quot;</td>
                        <td>{spaceShare.toFixed(1)}%</td>
                        <td>{validPerformance ? (spaceMetric === "sales" ? performance.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : performance.toLocaleString(undefined, { maximumFractionDigits: 1 })) : "—"}</td>
                        <td>{validPerformance ? `${performanceShare.toFixed(1)}%` : "—"}</td>
                        <td>{index === null ? "—" : Math.round(index)}</td>
                        <td className={gap === null ? "" : gap > 0 ? "space-opportunity" : gap < 0 ? "space-over" : ""}>{gap === null ? "—" : `${gap > 0 ? "+" : ""}${gap.toFixed(1)} pts`}</td>
                      </tr>
                    );
                  })}
                  {!spaceHierarchyRows.length && <tr><td colSpan={8}>No products are placed in this planogram yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-analytics-section">
            <h2>Fixture utilization by section</h2>
            <div className="analytics-table">
              <table>
                <thead><tr><th>Section</th><th>Shelves</th><th>Available</th><th>Used</th><th>Open / over</th><th>Utilization</th></tr></thead>
                <tbody>{linearSpace.sections.map((section) => (
                  <tr key={section.id}>
                    <td>{section.name}</td><td>{section.shelves}</td><td>{section.available.toFixed(1)}&quot;</td><td>{section.used.toFixed(1)}&quot;</td>
                    <td className={section.remaining < 0 ? "space-over" : ""}>{section.remaining < 0 ? `${Math.abs(section.remaining).toFixed(1)}\" over` : `${section.remaining.toFixed(1)}\" open`}</td>
                    <td><div className="space-utilization"><span><i style={{ width: `${Math.min(100, section.utilization)}%` }} className={section.utilization > 100 ? "over" : ""} /></span><b>{section.utilization.toFixed(1)}%</b></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="space-analytics-section">
            <h2>By shelf</h2>
            <div className="analytics-table">
              <table>
                <thead><tr><th>Section</th><th>Shelf</th><th>Available</th><th>Used</th><th>Open / over</th><th>Utilization</th></tr></thead>
                <tbody>{linearSpace.shelves.map((shelf) => (
                  <tr key={`${shelf.sectionId}-${shelf.id}`}>
                    <td>{shelf.sectionName}</td><td>{shelf.shelfName}</td><td>{shelf.available.toFixed(1)}&quot;</td><td>{shelf.used.toFixed(1)}&quot;</td>
                    <td className={shelf.remaining < 0 ? "space-over" : ""}>{shelf.remaining < 0 ? `${Math.abs(shelf.remaining).toFixed(1)}\" over` : `${shelf.remaining.toFixed(1)}\" open`}</td>
                    <td><div className="space-utilization"><span><i style={{ width: `${Math.min(100, shelf.utilization)}%` }} className={shelf.utilization > 100 ? "over" : ""} /></span><b>{shelf.utilization.toFixed(1)}%</b></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="space-analytics-section data-quality-section">
            <div className="space-table-heading">
              <div>
                <h2>Data quality</h2>
                <p>{pogProductQualityRows.filter((row) => !row.issues.length).length} ready · {pogProductQualityRows.filter((row) => row.issues.length).length} need attention. Performance checks follow the selected measure.</p>
              </div>
              <button
                onClick={() => {
                  setPogProductFilter("missing");
                  setPogProductQuery("");
                  document.getElementById("pog-products-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={!pogProductQualityRows.some((row) => row.issues.length)}
              >Review missing fields</button>
            </div>
            <div className="data-quality-chips">
              {pogProductIssueCounts.map(([issue, count]) => <button key={issue} onClick={() => {
                setPogProductFilter("missing");
                setPogProductQuery("");
                document.getElementById("pog-products-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}><b>{count}</b> missing {issue}</button>)}
              {!pogProductIssueCounts.length && <span className="data-quality-complete">All checked fields are complete.</span>}
            </div>
            {!!pogProductQualityRows.some((row) => row.issues.length) && (
              <div className="data-quality-products">
                {pogProductQualityRows.filter((row) => row.issues.length).slice(0, 8).map((row) => (
                  <button key={row.product.id} onClick={() => openProductQualityIssue(row.product.id, row.product.name)}>
                    <span>{row.product.name}</span><small>{row.issues.join(" · ")}</small>
                  </button>
                ))}
                {pogProductQualityRows.filter((row) => row.issues.length).length > 8 && <span>+{pogProductQualityRows.filter((row) => row.issues.length).length - 8} more</span>}
              </div>
            )}
          </section>
          </>}
          <section className="space-analytics-section">
            <div className="space-table-heading">
              <div>
                <h2>Products in this POG</h2>
                <p>{pogProductRows.length} unique products currently placed. Edit here, then sync approved fields to the master library.</p>
              </div>
              <div className="space-table-actions">
                <button onClick={() => setEditingPogProducts((value) => !value)}>{editingPogProducts ? "Done editing" : "Edit fields"}</button>
                <button onClick={addCustomProductColumn}><Plus size={16} /> Add column</button>
                <button onClick={syncPogFieldsToMasterLibrary} disabled={!pogProductRows.length}><Layers3 size={16} /> Sync to master</button>
                <button onClick={exportPogProductsCsv} disabled={!pogProductRows.length}><Download size={16} /> Export CSV</button>
              </div>
            </div>
            <div className="pog-product-toolbar">
              <label className="pog-product-search">
                <span>Search products</span>
                <input value={pogProductQuery} onChange={(event) => setPogProductQuery(event.target.value)} placeholder="Name, UPC, brand, category…" />
              </label>
              <label><span>Show</span><select value={pogProductFilter} onChange={(event) => setPogProductFilter(event.target.value as "all" | "missing" | "complete")}><option value="all">All products</option><option value="missing">Needs attention</option><option value="complete">Complete only</option></select></label>
              <label><span>Sort by</span><select value={pogProductSort} onChange={(event) => setPogProductSort(event.target.value as "name" | "manufacturer" | "linear" | "sales" | "spaceIndex")}><option value="name">Product name</option><option value="manufacturer">Manufacturer</option><option value="linear">Linear inches</option><option value="sales">Dollar sales</option><option value="spaceIndex">Performance / space index</option></select></label>
              <span className="pog-product-count">
                Showing {renderedPogProductRows.length} of {visiblePogProductRows.length}
                {visiblePogProductRows.length !== pogProductRows.length ? ` filtered (${pogProductRows.length} total)` : ""}
              </span>
            </div>
            {selectedPogProductIds.length > 0 && (
              <div className="bulk-dimension-editor" role="group" aria-label="Bulk product dimensions">
                <strong>{selectedPogProductIds.length} selected</strong>
                <span>Change selected products</span>
                {(["width", "height", "depth"] as const).map((field) => (
                  <label key={field}>
                    <span>{field[0].toUpperCase() + field.slice(1)}</span>
                    <div>
                      <input
                        value={bulkDimensions[field]}
                        onChange={(event) => setBulkDimensions((current) => ({ ...current, [field]: event.target.value }))}
                        inputMode="decimal"
                        placeholder="No change"
                        aria-label={`${field} in inches`}
                      />
                      <b>in</b>
                    </div>
                  </label>
                ))}
                <button onClick={applyBulkProductDimensions}>Apply dimensions</button>
                <button className="secondary" onClick={() => setSelectedPogProductIds([])}>Clear selection</button>
              </div>
            )}
            <div className="analytics-table" id="pog-products-table">
              <table>
                <thead><tr><th className="pog-product-select"><input type="checkbox" checked={renderedPogProductRows.length > 0 && renderedPogProductRows.every((row) => selectedPogProductIds.includes(row.product.id))} onChange={toggleAllVisiblePogProducts} aria-label="Select all shown products" title="Select all shown products" /></th><th>Product</th><th>UPC</th><th>SKU / ID</th><th>Brand</th><th>Manufacturer</th><th>Category</th><th>Subcategory</th>{(workspace.customProductColumns ?? []).map((column) => <th key={column}>{column}</th>)}<th>Description</th><th>Price</th><th>Width</th><th>Height</th><th>Depth</th><th>Units / facing</th><th>Facings</th><th>Capacity</th><th>Linear inches</th><th>Sections</th><th>Shelves</th></tr></thead>
                <tbody>
                  {renderedPogProductRows.map((row) => (
                    <tr key={row.product.id} id={`pog-product-${row.product.id}`} className={selectedPogProductIds.includes(row.product.id) ? "selected-pog-product" : ""}>
                      <td className="pog-product-select"><input type="checkbox" checked={selectedPogProductIds.includes(row.product.id)} onChange={() => togglePogProductSelection(row.product.id)} aria-label={`Select ${row.product.name}`} /></td>
                      <td className="pog-product-name">
                        {row.product.image ? <img src={row.product.image} alt="" /> : <span className="pog-product-placeholder"><Box size={15} /></span>}
                        {editingPogProducts ? <input key={`name-${row.product.id}-${row.product.name}`} defaultValue={row.product.name} onBlur={(event) => updatePogProductField(row.product.id, "name", event.target.value)} /> : <b>{row.product.name}</b>}
                      </td>
                      <td className="pog-product-upc">{editingPogProducts ? <input key={`upc-${row.product.id}-${row.product.upc}`} defaultValue={row.product.upc} inputMode="numeric" onBlur={(event) => updatePogProductField(row.product.id, "upc", event.target.value)} /> : row.product.upc || "—"}</td>
                      <td>{editingPogProducts ? <input key={`sku-${row.product.id}-${row.product.sku}`} defaultValue={row.product.sku} onBlur={(event) => updatePogProductField(row.product.id, "sku", event.target.value)} /> : row.product.sku || "—"}</td>
                      <td>{editingPogProducts ? <input key={`brand-${row.product.id}-${row.product.brand}`} defaultValue={row.product.brand} onBlur={(event) => updatePogProductField(row.product.id, "brand", event.target.value)} /> : row.product.brand || "—"}</td>
                      <td>{editingPogProducts ? <input key={`manufacturer-${row.product.id}-${row.product.manufacturer}`} defaultValue={row.product.manufacturer} onBlur={(event) => updatePogProductField(row.product.id, "manufacturer", event.target.value)} /> : row.product.manufacturer || "—"}</td>
                      <td>{editingPogProducts ? <input key={`category-${row.product.id}-${row.product.category}`} defaultValue={row.product.category} onBlur={(event) => updatePogProductField(row.product.id, "category", event.target.value)} /> : row.product.category || "—"}</td>
                      <td>{editingPogProducts ? <input key={`subcategory-${row.product.id}-${row.product.subcategory}`} defaultValue={row.product.subcategory} onBlur={(event) => updatePogProductField(row.product.id, "subcategory", event.target.value)} /> : row.product.subcategory || "—"}</td>
                      {(workspace.customProductColumns ?? []).map((column) => <td key={column}>{editingPogProducts ? <input key={`${column}-${row.product.id}-${row.product.customFields?.[column] ?? ""}`} defaultValue={row.product.customFields?.[column] ?? ""} onBlur={(event) => updatePogCustomField(row.product.id, column, event.target.value)} /> : row.product.customFields?.[column] || "—"}</td>)}
                      <td>{editingPogProducts ? <input className="wide" key={`description-${row.product.id}-${row.product.description}`} defaultValue={row.product.description} onBlur={(event) => updatePogProductField(row.product.id, "description", event.target.value)} /> : row.product.description || "—"}</td>
                      <td>{editingPogProducts ? <input className="number" key={`price-${row.product.id}-${row.product.price}`} defaultValue={row.product.price} inputMode="decimal" onBlur={(event) => updatePogProductField(row.product.id, "price", Math.max(0, Number(event.target.value) || 0))} /> : row.product.price.toFixed(2)}</td>
                      <td>{editingPogProducts ? <input className="number" key={`width-${row.product.id}-${row.product.width}`} defaultValue={row.product.width} inputMode="decimal" onBlur={(event) => updatePogProductField(row.product.id, "width", Math.max(.1, Number(event.target.value) || .1))} /> : `${row.product.width}\"`}</td>
                      <td>{editingPogProducts ? <input className="number" key={`height-${row.product.id}-${row.product.height}`} defaultValue={row.product.height} inputMode="decimal" onBlur={(event) => updatePogProductField(row.product.id, "height", Math.max(.1, Number(event.target.value) || .1))} /> : `${row.product.height}\"`}</td>
                      <td>{editingPogProducts ? <input className="number" key={`depth-${row.product.id}-${row.product.depth}`} defaultValue={row.product.depth} inputMode="decimal" onBlur={(event) => updatePogProductField(row.product.id, "depth", Math.max(.1, Number(event.target.value) || .1))} /> : `${row.product.depth}\"`}</td>
                      <td>{editingPogProducts ? <input className="number" key={`units-${row.product.id}-${row.product.unitsPerFacing}`} defaultValue={row.product.unitsPerFacing ?? 1} inputMode="numeric" onBlur={(event) => updatePogProductField(row.product.id, "unitsPerFacing", Math.max(1, Math.round(Number(event.target.value) || 1)))} /> : row.product.unitsPerFacing ?? 1}</td>
                      <td>{row.facings}</td>
                      <td>{row.capacity}</td>
                      <td>{row.linearInches.toFixed(1)}&quot;</td>
                      <td>{[...row.sections].join(", ")}</td>
                      <td>{row.shelves.size}</td>
                    </tr>
                  ))}
                  {!renderedPogProductRows.length && <tr><td colSpan={20 + (workspace.customProductColumns?.length ?? 0)}>{pogProductRows.length ? "No products match these filters." : "No products are placed in this planogram yet."}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          {workspaceView !== "pogProducts" && <p className="space-analytics-footnote">Available space is the total of the current shelf lengths. Used space is displayed product width × facings; rotated and side-facing products use their displayed width.</p>}
        </section>
      ) : (
      <section className={`workspace ${workspaceView === "library" ? "library-focus" : "planogram-focus"} ${leftPanelCollapsed ? "left-collapsed" : ""} ${rightPanelCollapsed ? "right-collapsed" : ""}`}>
        <aside className={`library panel ${leftPanelCollapsed ? "panel-collapsed" : ""}`}>
          <button className="panel-collapse-control left" onClick={() => setLeftPanelCollapsed((value) => !value)} aria-label={leftPanelCollapsed ? "Open image library" : "Collapse image library"} title={leftPanelCollapsed ? "Open image library" : "Collapse image library"}>
            {leftPanelCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>Images</span>
          </button>
          {!leftPanelCollapsed && (
            <>
          <div className="pog-manager">
            <span className="eyebrow">MY PLANOGRAMS</span>
            <div className="pog-select-row">
              <select
                value={plan.id}
                onChange={(e) => void switchPog(e.target.value)}
                disabled={Boolean(switchingPogId)}
              >
                {pogOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button
                onClick={createPog}
                title="New planogram"
                aria-label="New planogram"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="pog-actions">
              <button onClick={duplicatePog}>
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={deletePog}
                disabled={pogOptions.length === 1}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
            {!!workspace.trash?.length && (
              <details className="pog-recycle-bin">
                <summary>Recently deleted ({workspace.trash.length})</summary>
                <div>
                  {[...workspace.trash]
                    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
                    .map((deleted) => (
                      <button
                        key={deleted.id}
                        onClick={() => restoreDeletedPog(deleted.id)}
                      >
                        <span>
                          <b>{deleted.planogram.title}</b>
                          <small>
                            Deleted{" "}
                            {new Date(deleted.deletedAt).toLocaleDateString()}
                          </small>
                        </span>
                        Restore
                      </button>
                    ))}
                </div>
              </details>
            )}
          </div>
          <div className="panel-head">
            <div>
              <span className="eyebrow">IMAGE LIBRARY</span>
              <h2>{plan.products.length} products</h2>
            </div>
            <button
              className="square-add"
              onClick={addProduct}
              aria-label="Add product"
            >
              <Plus size={19} />
            </button>
          </div>
          <div className="search">
            <Search size={16} />
            <input
              placeholder="Search name, brand or UPC"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="product-list">
            {renderedProducts.map((item) => (
              <button
                draggable
                key={item.id}
                className={`product-row ${selected === item.id ? "active" : ""}`}
                onDragStart={(e) =>
                  e.dataTransfer.setData("productId", item.id)
                }
                onClick={() => setSelected(item.id)}
              >
                <div
                  className="thumb"
                  style={{ background: item.image ? "white" : item.color }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ transform: productImageTransform(item) }}
                    />
                  ) : (
                    <Box size={22} />
                  )}
                </div>
                <div className="product-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {item.brand || "No brand"} · {item.width}&quot; ×{" "}
                    {item.height}&quot;
                  </span>
                </div>
                <GripVertical size={17} />
              </button>
            ))}
            {filtered.length > renderedProducts.length && (
              <p className="product-list-more">
                Showing first {renderedProducts.length} of {filtered.length}. Search to narrow the list.
              </p>
            )}
          </div>
          <button className="add-wide" onClick={addProduct}>
            <Plus size={17} /> Add a product
          </button>
            </>
          )}
        </aside>
        <section className="canvas-panel">
          <div className="print-header">
            <span>PLANOGRAM STUDIO PRO</span>
            <h1>{plan.title}</h1>
            <p>
              {[plan.clientName, plan.locationName].filter(Boolean).join(" · ")}
            </p>
            <p className="print-reference">
              {[
                plan.retailerName,
                plan.planogramCode ? "POG " + plan.planogramCode : "",
                plan.effectiveDate
                  ? "Effective " +
                    new Date(
                      plan.effectiveDate + "T00:00:00",
                    ).toLocaleDateString()
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <small>
              {plan.fixtureWidth.toFixed(1).replace(/\.0$/, "")}&quot; W ×{" "}
              {plan.fixtureHeight}&quot; H · {plan.sections.length} sections ·{" "}
              {allShelves.length} shelves · {capacity} units
            </small>
          </div>
          <details className="project-meta">
            <summary>Project details &amp; versions</summary>
            <div className="project-meta-body">
              <div className="project-meta-grid">
                <label>
                  <span>Client / company</span>
                  <input
                    value={plan.clientName ?? ""}
                    placeholder="Client name"
                    onChange={(e) =>
                      updatePlan((p) => ({ ...p, clientName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Store / location</span>
                  <input
                    value={plan.locationName ?? ""}
                    placeholder="Store or location"
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        locationName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Retailer</span>
                  <input
                    value={plan.retailerName ?? ""}
                    placeholder="Retailer name"
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        retailerName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Planogram code</span>
                  <input
                    value={plan.planogramCode ?? ""}
                    placeholder="POG ID or code"
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        planogramCode: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Effective date</span>
                  <input
                    type="date"
                    value={plan.effectiveDate ?? ""}
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        effectiveDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="project-notes">
                  <span>Project notes</span>
                  <input
                    value={plan.projectNotes ?? ""}
                    placeholder="Optional notes"
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        projectNotes: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="commercial-tools">
                <div className="version-tools">
                  <button onClick={saveNamedVersion}>
                    <Save size={15} /> Save restore point
                  </button>
                  <select
                    aria-label="Saved restore points"
                    value={versionChoice}
                    onChange={(e) => setVersionChoice(e.target.value)}
                  >
                    <option value="">Choose saved version…</option>
                    {planVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.name} ·{" "}
                        {new Date(version.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={restoreNamedVersion}
                    disabled={!versionChoice}
                  >
                    Restore
                  </button>
                </div>
              </div>
              {upcImageMessage && (
                <p className={`catalog-lookup-status ${upcImageStatus}`} role="status">
                  {upcImageMessage}
                </p>
              )}
              <p className="version-note">
                Up to 10 named restore points are kept for each planogram. Product
                tools are available on the Products ribbon; backups and downloads
                are available on the Export ribbon.
              </p>
              {plan.sourceFormat === "psa" && (
                <p className="version-note">
                  <strong>PSA source:</strong> {plan.sourceFileName} · version{" "}
                  {plan.sourceVersion}. Products, shelves, sections, positions,
                  dimensions, orientations and capacity were imported. Product
                  images are matched from your library by UPC, SKU or exact name.
                  {!!plan.importWarnings?.length && (
                    <> · {plan.importWarnings.join(" ")}</>
                  )}
                </p>
              )}
            </div>
          </details>
          {plan.showWarnings !== false && <details className="validation-center">
            <summary>
              <span>Planogram quality</span>
              <b
                className={
                  validationScore >= 90
                    ? "ready"
                    : validationScore >= 70
                      ? "review"
                      : "blocked"
                }
              >
                {validationScore}% ·{" "}
                {validationScore >= 90 ? "Ready" : "Review"}
              </b>
            </summary>
            <div className="validation-body">
              {validationIssues.length ? (
                validationIssues.slice(0, 30).map((issue, index) => (
                  <p className={issue.level} key={index}>
                    <i />
                    {issue.message}
                  </p>
                ))
              ) : (
                <p className="ready-message">No quality issues found.</p>
              )}
              {validationIssues.length > 30 && (
                <small>
                  {validationIssues.length - 30} more issues not shown.
                </small>
              )}
            </div>
          </details>}
          <div className="canvas-toolbar">
            <div>
              <span className="eyebrow">ACTIVE PLANOGRAM</span>
              <h1>{plan.title}</h1>
              <small className="mobile-help">
                Tap a product, then tap any shelf—even in another section
              </small>
            </div>
            <div className="fixture-controls">
              <FixtureInput
                label="Total width"
                value={plan.fixtureWidth}
                onCommit={(value) => editFixture("fixtureWidth", value)}
              />
              <FixtureInput
                label="Total height"
                value={plan.fixtureHeight}
                onCommit={(value) => editFixture("fixtureHeight", value)}
              />
            </div>
            <div className="metrics">
              <span>
                <b>{plan.sections.length}</b> sections
              </span>
              <span>
                <b>{allShelves.length}</b> shelves
              </span>
              <span>
                <b>{facings}</b> facings
              </span>
              <span>
                <b>{capacity}</b> capacity
              </span>
            </div>
            <label className="color-mode">
              <span>Color by</span>
              <select
                value={plan.colorMode ?? "none"}
                onChange={(e) =>
                  updatePlan((p) => ({
                    ...p,
                    colorMode: e.target.value as ColorMode,
                  }))
                }
              >
                <option value="none">None</option>
                <option value="colorGroup">Custom group</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="brand">Brand</option>
                <option value="size">Package width</option>
                <option value="facings">Facings heat map</option>
                <option value="capacity">Capacity heat map</option>
                <option value="sales">Sales performance</option>
                <option value="units">Unit sales</option>
                <option value="velocity">Sales velocity</option>
                <option value="profit">Profit</option>
                <option value="growth">Growth</option>
              </select>
            </label>
            {plan.colorMode !== "none" && (
              <button
                className={`secondary color-view-toggle ${showSolidColors ? "active" : ""}`}
                onClick={() =>
                  updatePlan((p) => ({
                    ...p,
                    hideImagesForColor: !p.hideImagesForColor,
                  }))
                }
                aria-pressed={showSolidColors}
                title={
                  showSolidColors
                    ? "Show product images with color outlines"
                    : "Hide product images and fill products with their assigned colors"
                }
              >
                {showSolidColors ? "Colors" : "Images"}
              </button>
            )}
            <button
              className={`secondary multi-select-toggle ${multiSelectMode ? "active" : ""}`}
              onClick={() => {
                setMultiSelectMode((value) => !value);
                if (multiSelectMode) setSelectedPlacements([]);
              }}
            >
              {multiSelectMode
                ? `${selectedPlacements.length} selected`
                : "Multi-select"}
            </button>
            <button
              className={`secondary warnings-toggle ${plan.showWarnings !== false ? "active" : ""}`}
              onClick={() =>
                updatePlan((p) => ({
                  ...p,
                  showWarnings: p.showWarnings === false,
                }))
              }
              aria-pressed={plan.showWarnings !== false}
            >
              Warnings {plan.showWarnings !== false ? "on" : "off"}
            </button>
            <button
              className="secondary export-image"
              onClick={() => void exportPlanogramImage()}
              disabled={exporting}
            >
              <Download size={16} />
              {exporting ? "Creating…" : "Export PNG"}
            </button>
            <button className="secondary print-pdf" onClick={printPlanogram}>
              <FileText size={16} /> Print / PDF
            </button>
            <button className="secondary add-shelf" onClick={addShelf}>
              <Plus size={16} /> Add shelf
            </button>
          </div>
          {!!colorLegend.length && (
            <>
              <div className="color-legend" aria-label="Planogram color legend">
                <b>
                  {performanceModes.includes(plan.colorMode ?? "none") ||
                  plan.colorMode === "facings" ||
                  plan.colorMode === "capacity"
                    ? "Heat map"
                    : "Color groups"}
                </b>
                {colorLegend.map((entry) => (
                  <span key={entry.label}>
                    <i style={{ background: entry.color }} />
                    {entry.label}
                  </span>
                ))}
              </div>
              {["colorGroup", "manufacturer", "brand", "size"].includes(
                plan.colorMode ?? "",
              ) && (
                <details className="color-rule-manager">
                  <summary>Manage colors &amp; templates</summary>
                  <div className="color-rule-grid">
                    {colorLegend.map((entry) => (
                      <div className="color-rule-row" key={entry.label}>
                        <input
                          type="color"
                          value={entry.color}
                          aria-label={"Color for " + entry.label}
                          onInput={(event) =>
                            setRuleColor(entry.label, event.target.value)
                          }
                        />
                        {plan.colorMode === "colorGroup" &&
                        entry.label !== "Unassigned" ? (
                          <input
                            className="color-rule-name"
                            defaultValue={entry.label}
                            aria-label={"Rename " + entry.label}
                            onBlur={(event) =>
                              renameColorGroup(entry.label, event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                event.currentTarget.blur();
                            }}
                          />
                        ) : (
                          <span>{entry.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="color-template-tools">
                    <button onClick={saveColorTemplate}>Save template</button>
                    <select
                      value={colorTemplateChoice}
                      aria-label="Saved color templates"
                      onChange={(event) =>
                        setColorTemplateChoice(event.target.value)
                      }
                    >
                      <option value="">Choose template…</option>
                      {(workspace.colorTemplates ?? []).map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={applyColorTemplate}
                      disabled={!colorTemplateChoice}
                    >
                      Apply
                    </button>
                    <button onClick={resetRuleColors}>Reset colors</button>
                    <label className="export-legend-toggle">
                      <input
                        type="checkbox"
                        checked={plan.exportLegend !== false}
                        onChange={(event) =>
                          updatePlan((p) => ({
                            ...p,
                            exportLegend: event.target.checked,
                          }))
                        }
                      />
                      Include legend in exports
                    </label>
                  </div>
                </details>
              )}
            </>
          )}
          <div className="section-bar">
            <span className="section-bar-label">SECTIONS</span>
            <div className="section-tabs">
              {plan.sections.map((section) => (
                <button
                  key={section.id}
                  className={activeSection.id === section.id ? "active" : ""}
                  onClick={() => {
                    setActiveSectionId(section.id);
                    setSelectedPlacement(null);
                    setSelectedPlacements([]);
                  }}
                >
                  {section.name}
                  <small>
                    {section.width.toFixed(1).replace(/\.0$/, "")}&quot;
                  </small>
                </button>
              ))}
              <button className="section-add" onClick={addSection}>
                <Plus size={15} /> Add section
              </button>
            </div>
            <div className="section-editor">
              <input
                value={activeSection.name}
                aria-label="Section name"
                onChange={(e) =>
                  updateSection(activeSection.id, { name: e.target.value })
                }
              />
              <FixtureInput
                label="Section width"
                value={activeSection.width}
                onCommit={editSectionWidth}
              />
              <button
                className="section-copy"
                onClick={duplicateShelf}
                disabled={!activeShelf}
                aria-label="Duplicate active shelf"
                title="Duplicate shelf"
              >
                <Copy size={15} />
              </button>
              <button
                className="section-copy"
                onClick={duplicateSection}
                aria-label="Duplicate section"
                title="Duplicate section"
              >
                <Layers3 size={15} />
              </button>
              <button
                className="section-delete"
                onClick={removeSection}
                disabled={plan.sections.length === 1}
                aria-label="Delete active section"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {activeShelf && (
              <details className="shelf-position-editor" open>
                <summary>
                  Shelf position <b>{activeShelf.name}</b>
                </summary>
                <div>
                  <label>
                    Shelf length
                    <FixtureInput
                      label=""
                      value={activeShelf.width ?? activeSection.width}
                      onCommit={(value) =>
                        updateShelf(activeSection.id, activeShelf.id, {
                          width: Math.max(1, Math.min(activeSection.width, value)),
                          sourcePsaFixtureLine: undefined,
                        })
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      updateShelf(activeSection.id, activeShelf.id, {
                        width: activeSection.width,
                        sourcePsaFixtureLine: undefined,
                      })
                    }
                    disabled={
                      (activeShelf.width ?? activeSection.width) ===
                      activeSection.width
                    }
                  >
                    Full section width
                  </button>
                  <label>
                    Height from floor
                    <FixtureInput
                      label=""
                      value={activeShelfElevation}
                      onCommit={(value) =>
                        setShelfElevation(
                          activeSection.id,
                          activeShelf.id,
                          value,
                        )
                      }
                    />
                  </label>
                  {activeShelfIndex < activeSection.shelves.length - 1 && (
                    <label className="shelf-position-slider">
                      Drag position
                      <input
                        type="range"
                        min={activeShelfMinElevation}
                        max={activeShelfMaxElevation}
                        step="0.5"
                        value={activeShelfElevation}
                        onChange={(event) =>
                          setShelfElevation(
                            activeSection.id,
                            activeShelf.id,
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                  )}
                  <button
                    onClick={() => moveShelfVertically(activeSection.id, activeShelf.id, -1)}
                    disabled={
                      activeShelfIndex === activeSection.shelves.length - 1 ||
                      activeShelf.height <= 1
                    }
                    aria-label={`Move ${activeShelf.name} up one inch`}
                  >
                    <ArrowUp size={15} /> Up 1&quot;
                  </button>
                  <button
                    onClick={() => moveShelfVertically(activeSection.id, activeShelf.id, 1)}
                    disabled={
                      activeShelfIndex === activeSection.shelves.length - 1 ||
                      activeSection.shelves[activeShelfIndex + 1]?.height <= 1
                    }
                    aria-label={`Move ${activeShelf.name} down one inch`}
                  >
                    <ArrowDown size={15} /> Down 1&quot;
                  </button>
                  <button onClick={distributeShelvesEvenly}>Space evenly</button>
                  {activeSection.shelves.at(-1)?.id === activeShelf.id && (
                    <small>The base shelf stays fixed.</small>
                  )}
                </div>
              </details>
            )}
          </div>
          {viewMode && <div
            className="viewer-controls"
            role="toolbar"
            aria-label="Planogram navigation controls"
          >
              <button onClick={fitViewer}>Fit</button>
              <button
                onClick={() => setViewerZoom(viewZoom - 0.2)}
                aria-label="Zoom out"
              >
                −
              </button>
              <span>{Math.round(viewZoom * 100)}%</span>
              <button
                onClick={() => setViewerZoom(viewZoom + 0.2)}
                aria-label="Zoom in"
              >
                +
              </button>
              <button onClick={() => setViewerZoom(1)} aria-label="Reset zoom">100%</button>
          </div>}
          <div
            className={`canvas-scroll ${viewMode || panMode ? "pan-enabled" : ""}`}
            ref={viewerRef}
            onPointerDown={viewerPointerDown}
            onPointerMove={viewerPointerMove}
            onPointerUp={viewerPointerEnd}
            onPointerCancel={viewerPointerEnd}
            onWheel={(event) => {
              if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                setViewerZoom(viewZoom + (event.deltaY < 0 ? 0.1 : -0.1));
              }
            }}
          >
            <div
              className="fixture multi-section-fixture"
              style={{
                aspectRatio: `${plan.fixtureWidth}/${plan.fixtureHeight}`,
                minWidth: viewMode
                  ? "0px"
                  : `${Math.max(540, plan.sections.length * 280) * viewZoom}px`,
                ...(viewMode
                  ? { width: `${viewZoom * 100}%`, maxWidth: "none" }
                  : viewZoom !== 1
                    ? { width: `${Math.max(760, plan.sections.length * 280) * viewZoom}px`, maxWidth: "none" }
                    : {}),
              }}
            >
              <div className="fixture-top">
                <span>
                  {plan.fixtureWidth.toFixed(1).replace(/\.0$/, "")}&quot; W ×{" "}
                  {plan.fixtureHeight}&quot; H · {capacity} units
                </span>
              </div>
              <div className="fixture-sections">
                {plan.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`fixture-section ${activeSection.id === section.id ? "active" : ""}`}
                    style={{ flex: section.width }}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    <div className="fixture-section-title">
                      {section.name}
                      <b>
                        {section.width.toFixed(1).replace(/\.0$/, "")}&quot;
                      </b>
                    </div>
                    <div className="shelves">
                      {section.shelves.map((shelf, index) => {
                        const shelfWidth = shelf.width ?? section.width,
                          shelfCapacity = shelf.placements.reduce(
                            (sum, placement) => {
                              const item = plan.products.find(
                                (p) => p.id === placement.productId,
                              );
                              return (
                                sum +
                                placement.facings *
                                  Math.max(1, item?.unitsPerFacing ?? 1)
                              );
                            },
                            0,
                          );
                        return (
                          <div
                            className={`shelf-wrap ${activeSection.id === section.id && activeShelf?.id === shelf.id ? "shelf-selected" : ""}`}
                            key={shelf.id}
                            style={{
                              flex: shelf.height,
                              width: `${Math.min(100, (shelfWidth / section.width) * 100)}%`,
                            }}
                          >
                            <div
                              className="shelf-label"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveSectionId(section.id);
                                setActiveShelfId(shelf.id);
                              }}
                            >
                              <span>{shelf.name}</span>
                              <ShelfLengthInput
                                value={shelfWidth}
                                maximum={section.width}
                                onCommit={(value) =>
                                  updateShelf(section.id, shelf.id, {
                                    width: value,
                                  })
                                }
                              />
                            </div>
                            <div
                              className="shelf-space"
                              data-section-id={section.id}
                              data-shelf-id={shelf.id}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) =>
                                dropProduct(e, section.id, shelf.id)
                              }
                              onClick={() => tapPlace(section.id, shelf.id)}
                            >
                              {!shelf.placements.length && (
                                <span className="drop-hint">
                                  Drop or tap to add
                                </span>
                              )}
                              {shelf.placements.map((placement) => {
                                const item = plan.products.find(
                                  (p) => p.id === placement.productId,
                                );
                                if (!item) return null;
                                const displaySize = productDisplaySize(item),
                                  groupWidth =
                                    (displaySize.width / shelfWidth) *
                                    100 *
                                    placement.facings;
                                return (
                                  <div
                                    key={placement.id}
                                    className={`placed-group ${selectedPlacement === placement.id ? "placement-selected" : ""}`}
                                    style={{
                                      left: `${Math.max(0, Math.min(placement.x, 100 - groupWidth))}%`,
                                      width: `${groupWidth}%`,
                                    }}
                                    onPointerDown={(e) =>
                                      startMove(
                                        e,
                                        section.id,
                                        shelf.id,
                                        placement.id,
                                        placement.x,
                                        item.id,
                                      )
                                    }
                                    onPointerMove={moveProduct}
                                    onPointerUp={endMove}
                                    onPointerCancel={endMove}
                                    onKeyDown={(e) =>
                                      movePlacementWithKeyboard(
                                        e,
                                        section.id,
                                        shelf.id,
                                        placement,
                                      )
                                    }
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${item.name}, ${placement.facings} facings. Use left and right arrows to position, up and down arrows to change shelves, and Delete to remove.`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelected(item.id);
                                      setSelectedPlacement(placement.id);
                                      setActiveSectionId(section.id);
                                    }}
                                  >
                                    <div className="placed-products">
                                      {Array.from({
                                        length: placement.facings,
                                      }).map((_, n) => (
                                        <div
                                          className={`placed ${plan.colorMode === "none" ? "" : "color-coded"} ${showSolidColors ? "color-solid" : ""}`}
                                          key={n}
                                          style={{
                                            aspectRatio: `${displaySize.width}/${displaySize.height}`,
                                            background: showSolidColors
                                              ? displayColor(item, placement)
                                              : item.image
                                                ? plan.colorMode === "none"
                                                  ? "transparent"
                                                  : `color-mix(in srgb, ${displayColor(item, placement)} 18%, white)`
                                                : item.color,
                                            "--product-code-color":
                                              displayColor(item, placement),
                                            boxShadow:
                                              plan.colorMode === "none"
                                                ? undefined
                                                : "inset 0 0 0 5px " +
                                                  displayColor(item, placement),
                                          } as React.CSSProperties}
                                          title={
                                            plan.colorMode === "none"
                                              ? item.name
                                              : item.name +
                                                " · " +
                                                colorLabel(item, placement)
                                          }
                                        >
                                          {item.image && !showSolidColors ? (
                                            <img
                                              src={item.image}
                                              alt={item.name}
                                              draggable={false}
                                              decoding="async"
                                              style={shelfProductImageStyle(item)}
                                            />
                                          ) : (
                                            <>
                                              {!showSolidColors && <Box size={18} />}
                                              <span>{item.name}</span>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <div
                                      className={`placement-tools ${selectedPlacement === placement.id ? "selected" : ""}`}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editPlacement(
                                            section.id,
                                            shelf.id,
                                            placement.id,
                                            (value) => ({
                                              ...value,
                                              x: Math.max(0, value.x - 5),
                                            }),
                                          );
                                        }}
                                      >
                                        ←
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editPlacement(
                                            section.id,
                                            shelf.id,
                                            placement.id,
                                            (value) => ({
                                              ...value,
                                              facings: Math.max(
                                                1,
                                                value.facings - 1,
                                              ),
                                            }),
                                          );
                                        }}
                                      >
                                        −
                                      </button>
                                      <b>{placement.facings}</b>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editPlacement(
                                            section.id,
                                            shelf.id,
                                            placement.id,
                                            (value) => ({
                                              ...value,
                                              facings: Math.min(
                                                8,
                                                value.facings + 1,
                                              ),
                                            }),
                                          );
                                        }}
                                      >
                                        +
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editPlacement(
                                            section.id,
                                            shelf.id,
                                            placement.id,
                                            (value) => ({
                                              ...value,
                                              x: Math.min(92, value.x + 5),
                                            }),
                                          );
                                        }}
                                      >
                                        →
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removePlacement(
                                            section.id,
                                            shelf.id,
                                            placement.id,
                                          );
                                          setSelectedPlacement(null);
                                        }}
                                        aria-label="Remove product"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div
                              className={`shelf-beam ${index < section.shelves.length - 1 ? "shelf-beam-movable" : ""}`}
                              onPointerDown={(event) =>
                                startShelfMove(event, section.id, shelf.id)
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveSectionId(section.id);
                                setActiveShelfId(shelf.id);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                event.preventDefault();
                                moveShelfVertically(
                                  section.id,
                                  shelf.id,
                                  event.key === "ArrowUp" ? -1 : 1,
                                );
                              }}
                              aria-label={
                                index < section.shelves.length - 1
                                  ? `Drag ${shelf.name} up or down to reposition it`
                                  : `${shelf.name} is the fixed base shelf`
                              }
                              title={
                                index < section.shelves.length - 1
                                  ? "Drag shelf up or down"
                                  : "Fixed base shelf"
                              }
                            >
                              <span>
                                {index + 1} · {shelfWidth}&quot; ·{" "}
                                {shelfCapacity} units
                              </span>
                              {index < section.shelves.length - 1 && (
                                <i className="shelf-drag-handle" aria-hidden="true">
                                  <GripVertical size={14} />
                                </i>
                              )}
                              <button
                                onClick={() =>
                                  removeShelf(section.id, shelf.id)
                                }
                                aria-label={`Delete ${shelf.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <aside className={`inspector panel ${rightPanelCollapsed ? "panel-collapsed" : ""}`}>
          <button className="panel-collapse-control right" onClick={() => setRightPanelCollapsed((value) => !value)} aria-label={rightPanelCollapsed ? "Open product details" : "Collapse product details"} title={rightPanelCollapsed ? "Open product details" : "Collapse product details"}>
            {rightPanelCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            <span>{copyDrawerOpen && workspaceView === "planogram" ? "Copy" : "Details"}</span>
          </button>
          {!rightPanelCollapsed && (
            <>
          {copyDrawerOpen && workspaceView === "planogram" ? (
            <div className="compare-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">COPY FROM ANOTHER POG</span>
                  <h2>{sourcePog?.title ?? "Choose a source"}</h2>
                </div>
                <button
                  className="secondary"
                  onClick={() => setCopyDrawerOpen(false)}
                >
                  Done
                </button>
              </div>
              <div className="compare-target">
                <span>Copy into</span>
                <strong>{plan.title}</strong>
                <small>
                  {activeSection?.name ?? "No section"} ·{" "}
                  {activeShelf?.name ?? "No shelf selected"}
                </small>
              </div>
              {sourcePogOptions.length > 0 ? (
                <>
                  <label className="field">
                    <span>Source POG</span>
                    <select
                      value={resolvedSourcePogId}
                      onChange={(event) => {
                        failedSourcePogLoads.current.delete(event.target.value);
                        setSourcePogId(event.target.value);
                        setSourceProductQuery("");
                        setCopyMessage("");
                      }}
                    >
                      {sourcePogOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="search compare-search">
                    <Search size={16} />
                    <input
                      placeholder="Search source products"
                      value={sourceProductQuery}
                      onChange={(event) =>
                        setSourceProductQuery(event.target.value)
                      }
                    />
                  </div>
                  {copyMessage && (
                    <div className="compare-message">{copyMessage}</div>
                  )}
                  <div className="compare-source-list">
                    {filteredSourcePlacements.map(
                      ({ section, shelf, placement, product }) =>
                        product ? (
                          <div
                            className="compare-source-row"
                            key={placement.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                "sourcePogProduct",
                                JSON.stringify({
                                  planogramId: sourcePog?.id,
                                  productId: product.id,
                                  placementId: placement.id,
                                }),
                              );
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            title="Drag onto a shelf or use Copy"
                          >
                            <div
                              className="thumb"
                              style={{
                                background: product.image ? "white" : product.color,
                              }}
                            >
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    transform: productImageTransform(product),
                                  }}
                                />
                              ) : (
                                <Box size={21} />
                              )}
                            </div>
                            <div>
                              <strong>{product.name}</strong>
                              <span>
                                {section.name} · {shelf.name} ·{" "}
                                {placement.facings} facings
                              </span>
                              <small>
                                {product.brand || "No brand"}
                                {product.upc ? " · " + product.upc : ""}
                              </small>
                            </div>
                            <button
                              className="secondary"
                              onClick={() =>
                                copyProductFromPog(
                                  sourcePog!,
                                  product,
                                  placement,
                                )
                              }
                            >
                              <Copy size={14} /> Copy
                            </button>
                          </div>
                        ) : null,
                    )}
                    {sourcePogLoading && !sourcePog && (
                      <div className="empty-compare">
                        Loading this source POG...
                      </div>
                    )}
                    {sourcePog && !filteredSourcePlacements.length && (
                      <div className="empty-compare">
                        No placed products match this search.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-compare">
                  Create or import another POG, then use this panel to copy
                  products into the active shelf.
                </div>
              )}
            </div>
          ) : product ? (
            <>
              <div className="panel-head">
                <div>
                  <span className="eyebrow">PRODUCT DETAILS</span>
                  <h2>{product.name}</h2>
                </div>
                <button
                  className="danger-icon"
                  onClick={removeProduct}
                  aria-label="Delete product"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <label
                className={`image-drop native-photo-picker ${imageStatus === "uploading" ? "uploading" : ""}`}
              >
                {product.image ? (
                  <>
                    <img
                      src={product.image}
                      alt={product.name}
                      decoding="async"
                      style={{ transform: productImageTransform(product) }}
                    />
                    <span className="photo-overlay">
                      <ImagePlus size={17} />
                      {imageStatus === "uploading"
                        ? "Uploading…"
                        : "Tap to change photo"}
                    </span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={28} />
                    <strong>
                      {imageStatus === "uploading"
                        ? "Uploading…"
                        : "Choose from Photos"}
                    </strong>
                    <span>Tap here to open your photo library</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  disabled={imageStatus === "uploading"}
                  aria-label={
                    product.image
                      ? "Change product photo"
                      : "Choose product photo"
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void uploadImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="photo-permission-help">
                If your iPhone asks, allow ChatGPT access to your photos.
              </p>
              {product.imageSource && product.imageSourceUrl && (
                <p className="image-source-note">
                  Image from{" "}
                  <a
                    href={product.imageSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {product.imageSource}
                  </a>
                  {product.imageSource === "Open Food Facts" ? " (CC BY-SA)" : ""}
                </p>
              )}
              <div className="product-image-actions">
                <button
                  className="secondary"
                  onClick={() => void findNewerImageForProduct(product)}
                  disabled={upcImageStatus === "searching"}
                >
                  <ImagePlus size={16} />
                  {upcImageStatus === "searching" ? "Finding…" : "Find image"}
                </button>
                {product.image && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => openManualCrop(product)}
                      disabled={imageStatus === "uploading"}
                    >
                      <Crop size={16} /> Manual crop
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void autoCropProductImage(product)}
                      disabled={imageStatus === "uploading"}
                    >
                      <ScanLine size={16} />
                      {imageStatus === "uploading" ? "Cropping…" : "Auto crop"}
                    </button>
                  </>
                )}
              </div>
              {upcImageMessage && (
                <div className={`image-status ${upcImageStatus}`} role="status">
                  {upcImageMessage}
                </div>
              )}
              {pendingImageMatch && pendingImageMatch.product.id === product.id && (
                <div className="image-review-card">
                  <div className="image-review-heading">
                    <div>
                      <strong>Compare images</strong>
                      <span>Choose which version to use</span>
                    </div>
                    <button
                      className="image-review-close"
                      aria-label="Close image comparison"
                      onClick={() => { setPendingImageMatch(null); setUpcImageMessage("Current image kept."); }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="image-review-compare">
                    <div className="image-review-option">
                      <span><i /> Current</span>
                      <div className="image-review-preview">
                        {product.image ? <img src={product.image} alt="Current product" /> : <em>No image</em>}
                      </div>
                    </div>
                    <div className="image-review-option new">
                      <span><i /> New match</span>
                      <div className="image-review-preview">
                        <img src={pendingImageMatch.image} alt="Proposed product" />
                      </div>
                    </div>
                  </div>
                  <small>Found on <b>{pendingImageMatch.source ?? "product image source"}</b></small>
                  <div className="image-review-actions">
                    <button className="secondary" onClick={() => openManualCropImage(pendingImageMatch.product.id, pendingImageMatch.product.name, pendingImageMatch.image)}><Crop size={15} /> Crop &amp; use</button>
                    <button className="secondary" onClick={() => { setPendingImageMatch(null); setUpcImageMessage("Current image kept."); }}>Keep current</button>
                    <button className="primary" onClick={acceptPendingImage}><Check size={16} /> Use new image</button>
                  </div>
                </div>
              )}
              {product.image && (
                <div className="image-edit-tools" aria-label="Image controls">
                  <button
                    onClick={() =>
                      updateProduct(
                        "imageRotation",
                        (((product.imageRotation ?? 0) + 270) % 360) as
                          0 | 90 | 180 | 270,
                      )
                    }
                  >
                    <RotateCcw size={15} /> Left
                  </button>
                  <button
                    onClick={() =>
                      updateProduct(
                        "imageRotation",
                        (((product.imageRotation ?? 0) + 90) % 360) as
                          0 | 90 | 180 | 270,
                      )
                    }
                  >
                    <RotateCw size={15} /> Right
                  </button>
                  <button
                    onClick={() =>
                      updateProduct("imageFlipped", !product.imageFlipped)
                    }
                  >
                    <FlipHorizontal size={15} /> Flip
                  </button>
                  <button
                    onClick={() => {
                      if (selected)
                        updateProductsAcrossPlanograms([selected], (item) => ({
                          ...item,
                          imageRotation: 0,
                          imageFlipped: false,
                        }));
                    }}
                  >
                    Reset
                  </button>
                </div>
              )}
              {imageMessage && (
                <div className={`image-status ${imageStatus}`} role="status">
                  {imageMessage}
                </div>
              )}
              <Field
                label="Product name"
                value={product.name}
                onChange={(value) => updateProduct("name", value)}
              />
              <Field
                label="Brand"
                value={product.brand}
                onChange={(value) => updateProduct("brand", value)}
              />
              <Field
                label="Manufacturer"
                value={product.manufacturer ?? ""}
                onChange={(value) => updateProduct("manufacturer", value)}
              />
              <Field
                label="Color group"
                value={product.colorGroup ?? ""}
                onChange={(value) => updateProduct("colorGroup", value)}
              />
              <p className="color-group-help">
                Use any label you want: strategy, tier, diet, innovation,
                priority or something else.
              </p>
              <label className="field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={product.description}
                  onChange={(e) => updateProduct("description", e.target.value)}
                />
              </label>
              <div className="size-note">
                Package size updates every placement immediately.
              </div>
              <div className="field-grid">
                <NumberField
                  label="Width (in)"
                  value={product.width}
                  onChange={(value) => updateProduct("width", value)}
                />
                <NumberField
                  label="Height (in)"
                  value={product.height}
                  onChange={(value) => updateProduct("height", value)}
                />
                <NumberField
                  label="Depth (in)"
                  value={product.depth}
                  onChange={(value) => updateProduct("depth", value)}
                />
                <NumberField
                  label="Price ($)"
                  value={product.price}
                  onChange={(value) => updateProduct("price", value)}
                />
                <IntegerField
                  label="Units per facing"
                  value={product.unitsPerFacing ?? 1}
                  onChange={(value) => updateProduct("unitsPerFacing", value)}
                />
              </div>
              <details className="enterprise-product-fields">
                <summary>Enterprise product fields</summary>
                <div className="enterprise-fields-body">
                  <Field
                    label="SKU / item number"
                    value={product.sku ?? ""}
                    onChange={(value) => updateProduct("sku", value)}
                  />
                  <Field
                    label="Category"
                    value={product.category ?? ""}
                    onChange={(value) => updateProduct("category", value)}
                  />
                  <Field
                    label="Subcategory"
                    value={product.subcategory ?? ""}
                    onChange={(value) => updateProduct("subcategory", value)}
                  />
                  {(workspace.customProductColumns ?? []).map((column) => (
                    <Field
                      key={column}
                      label={column}
                      value={product.customFields?.[column] ?? ""}
                      onChange={(value) => updatePogCustomField(product.id, column, value)}
                    />
                  ))}
                  <button className="secondary add-custom-field" onClick={addCustomProductColumn}>
                    <Plus size={15} /> Add product column
                  </button>
                  <div className="field-grid">
                    <SelectField
                      label="Orientation"
                      value={product.orientation ?? "front"}
                      options={[
                        ["front", "Front"],
                        ["side", "Side"],
                        ["top", "Top"],
                      ]}
                      onChange={(value) => updateProduct("orientation", value)}
                    />
                    <SelectField
                      label="Merchandising"
                      value={product.merchStyle ?? "unit"}
                      options={[
                        ["unit", "Unit"],
                        ["case", "Case"],
                        ["tray", "Tray"],
                        ["stack", "Stack"],
                      ]}
                      onChange={(value) => updateProduct("merchStyle", value)}
                    />
                    <IntegerField
                      label="Minimum facings"
                      value={product.minFacings ?? 1}
                      onChange={(value) => updateProduct("minFacings", value)}
                    />
                    <IntegerField
                      label="Recommended"
                      value={product.recommendedFacings ?? 1}
                      onChange={(value) =>
                        updateProduct("recommendedFacings", value)
                      }
                    />
                    <IntegerField
                      label="Maximum facings"
                      value={product.maxFacings ?? 8}
                      onChange={(value) => updateProduct("maxFacings", value)}
                    />
                  </div>
                </div>
              </details>
              <div className="capacity-note">
                <b>{selectedProductCapacity}</b> units of this product across
                all sections
              </div>
              {product.performance &&
                Object.entries(product.performance).some(
                  ([key, value]) =>
                    key !== "updatedAt" && typeof value === "number",
                ) && (
                  <div className="performance-card">
                    <strong>Performance data</strong>
                    <div>
                      {(
                        [
                          ["sales", "Sales"],
                          ["units", "Units"],
                          ["velocity", "Velocity"],
                          ["profit", "Profit"],
                          ["growth", "Growth"],
                        ] as const
                      ).map(([metric, label]) =>
                        typeof product.performance?.[metric] === "number" ? (
                          <span key={metric}>
                            <small>{label}</small>
                            <b>
                              {metric === "sales" || metric === "profit"
                                ? product.performance[metric]!.toLocaleString(
                                    undefined,
                                    {
                                      style: "currency",
                                      currency: "USD",
                                    },
                                  )
                                : metric === "growth"
                                  ? product.performance[metric]!.toFixed(1) +
                                    "%"
                                  : product.performance[metric]!.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 2 },
                                    )}
                            </b>
                          </span>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
              <Field
                label="UPC"
                value={product.upc}
                onChange={(value) => updateProduct("upc", value)}
              />
              <button
                className="sync-product-button"
                onClick={syncProductToAllPlanograms}
              >
                <Layers3 size={16} /> Sync product to all planograms
              </button>
            </>
          ) : (
            <div className="empty-inspector">
              <Box size={34} />
              <h2>Select a product</h2>
              <p>
                Choose a product to edit its image, description and package
                size.
              </p>
            </div>
          )}
            </>
          )}
        </aside>
      </section>
      )}
      {manualCrop && (
        <div
          className="manual-crop-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setManualCrop(null);
          }}
        >
          <section className="manual-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-crop-title">
            <div className="manual-crop-heading">
              <div>
                <span className="eyebrow">PRODUCT IMAGE</span>
                <h2 id="manual-crop-title">Crop {manualCrop.productName}</h2>
                <p>Drag the frame to move it. Drag any corner to resize it.</p>
              </div>
              <button className="manual-crop-close" onClick={() => setManualCrop(null)} aria-label="Close crop editor">×</button>
            </div>
            <div className="manual-crop-workspace">
              <div
                className="manual-crop-stage"
                onPointerMove={moveManualCrop}
                onPointerUp={finishManualCropDrag}
                onPointerCancel={finishManualCropDrag}
              >
                <img
                  src={manualCrop.image}
                  alt={manualCrop.productName}
                  draggable={false}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    setManualCrop((current) => current ? { ...current, naturalWidth: image.naturalWidth || 1, naturalHeight: image.naturalHeight || 1 } : current);
                  }}
                />
                <div
                  className="manual-crop-frame"
                  style={{ left: `${manualCrop.x}%`, top: `${manualCrop.y}%`, width: `${manualCrop.width}%`, height: `${manualCrop.height}%` }}
                  onPointerDown={(event) => beginManualCropDrag(event, "move")}
                >
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <button
                      key={corner}
                      type="button"
                      className={`manual-crop-handle ${corner}`}
                      aria-label={`Resize crop from ${corner} corner`}
                      onPointerDown={(event) => beginManualCropDrag(event, corner)}
                    />
                  ))}
                  <span className="crop-thirds vertical one" /><span className="crop-thirds vertical two" />
                  <span className="crop-thirds horizontal one" /><span className="crop-thirds horizontal two" />
                </div>
              </div>
            </div>
            <div className="manual-crop-footer">
              <span>{Math.round(manualCrop.width)}% wide × {Math.round(manualCrop.height)}% tall</span>
              <div>
                <button className="secondary" onClick={() => setManualCrop((current) => current ? { ...current, x: 0, y: 0, width: 100, height: 100 } : current)}>Reset frame</button>
                <button className="secondary" onClick={() => setManualCrop(null)}>Cancel</button>
                <button className="primary" onClick={() => void applyManualCrop()} disabled={imageStatus === "uploading"}>{imageStatus === "uploading" ? "Saving…" : "Apply crop"}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function LoginScreen({
  initialMessage,
  onSignedIn,
}: {
  initialMessage?: string;
  onSignedIn: (user: AppUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, accessCode }),
      });
      const result = (await response.json()) as
        | ({ authenticated: true } & AppUser)
        | { authenticated?: false; error?: string };
      if (!response.ok || !result.authenticated)
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "Unable to sign in.",
        );
      onSignedIn({
        email: result.email,
        displayName: result.displayName || result.email,
        isOwner: Boolean(result.isOwner),
        provider: result.provider === "chatgpt" ? "chatgpt" : "beta",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-card" aria-label="Planogram Studio Pro login">
        <div className="login-brand">
          <div className="login-mark">
            <LockKeyhole size={26} />
          </div>
          <div>
            <strong>Planogram Studio Pro</strong>
            <span>Beta access</span>
          </div>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="name@company.com"
              required
            />
          </label>
          <label>
            <span>Access code</span>
            <input
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="Code from Travis"
              required
            />
          </label>
          {message && <p className="login-message">{message}</p>}
          <button className="primary" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <small>Use the email and access code Travis shared with you.</small>
      </section>
    </main>
  );
}

function BootScreen({ message }: { message: string }) {
  return (
    <main className="boot-screen" aria-busy="true" aria-live="polite">
      <section className="boot-card" aria-label="Planogram Studio Pro is loading">
        <div className="boot-brand">
          <div className="boot-mark">
            <Layers3 size={28} />
          </div>
          <div>
            <strong>Planogram Studio Pro</strong>
            <span>Loading your workspace</span>
          </div>
        </div>
        <div className="boot-preview" aria-hidden="true">
          <div className="boot-fixture">
            {[0, 1, 2, 3].map((shelf) => (
              <div className="boot-shelf" key={shelf}>
                {[0, 1, 2, 3, 4].map((slot) => (
                  <span
                    key={slot}
                    style={{
                      height: `${34 + ((shelf + slot) % 3) * 10}px`,
                      animationDelay: `${(shelf * 5 + slot) * 0.06}s`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="boot-progress" aria-hidden="true">
          <span />
        </div>
        <p>{message}</p>
        <small>Saved POGs, product images and autosave recovery are being checked.</small>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([option, name]) => (
          <option key={option} value={option}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0.1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Math.max(0.1, Number(e.target.value) || 0.1))}
      />
    </label>
  );
}
function IntegerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Math.round(Number(draft));
    if (Number.isFinite(parsed) && parsed >= 1) onChange(parsed);
    else setDraft(String(value));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function FixtureInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(2))));
  useEffect(() => setDraft(String(Number(value.toFixed(2)))), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) onCommit(parsed);
    else setDraft(String(Number(value.toFixed(2))));
  };
  return (
    <label>
      <span>{label}</span>
      <div>
        <input
          inputMode="decimal"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <b>in</b>
      </div>
    </label>
  );
}
function ShelfLengthInput({
  value,
  maximum,
  onCommit,
}: {
  value: number;
  maximum: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(2)))),
    [editing, setEditing] = useState(false);
  useEffect(() => setDraft(String(Number(value.toFixed(2)))), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0)
      onCommit(Math.max(1, Math.min(maximum, parsed)));
    else setDraft(String(Number(value.toFixed(2))));
    setEditing(false);
  };
  if (!editing)
    return (
      <button
        type="button"
        className="shelf-length-compact"
        aria-label={`Edit shelf length, currently ${value} inches`}
        title="Edit shelf length"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {Number(value.toFixed(1))}&quot;
      </button>
    );
  return (
    <label
      className="shelf-length editing"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        inputMode="decimal"
        type="text"
        value={draft}
        aria-label="Shelf length in inches"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(Number(value.toFixed(2))));
            setEditing(false);
          }
        }}
      />
      <b>&quot; long</b>
    </label>
  );
}
