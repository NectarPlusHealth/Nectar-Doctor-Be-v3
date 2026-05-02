// src/utils/sort.ts
export function resolveOrder(listOrder: { ASC: number; DESC: number }, raw: any) {
  const key = typeof raw === "string" ? raw.toUpperCase() : String(raw);
  return listOrder[key as "ASC" | "DESC"] ?? listOrder.ASC;
}
