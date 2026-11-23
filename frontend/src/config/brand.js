/**
 * Configuración centralizada de marca, colores y etiquetas de nivel.
 * Permite reemplazar el nombre provisional sin refactorizar componentes.
 */
export const APP_NAME = 'Axi';

export const COLORS = {
  ink: '#18203A',
  muted: '#4A5573',
  mutedLight: '#8A93AB',
  subtle: '#64748B',
  bg: '#F3F6FB',
  surfaceSubtle: '#F8FAFC',
  border: '#DDE3EE',
  borderInput: '#C9D1E0',
  primary: 'oklch(0.5 0.2 268)',
  primaryHover: 'oklch(0.44 0.2 268)',
  primaryText: 'oklch(0.45 0.2 268)',
  primarySoftBg: 'oklch(0.95 0.035 268)',
  primarySoftFg: 'oklch(0.42 0.2 268)',
  primaryAccent: 'oklch(0.54 0.2 268)',
  celebrationBg: '#FACC15',
  celebrationFg: '#18203A',
  lilacSoftBg: '#F3E8FF',
  lilacSoftFg: '#581C87',
};

export const LEVELS = [
  {
    code: 'needs_support',
    label: 'Necesita apoyo',
    min: 0,
    range: '0–24%',
    bg: 'oklch(0.91 0.06 25)',
    fg: 'oklch(0.42 0.14 25)',
    solid: 'oklch(0.66 0.17 25)',
  },
  {
    code: 'in_progress',
    label: 'En proceso',
    min: 25,
    range: '25–49%',
    bg: 'oklch(0.94 0.08 90)',
    fg: 'oklch(0.4 0.09 75)',
    solid: 'oklch(0.8 0.15 80)',
  },
  {
    code: 'achieved',
    label: 'Logrado',
    min: 50,
    range: '50–74%',
    bg: 'oklch(0.91 0.07 165)',
    fg: 'oklch(0.38 0.1 165)',
    solid: 'oklch(0.68 0.14 165)',
  },
  {
    code: 'mastered',
    label: 'Dominado',
    min: 75,
    range: '75–100%',
    bg: 'oklch(0.88 0.08 268)',
    fg: 'oklch(0.36 0.18 268)',
    solid: 'oklch(0.55 0.2 268)',
  },
];

export const STUDENT_AVATAR_HUES = [
  'oklch(0.86 0.09 355)',
  'oklch(0.9 0.11 90)',
  'oklch(0.86 0.08 200)',
  'oklch(0.87 0.08 150)',
];

/**
 * Índice de nivel según la escala de intervalos estrictos de 25% (AGENTS.md §4.3):
 * 0–24.99 Necesita apoyo · 25–49.99 En proceso · 50–74.99 Logrado · 75–100 Dominado.
 * Temporal para vistas con datos semilla; la fuente de verdad es el backend (`analytics.domain.js`).
 */
export const getLevelIndex = (pct) => {
  const rounded = Math.round(pct * 100) / 100;
  if (rounded < LEVELS[1].min) return 0;
  if (rounded < LEVELS[2].min) return 1;
  if (rounded < LEVELS[3].min) return 2;
  return 3;
};

export const getDotsForLevel = (levelIdx) =>
  '●'.repeat(levelIdx + 1) + '○'.repeat(3 - levelIdx);
