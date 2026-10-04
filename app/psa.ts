export type PsaProduct = {
  sourceId: string;
  sourceLine: number;
  name: string;
  brand: string;
  manufacturer: string;
  description: string;
  upc: string;
  sku: string;
  category: string;
  subcategory: string;
  width: number;
  height: number;
  depth: number;
  unitsPerFacing: number;
  orientation: "front" | "side" | "top";
};

export type PsaPlacement = {
  id: string;
  productSourceId: string;
  sourceLine: number;
  x: number;
  facings: number;
};

export type PsaShelf = {
  id: string;
  name: string;
  height: number;
  width: number;
  sourcePositionY: number;
  sourceFixtureLine: number;
  placements: PsaPlacement[];
};

export type PsaSection = {
  id: string;
  name: string;
  width: number;
  sourceX: number;
  shelves: PsaShelf[];
};

export type PsaImport = {
  title: string;
  version: string;
  fixtureWidth: number;
  fixtureHeight: number;
  sourcePlanogramLine: number;
  sourcePlanogramEndLine: number;
  products: PsaProduct[];
  sections: PsaSection[];
  warnings: string[];
  summary: {
    products: number;
    placements: number;
    sections: number;
    shelves: number;
  };
};

export type PsaPlanogramOption = {
  title: string;
  sourcePlanogramLine: number;
};

type PsaRecord = { fields: string[]; line: number };
type RawFixture = {
  x: number;
  width: number;
  y: number;
  height: number;
  name: string;
  line: number;
};

const numberAt = (fields: string[], index: number, fallback = 0) => {
  const value = Number(fields[index]);
  return Number.isFinite(value) ? value : fallback;
};

const positiveAt = (fields: string[], index: number, fallback: number) => {
  const value = numberAt(fields, index, fallback);
  return value > 0 ? value : fallback;
};

// PSA is a comma-delimited ProSpace schematic format. It uses backslash-comma
// for commas inside values and occasionally includes conventional CSV quotes.
export const splitPsaLine = (line: string) => {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === "\\" && line[index + 1] === ",") {
      value += ",";
      index++;
    } else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else value += char;
  }
  fields.push(value);
  return fields;
};

const findBrand = (fields: string[]) => {
  const preferred = (fields[232] ?? "").trim();
  if (preferred && !/^-?\d+(?:\.\d+)?$/.test(preferred)) return preferred;
  return "";
};

const findManufacturer = (fields: string[]) => {
  const candidates = [fields[14], fields[12]];
  return (
    candidates
      .map((value) => (value ?? "").trim())
      .find((value) => value && !/^\d+$/.test(value)) ?? ""
  );
};

const inferOrientation = (value: string) => {
  const code = value.trim().toUpperCase();
  if (code.endsWith("T")) return "top" as const;
  if (code.endsWith("S")) return "side" as const;
  return "front" as const;
};

const findProductBarcode = (fields: string[]) => {
  // ProSpace/JDA exports are not consistent about whether the barcode is
  // written in the ID or UPC column. Prefer the UPC column when it contains a
  // real GTIN, then fall back to the product ID. Keep leading zeroes intact.
  for (const value of [fields[2], fields[1]]) {
    const candidate = (value ?? "").trim();
    if (/^\d{8,14}$/.test(candidate)) return candidate;
  }
  return "";
};

export function listPsaPlanograms(text: string): PsaPlanogramOption[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "PROSPACE SCHEMATIC FILE") {
    throw new Error("This is not a supported ProSpace PSA schematic file.");
  }
  return lines.flatMap((line, sourcePlanogramLine) => {
    const fields = splitPsaLine(line);
    if (fields[0] !== "Planogram") return [];
    return [{
      title: fields[1]?.trim() || `Planogram ${sourcePlanogramLine + 1}`,
      sourcePlanogramLine,
    }];
  });
}

