export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("size must be a positive integer");
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export function stableMemoKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.map((part) => `${typeof part}:${String(part ?? "")}`).join("|");
}
