import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { SKILLS, STUDENTS } from '@/shared/data/seedData';
import { mean, useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 01: Panel docente con siguiente paso sugerido y tarjetas de grupos.
 */
export function TeacherGroupsScreen() {
  const navigate = useNavigate();
  const { assigned, captured, scoreOf, needSupportStudents } = useAppUi();

  const needN = needSupportStudents.length;
  const next =
    !assigned && !captured
      ? {
          step: '1 de 3',
          title: 'Elige en qué van y asigna una prueba',
          body: 'Fracciones está “En curso” y aún no se evalúa. Te proponemos una prueba de 10 reactivos.',
          cta: 'Ir al temario',
          to: '/docente/temario',
        }
      : !captured
      ? {
          step: '2 de 3',
          title: 'Captura las hojas de Fracciones',
          body: 'Toca la opción que marcó cada alumno. Desde el celular toma unos 20 segundos por hoja.',
          cta: 'Capturar ahora',
          to: '/docente/captura',
        }
      : {
          step: '3 de 3',
          title: 'Ya está tu diagnóstico de Fracciones',
          body: `${needN} alumnos necesitan apoyo. Hay una actividad sugerida lista.`,
          cta: 'Ver mapa del grupo',
          to: '/docente/mapa',
        };

  const overall = STUDENTS.map((s) =>
    mean(SKILLS.map((k) => scoreOf(s, k.id)).filter((x) => x != null)),
  );
  const groupDist = LEVELS.map((level, idx) => ({
    n: overall.filter((v) => getLevelIndex(v) === idx).length,
    solid: level.solid,
    label: level.label,
  }));

  const lastApp = captured ? 'Última aplicación: 20 nov 2026' : 'Última aplicación: 25 sep 2026';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '14px', color: COLORS.muted }}>
          Domingo 22 de noviembre · Ciclo 2026–2027
        </div>
        <h1 className="font-display" style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '32px', lineHeight: 1.1 }}>
          Hola, Mtra. Elena
        </h1>
      </div>

      {/* Banner Siguiente paso */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          padding: '22px 24px',
          borderRadius: '24px',
          background: COLORS.primary,
          color: '#fff',
        }}
      >
        <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Siguiente paso · {next.step}
          </div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '24px', lineHeight: 1.2 }}>
            {next.title}
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.4, textWrap: 'pretty' }}>{next.body}</div>
        </div>
        <button
          type="button"
          onClick={() => navigate(next.to)}
          style={{
            border: 0,
            borderRadius: '14px',
            padding: '14px 20px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            background: '#fff',
            color: 'oklch(0.4 0.2 268)',
          }}
        >
          {next.cta}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '22px', lineHeight: 1.2 }}>
          Tus grupos
        </h2>
        <span style={{ fontSize: '14px', color: COLORS.muted }}>
          Saberes y pensamiento científico · matemáticas
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Grupo 3.º A */}
        <div
          role="button"
          tabIndex={0}
          className="axi-card-hover"
          onClick={() => navigate('/docente/mapa')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/docente/mapa')}
          style={{
            cursor: 'pointer',
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div className="font-display" style={{ fontWeight: 800, fontSize: '34px', lineHeight: 1 }}>
                3.º A
              </div>
              <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
                45 alumnos · {lastApp}
              </div>
            </div>
            <div
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                background: COLORS.primarySoftBg,
                color: COLORS.primarySoftFg,
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Tu grupo
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: COLORS.muted }}>Nivel general del grupo</div>
            <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
              {groupDist.map((g) => (
                <div key={g.label} style={{ flex: g.n, background: g.solid }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {groupDist.map((g) => (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: g.solid }} />
                  {g.label} <b>{g.n}</b>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 700, color: COLORS.primaryText }}>
            Abrir mapa del grupo →
          </div>
        </div>

        {/* Grupo 3.º B */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <div className="font-display" style={{ fontWeight: 800, fontSize: '34px', lineHeight: 1 }}>
              3.º B
            </div>
            <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
              38 alumnos · Sin diagnóstico todavía
            </div>
          </div>
          <div style={{ fontSize: '14px', color: COLORS.muted, lineHeight: 1.45, flex: 1 }}>
            Este grupo viene de 2.º con historial. Elige en qué van del temario para su primer diagnóstico.
          </div>
          <button
            type="button"
            onClick={() => navigate('/docente/temario')}
            style={{
              alignSelf: 'flex-start',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              background: COLORS.bg,
            }}
          >
            Ver temario
          </button>
        </div>

        {/* Crear grupo */}
        <button
          type="button"
          className="axi-dashed-hover"
          onClick={() => navigate('/docente/grupos/nuevo')}
          style={{
            minHeight: '180px',
            border: '2px dashed #C3CCDD',
            borderRadius: '22px',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: COLORS.muted,
          }}
        >
          <span className="font-display" style={{ fontWeight: 700, fontSize: '34px', lineHeight: 1 }}>
            +
          </span>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>Crear grupo</span>
          <span style={{ fontSize: '13px' }}>Grado, grupo y ciclo</span>
        </button>
      </div>
    </div>
  );
}
