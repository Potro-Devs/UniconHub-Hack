/**
 * Configuración centralizada de marca, colores y etiquetas de nivel.
 * Permite reemplazar el nombre provisional sin refactorizar componentes.
 */
export const APP_NAME = 'Axi';
export const TEAM_LEARNING_NAME = 'Aprendemos en equipo';
export const TEAM_LEARNING_SHORT_NAME = 'En equipo';

export const COLORS = {
  ink: '#18203A',
  muted: '#4A5573',
  mutedLight: '#8A93AB',
  subtle: '#64748B',
  bg: '#F2F4FC',
  surfaceSubtle: '#F7F8FE',
  border: '#DDE1F1',
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
  surface: '#FFFFFF',
  onPrimary: '#FFFFFF',
  focusRing: 'oklch(0.5 0.2 268)',
  borderDashed: '#C3CCDD',
  skeleton: '#E6EBF3',
  alertBg: 'oklch(0.95 0.04 25)',
  alertFg: 'oklch(0.4 0.13 25)',
  alertBorder: 'oklch(0.8 0.08 25)',
  successFg: 'oklch(0.36 0.1 165)',
  noticeBg: 'oklch(0.96 0.05 90)',
  noticeFg: 'oklch(0.38 0.08 75)',
  playfulCoral: '#FAAD9D',
  playfulTeal: '#D0F0E8',
  playfulTealBorder: '#8DC8BB',
  playfulTealShadow: '#B2D9CF',
  playfulTealFg: '#226251',
  playfulTealDeep: '#154B3C',
  playfulTealAccent: '#A4D6C9',
  playfulYellow: '#FFE49A',
  playfulLilac: '#E7DFFD',
  playfulLilacGlow: '#E5E0FC',
  playfulLilacBorder: '#D8D2FA',
  shadowSoft: 'rgb(40 48 96 / 6%)',
  shadowPrimary: 'rgb(65 57 168 / 18%)',
  shadowHover: 'rgb(40 48 96 / 10%)',
  gameMascotOverlay: 'rgb(255 255 255 / 60%)',
  gamePreviewShadow: 'rgb(80 40 40 / 12%)',
  gamePreviewGridLine: 'rgb(255 255 255 / 53.3%)',
  gameBlockGridLine: 'rgb(255 255 255 / 60%)',
};

export const KID_COLORS = {
  primary: '#4D43AD', 'primary-dark': '#332B82', muted: COLORS.muted,
  ink: COLORS.ink, border: '#D9D7E7', 'mission-bg': '#ECE8FF',
  'mission-border': '#D5D0F5', sun: '#F3AD30', warm: '#FFF1CC',
  'warm-ink': '#805615', 'reading-bg': '#D0F0E8', 'reading-ink': '#226251',
};

/** Dibujos de los reactivos de fracciones (pizza, pastel, chocolate). En papel van solo con contorno. */
export const FOOD_COLORS = {
  outline: '#5B3A1E',
  crust: '#E7A54B', cheese: '#FAD56A', sauce: '#E0703A',
  mushroomCap: '#F3E6D4', mushroomStem: '#FFF8EE',
  frosting: '#F6A9C0', cake: '#FDE2EA', cakeLine: '#D9789A',
  strawberry: '#E2384D', leaf: '#3E9B4F', seed: '#FFE9A8',
  chocolate: '#7A4A2B', chocolateLight: '#99633F', eaten: '#B98E70',
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
