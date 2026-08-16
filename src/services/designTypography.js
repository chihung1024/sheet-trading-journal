const ALLOWED_TYPOGRAPHY_TOKENS = Object.freeze(new Set([
  '--type-caption',
  '--type-label',
  '--type-body',
  '--type-control',
  '--type-emphasis',
  '--type-section',
  '--type-page',
  '--type-metric-sm',
  '--type-metric',
]));

export const resolveSemanticFontPx = (token, { documentRef = globalThis.document } = {}) => {
  if (!ALLOWED_TYPOGRAPHY_TOKENS.has(token)) return null;
  if (!documentRef?.createElement || !documentRef?.defaultView?.getComputedStyle) return null;

  const host = documentRef.body || documentRef.documentElement;
  if (!host?.appendChild) return null;

  const probe = documentRef.createElement('span');
  probe.setAttribute?.('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = `var(${token})`;
  host.appendChild(probe);

  try {
    const computed = documentRef.defaultView.getComputedStyle(probe).fontSize;
    const value = Number.parseFloat(computed);
    return Number.isFinite(value) && value > 0 ? value : null;
  } finally {
    probe.remove?.();
  }
};

export const buildCanvasSemanticFont = ({
  token = '--type-label',
  weight = 700,
  family = "'JetBrains Mono', monospace",
  documentRef = globalThis.document,
} = {}) => {
  const sizePx = resolveSemanticFontPx(token, { documentRef });
  return sizePx === null ? null : `${weight} ${sizePx}px ${family}`;
};

export const __test = Object.freeze({ ALLOWED_TYPOGRAPHY_TOKENS });
