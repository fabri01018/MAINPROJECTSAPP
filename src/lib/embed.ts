/** PostgREST may return embedded many-to-one rows as an object or a single-element array. */
export function one<T>(row: T | T[] | null | undefined): T | null {
  if (row == null) return null
  return Array.isArray(row) ? (row[0] ?? null) : row
}
