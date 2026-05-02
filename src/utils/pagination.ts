// src/utils/pagination.ts
export function getPagination(page: number | string = 1, size: number | string = 20) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.max(1, Number(size) || 20);
  const limit = Math.floor(s);
  const offset = (p - 1) * limit;
  return { limit, offset };
}