export function parsePsa(
  text: string,
  fileName = "Imported planogram.psa",
  selectedPlanogramLine?: number,
): PsaImport {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "PROSPACE SCHEMATIC FILE") {
    throw new Error("This is not a supported ProSpace PSA schematic file.");
  }

  const version =
    lines.find((line) => /^;\s*Version\s+/i.test(line))?.replace(/^;\s*Version\s+/i, "").trim() ||
    "unknown";
  const records: PsaRecord[] = lines
    .map((line, index) => ({ fields: splitPsaLine(line), line: index }))
    .filter(({ fields }) =>
      ["Project", "Product", "Planogram", "Performance", "Segment", "Fixture", "Position"].includes(
        fields[0],
      ),
    );
  const byType = (type: string) => records.filter((record) => record.fields[0] === type);
  const planograms = byType("Planogram");
  const normalizedFileName = fileName
    .replace(/\.psa$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const bestMatchingPlanogram = [...planograms].sort((left, right) => {
    const score = (record: PsaRecord) => {
      const name = (record.fields[1] ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!name) return 0;
      if (normalizedFileName === name) return 10000 + name.length;
      if (normalizedFileName.includes(name)) return 1000 + name.length;
      return name.split(" ").reduce(
        (total, word) => total + (word.length > 1 && normalizedFileName.includes(word) ? word.length : 0),
        0,
      );
    };
    return score(right) - score(left);
  })[0];
  const planogram = selectedPlanogramLine == null
    ? bestMatchingPlanogram
    : planograms.find((record) => record.line === selectedPlanogramLine);
  if (!planogram) throw new Error("The PSA file does not contain a planogram record.");
  const nextPlanogramLine =
    planograms.find((record) => record.line > planogram.line)?.line ?? Number.POSITIVE_INFINITY;
  const inSelectedPlanogram = (record: PsaRecord) =>
    record.line > planogram.line && record.line < nextPlanogramLine;

  const fixtureWidth = positiveAt(planogram.fields, 3, 48);
  const fixtureHeight = positiveAt(planogram.fields, 4, 72);
  const projectName = byType("Project")[0]?.fields[1]?.trim();
  const planogramName = planogram.fields[1]?.trim();
  const fallbackName = fileName.replace(/\.psa$/i, "").trim();
  const title = planogramName || projectName || fallbackName || "Imported PSA";
  const warnings: string[] = [];

  const positionRecords = byType("Position").filter(inSelectedPlanogram);
  const positionByProduct = new Map<string, PsaRecord[]>();
  for (const record of positionRecords) {
    const sourceId = record.fields[1]?.trim();
    if (!sourceId) continue;
    positionByProduct.set(sourceId, [...(positionByProduct.get(sourceId) ?? []), record]);
  }

  const products: PsaProduct[] = byType("Product").map(({ fields, line }) => {
    const sourceId = fields[1]?.trim() || fields[2]?.trim();
    const itemCode = fields[2]?.trim() ?? "";
    const positions = positionByProduct.get(sourceId) ?? [];
    const orientation = positions.reduce<"front" | "side" | "top">((result, record) => {
      const next = inferOrientation(record.fields[42] ?? "");
      return next !== "front" ? next : result;
    }, "front");
    const unitsPerFacing = Math.max(
      1,
      ...positions.map((record) =>
        Math.max(1, Math.round(positiveAt(record.fields, 15, 1))) *
        Math.max(1, Math.round(positiveAt(record.fields, 16, 1))),
      ),
    );
    const size = [fields[10]?.trim(), fields[11]?.trim()].filter(Boolean).join(" ");
    const barcode = findProductBarcode(fields);
    return {
      sourceId,
      sourceLine: line,
      name: fields[3]?.trim() || `Product ${sourceId}`,
      brand: findBrand(fields),
      manufacturer: findManufacturer(fields),
      description: size,
      upc: barcode,
      sku: itemCode || sourceId,
      category: fields[13]?.trim() ?? "",
      subcategory: fields[233]?.trim() || fields[122]?.trim() || "",
      width: positiveAt(fields, 5, 4),
      height: positiveAt(fields, 6, 7),
      depth: positiveAt(fields, 7, 2),
      unitsPerFacing,
      orientation,
    };
  });

  const productIds = new Set(products.map((product) => product.sourceId));
  const fixtures: RawFixture[] = byType("Fixture").filter(inSelectedPlanogram).map(({ fields, line }, index) => ({
    x: numberAt(fields, 4),
    width: positiveAt(fields, 5, fixtureWidth),
    y: numberAt(fields, 6),
    height: positiveAt(fields, 7, 1),
    name: fields[3]?.trim() || fields[2]?.trim() || `Shelf ${index + 1}`,
    line,
  }));

  const rawSegments = byType("Segment").filter(inSelectedPlanogram)
    .map(({ fields }, index) => ({
      x: numberAt(fields, 10, index * positiveAt(fields, 4, fixtureWidth)),
      width: positiveAt(fields, 4, fixtureWidth),
      index,
    }))
    .sort((a, b) => a.x - b.x);
  const segmentRows = rawSegments.length
    ? rawSegments
    : [{ x: 0, width: fixtureWidth, index: 0 }];

  const sections = segmentRows.map((segment, sectionIndex): PsaSection & { sourceX: number; shelfY: number[] } => {
    const applicable = fixtures
      .filter((fixture) => {
        const left = Math.max(0, fixture.x);
        const overlap =
          Math.min(left + fixture.width, segment.x + segment.width) -
          Math.max(left, segment.x);
        return overlap > 0.05;
      })
      .sort((a, b) => b.y - a.y);
    const uniqueFixtures = applicable.filter(
      (fixture, index, list) => index === list.findIndex((item) => Math.abs(item.y - fixture.y) < 0.05),
    );
    const ascendingY = [...uniqueFixtures].sort((a, b) => a.y - b.y);
    const clearance = new Map<number, number>();
    ascendingY.forEach((fixture, index) => {
      const nextY = ascendingY[index + 1]?.y ?? fixtureHeight;
      clearance.set(fixture.line, Math.max(1, nextY - fixture.y));
    });
    const shelfRows = uniqueFixtures.length
      ? uniqueFixtures
      : [{ x: segment.x, width: segment.width, y: 0, height: 1, name: "Shelf 1", line: -1 }];
    return {
      id: `psa-section-${sectionIndex + 1}`,
      name: `Section ${sectionIndex + 1}`,
      width: segment.width,
      sourceX: segment.x,
      shelfY: shelfRows.map((fixture) => fixture.y),
      shelves: shelfRows.map((fixture, shelfIndex) => ({
        id: `psa-section-${sectionIndex + 1}-shelf-${shelfIndex + 1}`,
        name: fixture.name || `Shelf ${shelfIndex + 1}`,
        height: clearance.get(fixture.line) ?? fixtureHeight,
        width: Math.min(segment.width, fixture.width),
        sourcePositionY: fixture.y + fixture.height,
        sourceFixtureLine: fixture.line,
        placements: [],
      })),
    };
  });

  let skippedPositions = 0;
  positionRecords.forEach(({ fields, line }, positionIndex) => {
    const productSourceId = fields[1]?.trim();
    if (!productSourceId || !productIds.has(productSourceId)) {
      skippedPositions++;
      return;
    }
    const absoluteX = numberAt(fields, 4);
    const positionWidth = Math.max(0, numberAt(fields, 5));
    const centerX = absoluteX + positionWidth / 2;
    const section =
      sections.find(
        (candidate) =>
          centerX >= candidate.sourceX - 0.01 &&
          centerX < candidate.sourceX + candidate.width + 0.01,
      ) ?? sections[0];
    if (!section) {
      skippedPositions++;
      return;
    }
    const y = numberAt(fields, 6);
    let shelfIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    section.shelfY.forEach((shelfY, index) => {
      const distance = y >= shelfY - 0.1 ? y - shelfY : Number.POSITIVE_INFINITY;
      if (distance < bestDistance) {
        bestDistance = distance;
        shelfIndex = index;
      }
    });
    const relativeX = ((absoluteX - section.sourceX) / section.width) * 100;
    section.shelves[shelfIndex].placements.push({
      id: `psa-position-${line}-${positionIndex}`,
      productSourceId,
      sourceLine: line,
      x: Math.max(0, Math.min(100, relativeX)),
      facings: Math.max(1, Math.round(positiveAt(fields, 14, 1))),
    });
  });

  if (skippedPositions) warnings.push(`${skippedPositions} position${skippedPositions === 1 ? " was" : "s were"} skipped because its product record was missing.`);
  if (!fixtures.length) warnings.push("No fixture records were found; a fallback shelf was created.");
  if (planograms.length > 1 && selectedPlanogramLine == null)
    warnings.push(`This file contains ${planograms.length} planograms. Imported “${title}”, which best matches the file name.`);

  return {
    title,
    version,
    fixtureWidth,
    fixtureHeight,
    sourcePlanogramLine: planogram.line,
    sourcePlanogramEndLine: nextPlanogramLine,
    products,
    sections: sections.map(({ shelfY: _shelfY, ...section }) => section),
    warnings,
    summary: {
      products: products.length,
      placements: positionRecords.length - skippedPositions,
      sections: sections.length,
      shelves: sections.reduce((sum, section) => sum + section.shelves.length, 0),
    },
  };
}

