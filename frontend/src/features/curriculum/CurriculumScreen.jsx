import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { CURRICULUM_CONTENTS, DEMO_JOIN_CODE, STUDENTS } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { mean, useAppUi } from '@/shared/state/AppUiContext';

const STATUS_STYLE = {
  pend: { l: 'Pendiente', bg: '#E6EBF3', fg: COLORS.muted },
  curso: { l: 'En curso', bg: COLORS.primarySoftBg, fg: COLORS.primarySoftFg },
  visto: { l: 'Visto', bg: COLORS.ink, fg: '#fff' },
};

const NEXT_STATUS = { pend: 'curso', curso: 'visto', visto: 'pend' };

/**
 * Pantalla 04: Temario SEP de 3.º grado y panel de asignación de pruebas.
 */
export function CurriculumScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const {
    statuses,
    setStatuses,
    selected,
    setSelected,
    dest,
    setDest,
    format,
    setFormat,
    setAssigned,
    statusOf,
    isEvaluated,
    covN,
    contentScoreOf,
    weakestSkill,
    needSupportStudents,
    say,
  } = useAppUi();

  const stCount = {
    visto: CURRICULUM_CONTENTS.filter((c) => statusOf(c) === 'visto').length,
    curso: CURRICULUM_CONTENTS.filter((c) => statusOf(c) === 'curso').length,
    pend: CURRICULUM_CONTENTS.filter((c) => statusOf(c) === 'pend').length,
  };

  const selCT = CURRICULUM_CONTENTS.filter((c) => selected[c.id]);
  const selTests = selCT.map((c) => c.tests[0] || `${c.t}: sin pruebas todavía`);

  const needN = needSupportStudents.length;
  const destTabs = [
    ['grupo', 'Todo el grupo (45)'],
    ['apoyo', `Quienes necesitan apoyo en ${weakestSkill.k.name} (${needN})`],
  ];

  const assignTest = () => {
    setAssigned(true);
    if (format === 'papel') {
      say('Prueba asignada. Imprime las hojas para tu grupo.');
      navigate('/docente/hoja');
    } else {
      say(`Prueba asignada. Tus alumnos la verán al entrar con el código ${DEMO_JOIN_CODE}.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
          Temario de 3.º
        </h1>
        <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
          Fase 4 · Saberes y pensamiento científico (matemáticas) · Programa sintético SEP · ejemplo por validar con docente
        </div>
      </div>

      {/* Cobertura */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px 24px',
          alignItems: 'center',
          padding: '16px 18px',
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '18px',
        }}
      >
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '14px' }}>
            <b>{covN} de 10</b> contenidos ya evaluados
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${covN * 10}%`,
                background: COLORS.primaryAccent,
                borderRadius: '999px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
          <span
            style={{
              padding: '5px 10px',
              borderRadius: '999px',
              background: COLORS.ink,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            Visto {stCount.visto}
          </span>
          <span
            style={{
              padding: '5px 10px',
              borderRadius: '999px',
              background: COLORS.primarySoftBg,
              color: COLORS.primarySoftFg,
              fontWeight: 700,
            }}
          >
            En curso {stCount.curso}
          </span>
          <span
            style={{
              padding: '5px 10px',
              borderRadius: '999px',
              background: '#E6EBF3',
              color: COLORS.muted,
              fontWeight: 700,
            }}
          >
            Pendiente {stCount.pend}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-start' }}>
        {/* Lista de contenidos */}
        <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CURRICULUM_CONTENTS.map((c) => {
            const st = statusOf(c);
            const isSel = !!selected[c.id];
            const ev = isEvaluated(c);
            const avg = ev ? mean(STUDENTS.map((s) => contentScoreOf(s, c))) : null;
            const lv = avg != null ? LEVELS[getLevelIndex(avg)] : null;
            const stMeta = STATUS_STYLE[st];

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  padding: '16px',
                  background: '#fff',
                  borderRadius: '18px',
                  border: `2px solid ${isSel ? COLORS.primaryAccent : 'transparent'}`,
                }}
              >
                <button
                  type="button"
                  aria-label={`Seleccionar ${c.t}`}
                  onClick={() => setSelected((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                  style={{
                    width: '26px',
                    height: '26px',
                    flex: 'none',
                    marginTop: '2px',
                    borderRadius: '8px',
                    border: `2px solid ${isSel ? COLORS.primary : '#B9C2D4'}`,
                    background: isSel ? COLORS.primary : '#fff',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {isSel ? '✓' : ''}
                </button>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    className="axi-name-hover"
                    onClick={() => navigate(`/docente/temario/${c.id}`)}
                    style={{
                      alignSelf: 'flex-start',
                      border: 0,
                      background: 'none',
                      padding: 0,
                      textAlign: 'left',
                      fontSize: '16px',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      cursor: 'pointer',
                      color: COLORS.ink,
                    }}
                  >
                    {c.t} <span style={{ color: COLORS.primaryText }}>→</span>
                  </button>

                  <div style={{ fontSize: '14px', color: COLORS.muted, lineHeight: 1.4, textWrap: 'pretty' }}>
                    <b style={{ color: COLORS.ink }}>Se espera:</b> {c.pda}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                    <button
                      type="button"
                      title="Cambiar estado"
                      onClick={() =>
                        setStatuses((prev) => ({ ...prev, [c.id]: NEXT_STATUS[statuses[c.id] || c.st] }))
                      }
                      style={{
                        border: 0,
                        borderRadius: '999px',
                        padding: '5px 11px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: stMeta.bg,
                        color: stMeta.fg,
                      }}
                    >
                      {stMeta.l} ▾
                    </button>

                    <span
                      style={{
                        padding: '5px 10px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: ev ? lv.bg : COLORS.bg,
                        color: ev ? lv.fg : COLORS.muted,
                      }}
                    >
                      {ev ? `Evaluado · ${avg}% · ${lv.label}` : 'Sin evaluar'}
                    </span>

                    <span style={{ fontSize: '13px', color: COLORS.muted }}>
                      {c.tests.length
                        ? `${c.tests.length} ${c.tests.length > 1 ? 'pruebas' : 'prueba'}`
                        : 'Sin pruebas todavía'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel Asignar prueba */}
        <div
          style={{
            flex: '1 1 300px',
            maxWidth: narrow ? 'none' : '360px',
            order: narrow ? -1 : 0,
            position: narrow ? 'static' : 'sticky',
            top: 0,
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
            Asignar prueba
          </h2>

          {selCT.length === 0 ? (
            <div style={{ fontSize: '14px', color: COLORS.muted, lineHeight: 1.45 }}>
              Marca uno o varios contenidos. Te propondremos pruebas ligadas a lo que se espera que logren.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', color: COLORS.muted }}>Pruebas propuestas</div>
                {selTests.map((t) => (
                  <div
                    key={t}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: COLORS.primarySoftBg,
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'oklch(0.35 0.18 268)',
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', color: COLORS.muted }}>¿A quién?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {destTabs.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDest(id)}
                      style={{
                        textAlign: 'left',
                        border: `2px solid ${dest === id ? COLORS.primaryAccent : COLORS.border}`,
                        background: dest === id ? 'oklch(0.97 0.02 268)' : '#fff',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', color: COLORS.muted }}>Formato</div>
                <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '12px', background: '#E6EBF3' }}>
                  {[
                    ['papel', 'En papel'],
                    ['pantalla', 'En pantalla'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormat(id)}
                      style={{
                        flex: 1,
                        border: 0,
                        borderRadius: '9px',
                        padding: '9px 10px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: format === id ? '#fff' : 'transparent',
                        color: format === id ? COLORS.ink : COLORS.muted,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="axi-btn-primary"
                onClick={assignTest}
                style={{
                  border: 0,
                  borderRadius: '14px',
                  padding: '14px 16px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: COLORS.primary,
                  color: '#fff',
                }}
              >
                {format === 'papel' ? 'Asignar e imprimir hojas' : 'Asignar en pantalla'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
