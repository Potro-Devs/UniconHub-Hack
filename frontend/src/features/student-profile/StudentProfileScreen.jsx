import { useNavigate, useParams } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { SKILLS, STUDENTS, SUGGESTED_ACTIVITIES } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 03: Perfil individual del alumno con dominio por habilidad, errores típicos e historial longitudinal.
 */
export function StudentProfileScreen() {
  const navigate = useNavigate();
  const { studentIdx } = useParams();
  const { captured, scoreOf } = useAppUi();

  const parsedIdx = Number.parseInt(studentIdx ?? '0', 10);
  const idx = Number.isNaN(parsedIdx) ? 0 : ((parsedIdx % STUDENTS.length) + STUDENTS.length) % STUDENTS.length;
  const ps = STUDENTS[idx];

  const pSkills = SKILLS.map((k) => {
    const v = scoreOf(ps, k.id);
    const pv = ps.prev[k.id];
    if (v == null) {
      return {
        name: k.name,
        pct: '—',
        w: '0%',
        solid: '#E6EBF3',
        label: 'Sin evaluar',
        bg: COLORS.bg,
        fg: COLORS.muted,
        delta: 'Captura pendiente de la prueba de fracciones',
      };
    }
    const lv = LEVELS[getLevelIndex(v)];
    const d = pv != null ? v - pv : null;
    return {
      name: k.name,
      pct: `${v}%`,
      w: `${v}%`,
      solid: lv.solid,
      label: lv.label,
      bg: lv.bg,
      fg: lv.fg,
      delta: d == null ? 'Nuevo en 3.º' : `${d >= 0 ? '+' : ''}${d} puntos desde 2.º (${pv}%)`,
    };
  });

  const pWeak = SKILLS.filter((k) => scoreOf(ps, k.id) != null).sort(
    (a, b) => scoreOf(ps, a.id) - scoreOf(ps, b.id),
  );

  const logros = SKILLS.filter((k) => ps.prev[k.id] != null && ps.sc[k.id] - ps.prev[k.id] >= 8)
    .slice(0, 2)
    .map((k, i) => ({
      t: `Subió en ${k.name} respecto a 2.º`,
      c: i ? 'oklch(0.68 0.14 165)' : 'oklch(0.82 0.15 85)',
    }))
    .concat([
      {
        t: 'Terminó 3 bloques de ejercicios en 3.º',
        c: 'oklch(0.8 0.11 355)',
      },
    ]);

  const history = [
    {
      t: '3.º A · Ciclo 2026–2027',
      d: `Mtra. Elena Torres · ${captured ? '2 aplicaciones (sep y nov 2026)' : '1 aplicación (sep 2026)'}`,
      dot: COLORS.primaryAccent,
    },
    {
      t: 'Promovido a 3.º',
      d: 'Julio 2026 · el diagnóstico pasó con él al nuevo grupo',
      dot: '#B9C2D4',
    },
    {
      t: '2.º B · Ciclo 2025–2026',
      d: 'Mtro. Raúl Méndez · 2 aplicaciones · valor posicional, suma y resta, medición',
      dot: 'oklch(0.68 0.14 165)',
    },
  ];

  const weakestSkill = pWeak[0];
  const act = SUGGESTED_ACTIVITIES[weakestSkill.id];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button
        type="button"
        onClick={() => navigate('/docente/mapa')}
        style={{
          alignSelf: 'flex-start',
          border: 0,
          background: 'none',
          padding: 0,
          fontSize: '14px',
          fontWeight: 700,
          color: COLORS.primaryText,
          cursor: 'pointer',
        }}
      >
        ← Mapa del grupo
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
        <div
          className="font-display"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'oklch(0.88 0.08 268)',
            color: 'oklch(0.35 0.18 268)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '24px',
            lineHeight: 1,
          }}
        >
          {ps.ini}
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
            {ps.name}
          </h1>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
            3.º A · Ciclo 2026–2027 · Historial desde 2.º B
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate(`/docente/perfil/${(idx + STUDENTS.length - 1) % STUDENTS.length}`)}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => navigate(`/docente/perfil/${(idx + 1) % STUDENTS.length}`)}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Siguiente →
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-start' }}>
        {/* Dominio por habilidad */}
        <div
          style={{
            flex: '1.4 1 380px',
            minWidth: 0,
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '10px',
              marginBottom: '6px',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              Dominio por habilidad
            </h2>
            <span style={{ fontSize: '13px', color: COLORS.muted }}>vs. fin de 2.º</span>
          </div>

          {pSkills.map((s) => (
            <div
              key={s.name}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(110px,1fr) minmax(80px,2fr) auto',
                alignItems: 'center',
                gap: '6px 14px',
                padding: '10px 0',
                borderTop: '1px solid #EEF1F6',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 700 }}>{s.name}</div>
              <div style={{ height: '12px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: s.w, background: s.solid, borderRadius: '999px' }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, minWidth: '38px', textAlign: 'right' }}>
                  {s.pct}
                </span>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: s.bg,
                    color: s.fg,
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </span>
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: '13px', color: COLORS.muted, marginTop: '-2px' }}>
                {s.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Columna derecha */}
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              background: 'oklch(0.96 0.05 92)',
              border: '1px solid oklch(0.88 0.09 90)',
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'oklch(0.42 0.09 75)',
              }}
            >
              Actividad sugerida · {weakestSkill.name}
            </div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              {act.t}
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.45 }}>{act.d}</div>
            <div style={{ fontSize: '13px', color: COLORS.muted }}>{act.meta}</div>
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>
              Errores típicos detectados
            </h2>
            {pWeak.slice(0, 2).map((k) => (
              <div
                key={k.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: COLORS.bg,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted }}>{k.name}</div>
                <div style={{ fontSize: '14px', lineHeight: 1.4 }}>{SUGGESTED_ACTIVITIES[k.id].err}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>
              Logros
            </h2>
            {logros.map((g) => (
              <div key={g.t} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    flex: 'none',
                    borderRadius: '8px',
                    transform: 'rotate(45deg) scale(.75)',
                    background: g.c,
                  }}
                />
                {g.t}
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h2
              className="font-display"
              style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}
            >
              Historial
            </h2>
            {history.map((h) => (
              <div key={h.t} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      marginTop: '4px',
                      background: h.dot,
                    }}
                  />
                  <span style={{ flex: 1, width: '2px', background: COLORS.border }} />
                </div>
                <div style={{ paddingBottom: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{h.t}</div>
                  <div style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.4 }}>{h.d}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: '12px', color: COLORS.muted, lineHeight: 1.4 }}>
              El historial se une por un folio interno. Solo la escuela ve el nombre; no se pide CURP.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
