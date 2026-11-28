// Nota: backend/src/shared/pdf/axi-sheet.js replica la geometría vectorial de Mascot.jsx en B/N;
// si cambias la mascota, actualiza también ese archivo.
import { APP_NAME } from '@/config/brand';

export const MASCOT_PALETTES = {
  rosa: {
    body: 'oklch(0.86 0.085 355)',
    belly: 'oklch(0.94 0.04 355)',
    gill: 'oklch(0.7 0.16 0)',
    tip: 'oklch(0.6 0.19 5)',
    spot: 'oklch(0.76 0.11 355)',
    blush: 'oklch(0.76 0.14 15)',
    hl: 'rgba(255,255,255,.55)',
    line: 'none',
  },
  azul: {
    body: 'oklch(0.85 0.08 225)',
    belly: 'oklch(0.94 0.035 225)',
    gill: 'oklch(0.62 0.15 255)',
    tip: 'oklch(0.52 0.17 262)',
    spot: 'oklch(0.75 0.1 232)',
    blush: 'oklch(0.79 0.11 15)',
    hl: 'rgba(255,255,255,.55)',
    line: 'none',
  },
  amarillo: {
    body: 'oklch(0.91 0.11 95)',
    belly: 'oklch(0.97 0.05 95)',
    gill: 'oklch(0.74 0.15 50)',
    tip: 'oklch(0.65 0.17 40)',
    spot: 'oklch(0.83 0.12 85)',
    blush: 'oklch(0.79 0.12 25)',
    hl: 'rgba(255,255,255,.6)',
    line: 'none',
  },
  lila: {
    body: 'oklch(0.85 0.075 305)',
    belly: 'oklch(0.94 0.035 305)',
    gill: 'oklch(0.62 0.17 325)',
    tip: 'oklch(0.53 0.18 330)',
    spot: 'oklch(0.76 0.1 305)',
    blush: 'oklch(0.77 0.12 0)',
    hl: 'rgba(255,255,255,.55)',
    line: 'none',
  },
  linea: {
    body: '#fff',
    belly: '#fff',
    gill: '#fff',
    tip: '#fff',
    spot: '#000',
    blush: 'transparent',
    hl: 'transparent',
    line: '3px solid #000',
  },
};

export const STATE_TO_MOOD = {
  default: 'feliz',
  hint: 'pista',
  correct: 'acierto',
  celebrate: 'celebra',
  encourage: 'calma',
};

export const SIZE_MAP = {
  sm: 44,
  md: 104,
  lg: 180,
};

/**
 * Manifiesto centralizado de archivos de imagen externos opcionales en ./assets/.
 * Al registrar rutas aquí, Mascot.jsx las usa con fallback automático al avatar vectorial.
 */
export const mascotConfig = {
  defaultState: 'default',
  altText: `Mascota ${APP_NAME}`,
  states: {
    default: null,
    hint: null,
    correct: null,
    celebrate: null,
    encourage: null,
  },
};
