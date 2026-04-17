export function isNoSelectionGenre(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'all' || normalized === 'none';
}

export function buildCatalogExtraFromQuery(
  query: Record<string, unknown> | undefined
): Record<string, string> {
  const extra: Record<string, string> = {};
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        extra[key] = value;
        continue;
      }
      if (Array.isArray(value) && typeof value[0] === 'string') {
        extra[key] = value[0];
      }
    }
  }

  if (!extra.skip) extra.skip = '0';
  if (!extra.search) extra.search = '';

  return extra;
}
