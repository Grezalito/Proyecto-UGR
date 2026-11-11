/**
 * Íconos disponibles para categorías. Módulo sin dependencias de React:
 * lo usan tanto la API (validación) como la UI.
 */
export const CATEGORY_ICON_NAMES = [
  "Package",
  "Milk",
  "CupSoda",
  "SprayCan",
  "Croissant",
  "Carrot",
  "Apple",
  "Beef",
  "Fish",
  "Drumstick",
  "Egg",
  "Cookie",
  "Candy",
  "Wine",
  "Snowflake",
  "Baby",
  "PawPrint",
  "Pill",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = "Package";

export function isCategoryIconName(v: unknown): v is CategoryIconName {
  return typeof v === "string" && (CATEGORY_ICON_NAMES as readonly string[]).includes(v);
}

/** Quita tildes y pasa a minúsculas: "Verdulería" → "verduleria". */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** "Fiambres y Quesos" → "fiambres-y-quesos". */
export function slugify(s: string): string {
  return normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const KEYWORDS: [RegExp, CategoryIconName][] = [
  [/verdu|fruta|hortaliz/, "Carrot"],
  [/carni|carne|fiambre/, "Beef"],
  [/pesca|pescad|mar/, "Fish"],
  [/pollo|granja|avicola/, "Drumstick"],
  [/huevo/, "Egg"],
  [/pan|factura|reposter/, "Croissant"],
  [/galletit|snack|desayuno/, "Cookie"],
  [/golosin|dulce|kiosco/, "Candy"],
  [/vino|licor|alcohol|cerveza/, "Wine"],
  [/bebida|gaseosa|jugo|agua/, "CupSoda"],
  [/lacte|leche|queso|yogur/, "Milk"],
  [/congelad|helad|frio/, "Snowflake"],
  [/limpie|higiene|perfumer/, "SprayCan"],
  [/bebe|panal|infant/, "Baby"],
  [/mascota|perro|gato/, "PawPrint"],
  [/farmac|salud|remedio/, "Pill"],
];

/** Sugiere un ícono a partir del nombre de la categoría. */
export function guessCategoryIcon(name: string): CategoryIconName {
  const n = normalizeText(name);
  return KEYWORDS.find(([re]) => re.test(n))?.[1] ?? DEFAULT_CATEGORY_ICON;
}
