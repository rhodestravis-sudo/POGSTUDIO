const digits = (value?: string) => String(value ?? "").replace(/\D/g, "");

export const gtinCheckDigit = (body: string) => {
  const sum = [...body]
    .reverse()
    .reduce(
      (total, character, index) =>
        total + Number(character) * (index % 2 === 0 ? 3 : 1),
      0,
    );
  return String((10 - (sum % 10)) % 10);
};

export const isValidGtin = (value: string) =>
  [8, 12, 13, 14].includes(value.length) &&
  gtinCheckDigit(value.slice(0, -1)) === value.slice(-1);

const addUnique = (target: string[], value: string) => {
  if (value && !target.includes(value)) target.push(value);
};

/**
 * Converts retail shorthand and JDA/Blue Yonder IDs into scannable GTINs.
 * A common JDA value is the 12-digit EAN body without its check digit, e.g.
 * 002840031041 -> 0028400310413 -> UPC-A 028400310413.
 */
export const lookupBarcodes = (item: { upc?: string; sku?: string }) => {
  const sourceValues = [digits(item.upc), digits(item.sku)].filter(Boolean);
  const values: string[] = [];
  for (const value of sourceValues) {
    // PSA files often left-pad a 10-digit retail code to create a longer ID.
    // Search the code the user would get by deleting those padding zeroes,
    // while retaining the original identifier as a later fallback.
    if (value.startsWith("00") && !isValidGtin(value)) {
      const unpadded = value.replace(/^0+/, "");
      if (unpadded.length >= 8) addUnique(values, unpadded);
    }
    addUnique(values, value);
  }
  const candidates: string[] = [];

  // Prefer a true 10-digit retail UPC shorthand over a longer internal ID.
  for (const value of values.filter((candidate) => candidate.length === 10)) {
    const upcBody = `0${value}`;
    addUnique(candidates, upcBody + gtinCheckDigit(upcBody));
  }

  // Prefer valid, complete GTINs as supplied. A leading-zero EAN is also UPC-A.
  for (const value of values.filter(isValidGtin)) {
    if (value.length === 13 && value.startsWith("0"))
      addUnique(candidates, value.slice(1));
    addUnique(candidates, value);
  }

  for (const value of values) {
    if (value.length === 11) {
      addUnique(candidates, value + gtinCheckDigit(value));
      continue;
    }

    if (value.length === 12 && !isValidGtin(value)) {
      // JDA can store the 12-digit EAN body as the product ID.
      const ean = value + gtinCheckDigit(value);
      if (ean.startsWith("0")) addUnique(candidates, ean.slice(1));
      addUnique(candidates, ean);

      // Some imports pad the familiar 10-digit retail code with two zeroes.
      if (value.startsWith("00")) {
        const upcBody = `0${value.slice(2)}`;
        addUnique(candidates, upcBody + gtinCheckDigit(upcBody));
      }
      continue;
    }

    if (value.length >= 8 && value.length <= 14)
      addUnique(candidates, value);
  }

  return candidates;
};
