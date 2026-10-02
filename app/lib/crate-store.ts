import type { Crate } from "./packing";

/** Key of the old single-crate record. Read once, then migrated. */
export const CRATE_STORAGE_KEY = "olho-na-caixa.crate";

/** Key of the crate book: every model this browser knows, plus the active one. */
export const CRATE_BOOK_KEY = "olho-na-caixa.crates";

export type CrateBook = {
  crates: Crate[];
  /** Name of the crate the screens use. Null when the book is empty. */
  active: string | null;
};

export function emptyBook(): CrateBook {
  return { crates: [], active: null };
}

/** A crate is usable when it has a name and three positive inner dimensions. */
export function isCrate(value: unknown): value is Crate {
  if (!value || typeof value !== "object") return false;
  const crate = value as Crate;
  return (
    typeof crate.name === "string" &&
    crate.name.trim().length > 0 &&
    crate.lengthCm > 0 &&
    crate.widthCm > 0 &&
    crate.heightCm > 0
  );
}

/** Parse a stored book. Anything incomplete falls out, so one bad record never blocks the screens. */
export function parseBook(raw: string | null): CrateBook {
  if (!raw) return emptyBook();
  try {
    const parsed = JSON.parse(raw) as Partial<CrateBook>;
    const crates = Array.isArray(parsed.crates) ? parsed.crates.filter(isCrate) : [];
    const active =
      typeof parsed.active === "string" && crates.some((crate) => crate.name === parsed.active)
        ? parsed.active
        : (crates[0]?.name ?? null);
    return { crates, active };
  } catch {
    return emptyBook();
  }
}

/** Fold the old single-crate record into an empty book, once. */
export function migrateLegacy(legacy: unknown, book: CrateBook): CrateBook {
  if (book.crates.length > 0 || !isCrate(legacy)) return book;
  return { crates: [legacy], active: legacy.name };
}

/** Add a crate or replace the one with the same name. The saved crate becomes active. */
export function upsertCrate(book: CrateBook, crate: Crate): CrateBook {
  const crates = book.crates.some((entry) => entry.name === crate.name)
    ? book.crates.map((entry) => (entry.name === crate.name ? crate : entry))
    : [...book.crates, crate];
  return { crates, active: crate.name };
}

/** Drop a crate by name. When the active one goes, the first survivor takes over. */
export function removeCrate(book: CrateBook, name: string): CrateBook {
  const crates = book.crates.filter((crate) => crate.name !== name);
  const active =
    book.active === name ? (crates[0]?.name ?? null) : book.active;
  return { crates, active };
}

/** Point the screens at one of the saved crates. Unknown names change nothing. */
export function setActive(book: CrateBook, name: string): CrateBook {
  if (!book.crates.some((crate) => crate.name === name)) return book;
  return { ...book, active: name };
}

/** The crate the screens use, or null when the book has none. */
export function activeCrate(book: CrateBook): Crate | null {
  return book.crates.find((crate) => crate.name === book.active) ?? null;
}

/** Read the book on this browser, migrating the old single-crate record on first sight. */
export function readBook(): CrateBook {
  if (typeof window === "undefined") return emptyBook();
  const book = parseBook(window.localStorage.getItem(CRATE_BOOK_KEY));
  if (book.crates.length > 0) return book;
  const migrated = migrateLegacy(parseLegacy(window.localStorage.getItem(CRATE_STORAGE_KEY)), book);
  if (migrated.crates.length > 0) writeBook(migrated);
  return migrated;
}

/** Remember the book on this browser. There is no server copy. */
export function writeBook(book: CrateBook): void {
  window.localStorage.setItem(CRATE_BOOK_KEY, JSON.stringify(book));
}

function parseLegacy(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
