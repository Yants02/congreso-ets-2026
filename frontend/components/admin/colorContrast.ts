/**
 * Utilidad para cálculo de luminancia y ratio de contraste WCAG 2.1
 * Estándar:
 * - AA Normal text: ratio >= 4.5:1
 * - AA Large text / UI components: ratio >= 3.0:1
 * - AAA Normal text: ratio >= 7.0:1
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let cleanHex = hex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return null;

  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export interface ContrastResult {
  ratio: number;
  score: 'AAA' | 'AA' | 'Fallo';
  isAccessible: boolean;
  message: string;
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): ContrastResult | null {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);

  if (!fg || !bg) return null;

  const lumFg = getLuminance(fg.r, fg.g, fg.b);
  const lumBg = getLuminance(bg.r, bg.g, bg.b);

  const brighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);

  const ratio = (brighter + 0.05) / (darker + 0.05);
  const roundedRatio = Math.round(ratio * 100) / 100;

  if (roundedRatio >= 7.0) {
    return {
      ratio: roundedRatio,
      score: 'AAA',
      isAccessible: true,
      message: `Excelente (${roundedRatio}:1 · Nivel AAA)`,
    };
  }

  if (roundedRatio >= 4.5) {
    return {
      ratio: roundedRatio,
      score: 'AA',
      isAccessible: true,
      message: `Aceptable (${roundedRatio}:1 · Nivel AA)`,
    };
  }

  if (roundedRatio >= 3.0) {
    return {
      ratio: roundedRatio,
      score: 'AA',
      isAccessible: true,
      message: `Aceptable solo texto grande/botones (${roundedRatio}:1)`,
    };
  }

  return {
    ratio: roundedRatio,
    score: 'Fallo',
    isAccessible: false,
    message: `⚠️ Contraste bajo (${roundedRatio}:1 · Ilegible)`,
  };
}
