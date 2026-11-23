import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { SKILLS, STUDENTS } from '@/shared/data/seedData';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 11: Resumen final del alumno comparado consigo mismo.
 */
export function StudentSummaryScreen() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { axiColor, stuIdx, hintsUsed, resetStudentSession } = useAppUi();

  const stu = STUDENTS[stuIdx ?? 0];
  const effortMsg = hintsUsed
    ? `Pediste ${hintsUsed} ${hintsUsed > 1 ? 'pistas' : 'pista'} y seguiste intentando.`
    : 'Lo pensaste con calma, paso a paso.';

  const makeProgRow = (name, a, b, note) => {
    const f = LEVELS[getLevelIndex(a)];
    const t = LEVELS[getLevelIndex(b)];
    return {
      name,
      from: f.label,
      fromBg: f.bg,
      fromFg: f.fg,
      to: t.label,
      toBg: t.bg,
      toFg: t.fg,
      note,
    };
  };

  const stuProg = [
    makeProgRow('Fracciones', 58, 72, 'Subiste de nivel hoy.'),
    ...['sr', 'vp'].map((id) => {
      const skill = SKILLS.find((x) => x.id === id);
      const a = stu.prev[id];
      const b = stu.sc[id];
      const note =
        getLevelIndex(b) > getLevelIndex(a)
          ? 'Subiste desde 2.º.'
          : b > a
          ? `Mejoraste desde 2.º: +${b - a} puntos.`
          : 'Esta habilidad todavía se está formando. Probemos con una pista la próxima vez.';
      return makeProgRow(skill.name, a, b, note);
    }),
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
        textAlign: 'center',
        padding: '10px 0',
      }}
    >
      <Mascot size={150} color={axiColor} animate={!reducedMotion} />

      <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '34px', lineHeight: 1.1 }}>
        ¡Listo por hoy, {stu.first}!
      </h1>

      <div style={{ fontSize: '18px' }}>{effortMsg}</div>

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#fff',
          borderRadius: '26px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          textAlign: 'left',
        }}
      >
        <div className="font-display" style={{ fontWeight: 700, fontSize: '20px', lineHeight: 1.2, marginBottom: '6px' }}>
          Tu avance (comparado contigo)
        </div>

        {stuProg.map((p) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 0',
              borderTop: '1px solid #EEF1F6',
            }}
          >
            <div style={{ flex: '1 1 150px', fontSize: '17px', fontWeight: 700 }}>{p.name}</div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 700,
                background: p.fromBg,
                color: p.fromFg,
              }}
            >
              {p.from}
            </span>
            <span>→</span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 700,
                background: p.toBg,
                color: p.toFg,
              }}
            >
              {p.to}
            </span>
            <div style={{ flexBasis: '100%', fontSize: '14px', color: '#3A4565' }}>{p.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/alumno/sellos')}
          style={{
            height: '60px',
            padding: '0 28px',
            borderRadius: '20px',
            border: `3px solid ${COLORS.ink}`,
            background: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          Ver mis sellos
        </button>

        <button
          type="button"
          onClick={() => {
            resetStudentSession(0);
            navigate('/alumno/codigo');
          }}
          style={{
            height: '60px',
            padding: '0 32px',
            borderRadius: '20px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
          }}
        >
          Salir
        </button>
      </div>
    </div>
  );
}
