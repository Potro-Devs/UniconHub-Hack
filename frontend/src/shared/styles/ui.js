/**
 * Estilos reutilizables (en línea) construidos con los tokens de `config/brand.js`.
 * Cambiar la identidad visual = cambiar los tokens, no los componentes.
 */
import { COLORS } from '@/config/brand';

export const card = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '22px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  minWidth: 0,
  boxShadow: '0 6px 24px rgb(39 49 96 / 5%)',
};

const baseButton = {
  minHeight: '48px',
  padding: '0 18px',
  borderRadius: '14px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  textAlign: 'center',
  lineHeight: 1.2,
  transition: 'background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
};

/** @param {'primary' | 'secondary' | 'ghost'} variant */
export function buttonStyle(variant = 'secondary', { disabled = false, fullWidth = false, tall = false } = {}) {
  const variants = {
    primary: { border: 0, background: COLORS.primary, color: COLORS.onPrimary },
    secondary: { border: `1px solid ${COLORS.borderInput}`, background: COLORS.surface, color: COLORS.ink },
    ghost: { border: 0, background: 'transparent', color: COLORS.primaryText, padding: '0 10px' },
  };
  return {
    ...baseButton,
    ...variants[variant],
    ...(tall ? { minHeight: '54px', fontSize: '17px' } : null),
    ...(fullWidth ? { width: '100%' } : null),
    ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : null),
  };
}

export const pageTitle = { margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 };

export const sectionTitle = { margin: 0, fontWeight: 700, fontSize: '22px', lineHeight: 1.2 };

export const mutedText = { fontSize: '15px', color: COLORS.muted, lineHeight: 1.45 };

export const inputStyle = {
  minHeight: '48px',
  width: '100%',
  borderRadius: '14px',
  border: `1px solid ${COLORS.borderInput}`,
  padding: '10px 14px',
  fontSize: '16px',
  background: COLORS.surface,
};

export const alertBox = {
  padding: '14px 16px',
  borderRadius: '16px',
  background: COLORS.alertBg,
  color: COLORS.alertFg,
  border: `1px solid ${COLORS.alertBorder}`,
  fontSize: '15px',
  lineHeight: 1.45,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

export const noticeBox = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: COLORS.noticeBg,
  color: COLORS.noticeFg,
  fontSize: '15px',
  lineHeight: 1.45,
  fontWeight: 600,
};

export const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 10px',
  borderRadius: '999px',
  background: COLORS.primarySoftBg,
  color: COLORS.primarySoftFg,
  fontSize: '13px',
  fontWeight: 700,
};
