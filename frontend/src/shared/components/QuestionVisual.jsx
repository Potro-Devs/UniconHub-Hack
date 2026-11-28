import { COLORS } from '@/config/brand';
import { describeVisual, toFractionBar } from './questionVisual.logic';

/**
 * Gráfico de un reactivo, de solo lectura (no se toca: es parte de la pregunta).
 * Mismo lenguaje visual que el material de los juegos: el entero con borde y las partes pintadas
 * rellenas. Para lectores de pantalla es una imagen con su descripción.
 */
export function QuestionVisual({ visual }) {
  const bar = toFractionBar(visual);
  if (!bar) return null;
  return (
    <div
      role="img"
      aria-label={describeVisual(visual)}
      style={{
        width: 'min(100%, 460px)',
        display: 'grid',
        gridTemplateColumns: `repeat(${bar.parts}, minmax(0, 1fr))`,
        gap: '4px',
        padding: '4px',
        border: `3px solid ${COLORS.primary}`,
        borderRadius: '16px',
        background: COLORS.surface,
      }}
    >
      {Array.from({ length: bar.parts }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            minHeight: '56px',
            borderRadius: '8px',
            border: `1px solid ${COLORS.borderInput}`,
            background: i < bar.shaded ? COLORS.primary : COLORS.surface,
          }}
        />
      ))}
    </div>
  );
}
