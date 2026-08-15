export const KNOWN_SYMBOL_SUGGESTION_LIMIT = 8;

export const normalizeKnownSymbol = (value) => (
  String(value ?? '').trim().toUpperCase()
);

export function buildKnownSymbolSuggestions(
  records,
  query = '',
  limit = KNOWN_SYMBOL_SUGGESTION_LIMIT,
) {
  if (!Array.isArray(records)) return [];

  const boundedLimit = Number.isSafeInteger(limit) && limit > 0
    ? Math.min(limit, 50)
    : KNOWN_SYMBOL_SUGGESTION_LIMIT;
  const normalizedQuery = normalizeKnownSymbol(query);
  const seen = new Set();
  const suggestions = [];

  for (const record of records) {
    const symbol = normalizeKnownSymbol(record?.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    if (normalizedQuery && !symbol.startsWith(normalizedQuery)) continue;
    suggestions.push(symbol);
    if (suggestions.length >= boundedLimit) break;
  }

  return suggestions;
}
