import { COLORS, LEVELS } from '@/config/brand';
import { SCHOOL_TEACHERS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 14 (Roadmap): Vista de Escuela para Dirección con listado de docentes.
 */
export function SchoolOverviewScreen() {
  const { say } = useAppUi();

  const docentes = SCHOOL_TEACHERS.map(([n, g, st]) => ({
    n,
    g,
    st,
    ini: n
      .split(' ')
      .slice(1, 3)
      .map((w) => w[0])
      .join(''),
    bg: st.startsWith('Invit') ? LEVELS[1].bg : LEVELS[2].bg,
    fg: st.startsWith('Invit') ? LEVELS[1].fg : LEVELS[2].fg,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <span
        style={{
          alignSelf: 'flex-start',
          padding: '5px 11px',
          borderRadius: '999px',
          background: 'oklch(0.94 0.08 90)',
          color: 'oklch(0.4 0.09 75)',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '.04em',
        }}
      >
        ROADMAP · DATOS DE EJEMPLO
      </span>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
            Esc. Prim. Benito Juárez
          </h1>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
            Turno matutino · Ciclo 2026–2027 · 7 docentes · 8 grupos
          </div>
        </div>

        <button
          type="button"
          onClick={() => say('Se envió una invitación por correo al docente.')}
          style={{
            border: 0,
            background: COLORS.primary,
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Dar de alta docente
        </button>
      </div>

      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '22px',
          overflow: 'hidden',
        }}
      >
        {docentes.map((d) => (
          <div
            key={d.n}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
              padding: '14px 18px',
              borderBottom: '1px solid #EEF1F6',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                flex: 'none',
                borderRadius: '50%',
                background: COLORS.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {d.ini}
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>{d.n}</div>
              <div style={{ fontSize: '13px', color: COLORS.muted }}>{d.g}</div>
            </div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                background: d.bg,
                color: d.fg,
              }}
            >
              {d.st}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