export type PsaExportProduct = {
  id: string;
  sourceId?: string;
  sourceLine?: number;
  name: string;
  brand?: string;
  manufacturer?: string;
  upc?: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  width: number;
  height: number;
  depth: number;
  unitsPerFacing?: number;
  orientation?: "front" | "side" | "top";
};

const blankFields = (length: number) => Array.from({ length }, () => "");

/** Creates a standalone PSA when no retained source file is available. */
export function createPsa(plan: Omit<PsaExportPlan, "sourceText">) {
  const lines = [
    "PROSPACE SCHEMATIC FILE",
    "; Version 2023.1.0",
    "; Codepage=1252",
  ];
  const project = blankFields(190);
  project[0] = "Project";
  project[1] = plan.title;
  lines.push(joinPsaFields(project));

  const identifiers = new Map<string, { upc10: string; id: string }>();
  plan.products.forEach((product, index) => {
    const fallback = String(9000000000 + index + 1),
      resolved = jdaIdentifiers({ ...product, sourceId: product.sourceId || fallback }),
      fields = blankFields(250);
    identifiers.set(product.id, resolved);
    fields[0] = "Product";
    fields[1] = resolved.upc10;
    fields[2] = resolved.id;
    fields[3] = product.name;
    fields[5] = psaNumber(product.width);
    fields[6] = psaNumber(product.height);
    fields[7] = psaNumber(product.depth);
    fields[12] = product.manufacturer || "";
    fields[13] = product.category || "";
    fields[232] = product.brand || "";
    fields[233] = product.subcategory || "";
    lines.push(joinPsaFields(fields));
  });

  const planogram = blankFields(250);
  planogram[0] = "Planogram";
  planogram[1] = plan.title;
  planogram[3] = psaNumber(plan.fixtureWidth);
  planogram[4] = psaNumber(plan.fixtureHeight);
  lines.push(joinPsaFields(planogram));

  let sectionX = 0;
  plan.sections.forEach((section, sectionIndex) => {
    const segment = blankFields(50);
    segment[0] = "Segment";
    segment[2] = String(sectionIndex + 1);
    segment[4] = psaNumber(section.width);
    segment[10] = psaNumber(sectionX);
    lines.push(joinPsaFields(segment));

    let heightUsed = 0;
    section.shelves.forEach((shelf, shelfIndex) => {
      heightUsed += Math.max(1, Number(shelf.height) || 1);
      const positionY = Math.max(1, plan.fixtureHeight - heightUsed + 1),
        shelfWidth = Math.max(1, shelf.width ?? section.width),
        fixture = blankFields(180);
      fixture[0] = "Fixture";
      fixture[1] = String(sectionIndex + 1);
      fixture[2] = String(shelfIndex + 1);
      fixture[3] = shelf.name;
      fixture[4] = psaNumber(sectionX);
      fixture[5] = psaNumber(shelfWidth);
      fixture[6] = psaNumber(Math.max(0, positionY - 1));
      fixture[7] = "1";
      lines.push(joinPsaFields(fixture));

      shelf.placements.forEach((placement) => {
        const product = plan.products.find((item) => item.id === placement.productId),
          resolved = identifiers.get(placement.productId);
        if (!product || !resolved) return;
        const dimensions = orientedDimensions(product),
          facings = Math.max(1, Math.round(placement.facings)),
          verticalFacings = 1,
          depthFacings = Math.max(1, Math.ceil(product.unitsPerFacing ?? 1)),
          position = blankFields(180);
        position[0] = "Position";
        position[1] = resolved.upc10;
        position[2] = resolved.id;
        position[4] = psaNumber(
          sectionX + (Math.max(0, Math.min(100, placement.x)) / 100) * shelfWidth,
        );
        position[5] = psaNumber(dimensions.width * facings);
        position[6] = psaNumber(positionY);
        position[7] = psaNumber(dimensions.height);
        position[9] = psaNumber(dimensions.depth * depthFacings);
        position[14] = String(facings);
        position[15] = String(verticalFacings);
        position[16] = String(depthFacings);
        [33, 36].forEach((index) => (position[index] = psaNumber(dimensions.width)));
        [34, 37].forEach((index) => (position[index] = psaNumber(dimensions.height)));
        [35, 38].forEach((index) => (position[index] = psaNumber(dimensions.depth)));
        position[42] = positionOrientationCode(product);
        lines.push(joinPsaFields(position));
      });
    });
    sectionX += section.width;
  });

  const output = lines.join("\r\n");
  return {
    text: output,
    bytes: encodeWindows1252(output),
    warnings: [
      "A new standalone PSA was created from the current planogram because no original source file was retained.",
    ],
  };
}

