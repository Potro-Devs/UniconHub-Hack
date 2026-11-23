/**
 * Configuración centralizada de marca, colores y etiquetas de nivel.
 * Permite reemplazar el nombre provisional sin refactorizar componentes.
 */
export const APP_NAME = 'Axi';

export const COLORS = {
  ink: '#18203A',
  muted: '#4A5573',
  mutedLight: '#8A93AB',
  bg: '#F3F6FB',
  border: '#DDE3EE',
  borderInput: '#C9D1E0',
  primary: 'oklch(0.5 0.2 268)',
  primaryHover: 'oklch(0.44 0.2 268)',
  primaryText: 'oklch(0.45 0.2 268)',
  primarySoftBg: 'oklch(0.95 0.035 268)',
  primarySoftFg: 'oklch(0.42 0.2 268)',
  primaryAccent: 'oklch(0.54 0.2 268)',
};

export const LEVELS = [
  {
    code: 'needs_support',
    label: 'Necesita apoyo',
    range: '0–39%',
    bg: 'oklch(0.91 0.06 25)',
    fg: 'oklch(0.42 0.14 25)',
    solid: 'oklch(0.66 0.17 25)',
  },
  {
    code: 'in_progress',
    label: 'En proceso',
    range: '40–64%',
    bg: 'oklch(0.94 0.08 90)',
    fg: 'oklch(0.4 0.09 75)',
    solid: 'oklch(0.8 0.15 80)',
  },
  {
    code: 'achieved',
    label: 'Logrado',
    range: '65–84%',
    bg: 'oklch(0.91 0.07 165)',
    fg: 'oklch(0.38 0.1 165)',
    solid: 'oklch(0.68 0.14 165)',
  },
  {
    code: 'mastered',
    label: 'Dominado',
    range: '85–100%',
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

export const getLevelIndex = (pct) => {
  if (pct < 40) return 0;
  if (pct < 65) return 1;
  if (pct < 85) return 2;
  return 3;
};

export const getDotsForLevel = (levelIdx) =>
  '●'.repeat(levelIdx + 1) + '○'.repeat(3 - levelIdx);
