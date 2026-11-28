import { COLORS, FOOD_COLORS as F } from '@/config/brand';
import { chocolateGrid, circleSlices, describeVisual, toVisual } from './questionVisual.logic';

/**
 * Gráfico de un reactivo, de solo lectura (no se toca: es parte de la pregunta).
 * - Tira `plain`: el entero con borde y las partes pintadas rellenas (lenguaje de los juegos).
 * - Pizza / pastel: rebanadas iguales; las marcadas llevan champiñones o fresas.
 * - Chocolate: cuadritos iguales; los que se comieron quedan solo con contorno punteado.
 * En papel se dibuja lo mismo solo con contorno (`backend/src/shared/pdf/question-visual.js`).
 * Para lectores de pantalla es una imagen con su descripción.
 */
export function QuestionVisual({ visual }) {
  const v = toVisual(visual);
  if (!v) return null;
  const label = describeVisual(v);
  if (v.type === 'fraction_circle') return <FoodCircle v={v} label={label} />;
  if (v.theme === 'chocolate') return <ChocolateBar v={v} label={label} />;
  return <PlainBar v={v} label={label} />;
}

function PlainBar({ v, label }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: 'min(100%, 460px)',
        display: 'grid',
        gridTemplateColumns: `repeat(${v.parts}, minmax(0, 1fr))`,
        gap: '4px',
        padding: '4px',
        border: `3px solid ${COLORS.primary}`,
        borderRadius: '16px',
        background: COLORS.surface,
      }}
    >
      {Array.from({ length: v.parts }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            minHeight: '56px',
            borderRadius: '8px',
            border: `1px solid ${COLORS.borderInput}`,
            background: i < v.shaded ? COLORS.primary : COLORS.surface,
          }}
        />
      ))}
    </div>
  );
}

function Mushroom({ x, y, s }) {
  return (
    <g>
      <rect x={x - s * 0.35} y={y} width={s * 0.7} height={s * 0.85} rx={s * 0.2} fill={F.mushroomStem} stroke={F.outline} strokeWidth="1.5" />
      <path d={`M ${x - s} ${y + 1} A ${s} ${s} 0 0 1 ${x + s} ${y + 1} Z`} fill={F.mushroomCap} stroke={F.outline} strokeWidth="1.5" />
    </g>
  );
}

function Strawberry({ x, y, s }) {
  return (
    <g>
      <path
        d={`M ${x - s} ${y - s * 0.3} Q ${x - s} ${y + s * 0.6} ${x} ${y + s * 1.1} Q ${x + s} ${y + s * 0.6} ${x + s} ${y - s * 0.3} Q ${x} ${y - s * 0.9} ${x - s} ${y - s * 0.3} Z`}
        fill={F.strawberry}
        stroke={F.outline}
        strokeWidth="1.2"
      />
      <path d={`M ${x - s * 0.6} ${y - s * 0.75} L ${x} ${y - s * 0.4} L ${x + s * 0.6} ${y - s * 0.75}`} fill="none" stroke={F.leaf} strokeWidth="2.5" strokeLinecap="round" />
      {[[-0.4, 0.1], [0.4, 0.1], [0, 0.55]].map(([dx, dy]) => (
        <circle key={`${dx}${dy}`} cx={x + dx * s} cy={y + dy * s} r="1.3" fill={F.seed} />
      ))}
    </g>
  );
}

function FoodCircle({ v, label }) {
  const pizza = v.theme === 'pizza';
  const slices = circleSlices(v.parts);
  const s = v.parts > 4 ? 12 : 16;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 200 200" style={{ width: 'min(100%, 220px)', height: 'auto', display: 'block' }}>
      <circle cx="100" cy="100" r="96" fill={pizza ? F.crust : F.frosting} stroke={F.outline} strokeWidth="3" />
      <circle cx="100" cy="100" r="82" fill={pizza ? F.cheese : F.cake} stroke={pizza ? F.sauce : F.cakeLine} strokeWidth="3" strokeDasharray={pizza ? undefined : '6 5'} />
      {slices.map(({ edge }, i) => (
        <line key={i} x1="100" y1="100" x2={edge[0]} y2={edge[1]} stroke={F.outline} strokeWidth="2.5" strokeLinecap="round" />
      ))}
      {slices.slice(0, v.shaded).map(({ topping: [x, y] }, i) => (pizza ? <Mushroom key={i} x={x} y={y} s={s} /> : <Strawberry key={i} x={x} y={y} s={s} />))}
    </svg>
  );
}

function ChocolateBar({ v, label }) {
  const { columns, rows } = chocolateGrid(v.parts);
  const c = 40;
  const pad = 6;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${columns * c + pad * 2} ${rows * c + pad * 2}`}
      style={{ width: `min(100%, ${columns * 64}px)`, height: 'auto', display: 'block' }}
    >
      {Array.from({ length: v.parts }, (_, i) => {
        const x = pad + (i % columns) * c + 3;
        const y = pad + Math.floor(i / columns) * c + 3;
        const w = c - 6;
        if (i < v.shaded) {
          return <rect key={i} x={x} y={y} width={w} height={w} rx="5" fill="none" stroke={F.eaten} strokeWidth="2" strokeDasharray="5 4" />;
        }
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={w} rx="5" fill={F.chocolate} stroke={F.outline} strokeWidth="2" />
            <rect x={x + 7} y={y + 7} width={w - 14} height={w - 14} rx="3" fill={F.chocolateLight} />
          </g>
        );
      })}
    </svg>
  );
}