export type PsaExportPlan = {
  title: string;
  fixtureWidth: number;
  fixtureHeight: number;
  sourceText: string;
  sourcePlanogramLine?: number;
  sourcePlanogramEndLine?: number;
  products: PsaExportProduct[];
  sections: Array<{
    width: number;
    sourceX?: number;
    shelves: Array<{
      name: string;
      height: number;
      width?: number;
      sourcePositionY?: number;
      sourceFixtureLine?: number;
      placements: Array<{
        sourceLine?: number;
        productId: string;
        x: number;
        facings: number;
      }>;
    }>;
  }>;
};

const psaNumber = (value: number) =>
  Number.isFinite(value)
    ? value.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    : "0";

const joinPsaFields = (fields: string[]) =>
  fields.map((value) => String(value ?? "").replace(/,/g, "\\,")).join(",");

const orientedDimensions = (product: PsaExportProduct) => {
  if (product.orientation === "top")
    return { width: product.width, height: product.depth, depth: product.height };
  if (product.orientation === "side")
    return { width: product.depth, height: product.height, depth: product.width };
  return { width: product.width, height: product.height, depth: product.depth };
};

// JDA graphics lookup expects the 10-digit UPC in field 1 and the
// 12/13-digit product ID in field 2 on both Product and Position records.
const jdaIdentifiers = (product: PsaExportProduct) => {
  const candidates = [product.sourceId, product.sku, product.upc]
      .map((value) => String(value ?? "").replace(/\D/g, ""))
      .filter(Boolean),
    upc10 = candidates.find((value) => value.length === 10),
    id = candidates.find(
      (value) => value.length === 12 || value.length === 13,
    );
  return {
    upc10: upc10 || candidates[0] || "",
    id: id || candidates.find((value) => value !== upc10) || upc10 || "",
  };
};

const positionOrientationCode = (product: PsaExportProduct) => {
  if (product.orientation === "top") return "12T";
  if (product.orientation === "side") return "12S";
  return "";
};

const cp1252Extra = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

export const encodeWindows1252 = (value: string) => {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.codePointAt(0) ?? 63;
    bytes.push(code <= 0xff ? code : (cp1252Extra.get(code) ?? 63));
  }
  return new Uint8Array(bytes);
};

export function exportPsa(plan: PsaExportPlan) {
  const hadCrLf = /\r\n/.test(plan.sourceText);
  const lines: Array<string | null> = plan.sourceText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const warnings: string[] = [];
  const records = lines.map((line, index) => ({
    line: index,
    fields: splitPsaLine(line ?? ""),
  }));
  const firstRecord = (type: string) => records.find((record) => record.fields[0] === type);
  const planogram =
    (plan.sourcePlanogramLine != null
      ? records.find(
          (record) =>
            record.line === plan.sourcePlanogramLine && record.fields[0] === "Planogram",
        )
      : undefined) ?? firstRecord("Planogram");
  if (!planogram) throw new Error("The retained PSA source is missing its planogram record.");
  planogram.fields[1] = plan.title;
  planogram.fields[3] = psaNumber(plan.fixtureWidth);
  planogram.fields[4] = psaNumber(plan.fixtureHeight);
  lines[planogram.line] = joinPsaFields(planogram.fields);

  let sectionX = 0;
  const blockEnd = plan.sourcePlanogramEndLine ?? Number.POSITIVE_INFINITY;
  const inSelectedBlock = (record: PsaRecord) =>
    record.line > planogram.line && record.line < blockEnd;
  const segmentRecords = records.filter(
    (record) => record.fields[0] === "Segment" && inSelectedBlock(record),
  );
  plan.sections.forEach((section, index) => {
    const record = segmentRecords[index];
    if (record) {
      record.fields[4] = psaNumber(section.width);
      record.fields[10] = psaNumber(sectionX);
      lines[record.line] = joinPsaFields(record.fields);
    }
    sectionX += section.width;
  });
  if (plan.sections.length !== segmentRecords.length)
    warnings.push("Added or removed sections were not written because the source PSA has a different segment count.");

  const productById = new Map(plan.products.map((product) => [product.id, product]));
  const productBySource = new Map(
    plan.products.filter((product) => product.sourceId).map((product) => [product.sourceId!, product]),
  );
  let skippedProducts = 0;
  for (const product of plan.products) {
    if (product.sourceLine == null || product.sourceLine < 0 || !lines[product.sourceLine]) {
      if (!product.sourceId) skippedProducts++;
      continue;
    }
    const fields = splitPsaLine(lines[product.sourceLine] ?? "");
    if (fields[0] !== "Product") continue;
    const resolved = jdaIdentifiers(product);
    fields[1] = resolved.upc10 || fields[1] || "";
    fields[2] = resolved.id || fields[2] || "";
    fields[3] = product.name;
    fields[5] = psaNumber(product.width);
    fields[6] = psaNumber(product.height);
    fields[7] = psaNumber(product.depth);
    fields[13] = product.category || fields[13] || "";
    if (product.manufacturer) {
      if (fields[14] && !/^\d+$/.test(fields[14])) fields[14] = product.manufacturer;
      else fields[12] = product.manufacturer;
    }
    if (fields.length > 232 && product.brand) fields[232] = product.brand;
    lines[product.sourceLine] = joinPsaFields(fields);
  }
  if (skippedProducts)
    warnings.push(`${skippedProducts} newly created product${skippedProducts === 1 ? " was" : "s were"} not added to the PSA.`);

  const originalPositions = records.filter(
    (record) => record.fields[0] === "Position" && inSelectedBlock(record),
  );
  const positionTemplates = new Map<string, string[]>();
  originalPositions.forEach((record) => {
    const sourceId = record.fields[1]?.trim();
    if (sourceId && !positionTemplates.has(sourceId)) positionTemplates.set(sourceId, record.fields);
  });
  const usedPositionLines = new Set<number>();
  const appendedPositions: string[] = [];
  let skippedPlacements = 0;
  let createdPlacements = 0;
  let currentSectionX = 0;
  const fixturePositions = new Map<number, number>();

  const patchPosition = (
    fields: string[],
    product: PsaExportProduct,
    absoluteX: number,
    positionY: number,
    facings: number,
  ) => {
    const dimensions = orientedDimensions(product),
      resolved = jdaIdentifiers(product);
    const verticalFacings = Math.max(1, Math.round(positiveAt(fields, 15, 1)));
    const depthFacings = Math.max(
      1,
      Math.ceil(Math.max(1, product.unitsPerFacing ?? 1) / verticalFacings),
    );
    fields[1] = resolved.upc10 || fields[1] || "";
    fields[2] = resolved.id || fields[2] || "";
    fields[4] = psaNumber(absoluteX);
    fields[5] = psaNumber(dimensions.width * facings);
    fields[6] = psaNumber(positionY);
    fields[7] = psaNumber(dimensions.height * verticalFacings);
    fields[9] = psaNumber(dimensions.depth * depthFacings);
    fields[14] = String(facings);
    fields[15] = String(verticalFacings);
    fields[16] = String(depthFacings);
    fields[33] = psaNumber(dimensions.width);
    fields[34] = psaNumber(dimensions.height);
    fields[35] = psaNumber(dimensions.depth);
    fields[36] = psaNumber(dimensions.width);
    fields[37] = psaNumber(dimensions.height);
    fields[38] = psaNumber(dimensions.depth);
    fields[42] = positionOrientationCode(product);
    return joinPsaFields(fields);
  };

  for (const section of plan.sections) {
    let heightUsed = 0;
    for (const shelf of section.shelves) {
      heightUsed += Math.max(1, Number(shelf.height) || 1);
      const positionY = Math.max(1, plan.fixtureHeight - heightUsed + 1);
      if (shelf.sourceFixtureLine != null && shelf.sourceFixtureLine >= 0) {
        const prior = fixturePositions.get(shelf.sourceFixtureLine);
        if (prior == null) fixturePositions.set(shelf.sourceFixtureLine, positionY);
        else if (Math.abs(prior - positionY) > 0.05)
          warnings.push("A shelf shared across multiple sections can only have one height in PSA; the first section's position was used.");
      }
      for (const placement of shelf.placements) {
        const product = productById.get(placement.productId);
        if (!product?.sourceId) {
          skippedPlacements++;
          continue;
        }
        const shelfWidth = Math.max(1, shelf.width ?? section.width);
        const absoluteX = currentSectionX + (Math.max(0, Math.min(100, placement.x)) / 100) * shelfWidth;
        const facings = Math.max(1, Math.round(placement.facings));
        if (
          placement.sourceLine != null &&
          !usedPositionLines.has(placement.sourceLine) &&
          lines[placement.sourceLine] &&
          splitPsaLine(lines[placement.sourceLine] ?? "")[0] === "Position"
        ) {
          const fields = splitPsaLine(lines[placement.sourceLine] ?? "");
          lines[placement.sourceLine] = patchPosition(fields, product, absoluteX, positionY, facings);
          usedPositionLines.add(placement.sourceLine);
        } else {
          const template = positionTemplates.get(product.sourceId);
          if (!template) {
            skippedPlacements++;
            continue;
          }
          appendedPositions.push(
            patchPosition([...template], product, absoluteX, positionY, facings),
          );
          createdPlacements++;
        }
      }
    }
    currentSectionX += section.width;
  }

  fixturePositions.forEach((positionY, line) => {
    if (!lines[line]) return;
    const fields = splitPsaLine(lines[line] ?? "");
    if (fields[0] !== "Fixture") return;
    const thickness = positiveAt(fields, 7, 1);
    fields[6] = psaNumber(Math.max(0, positionY - thickness));
    lines[line] = joinPsaFields(fields);
  });

  originalPositions.forEach((record) => {
    if (!usedPositionLines.has(record.line)) lines[record.line] = null;
  });
  if (appendedPositions.length) {
    let insertAt = Math.min(blockEnd, lines.length);
    while (insertAt > planogram.line + 1 && !lines[insertAt - 1]?.trim()) insertAt--;
    lines.splice(insertAt, 0, ...appendedPositions);
  }
  if (createdPlacements)
    warnings.push(`${createdPlacements} new placement${createdPlacements === 1 ? " was" : "s were"} created from the product's PSA template.`);
  if (skippedPlacements)
    warnings.push(`${skippedPlacements} placement${skippedPlacements === 1 ? " was" : "s were"} skipped because no compatible PSA product template exists.`);

  const output = lines.filter((line): line is string => line !== null).join(hadCrLf ? "\r\n" : "\n");
  return { text: output, bytes: encodeWindows1252(output), warnings };
}
