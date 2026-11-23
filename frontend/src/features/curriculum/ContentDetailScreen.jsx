import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import {
  CURRICULUM_CONTENTS,
  DISTRACTOR_ERRORS,
  FRACTIONS_PDA,
  FRACTION_SHEET,
  SKILLS,
  STUDENTS,
} from '@/shared/data/seedData';
import { mean, useAppUi } from '@/shared/state/AppUiContext';

const STATUS_STYLE = {
  pend: { l: 'Pendiente', bg: '#E6EBF3', fg: COLORS.muted },
  curso: { l: 'En curso', bg: COLORS.primarySoftBg, fg: COLORS.primarySoftFg },
  visto: { l: 'Visto', bg: COLORS.ink, fg: '#fff' },
};

/**
 * Pantalla 13: Detalle de un contenido curricular, PDAs, reactivos y distractores.
 */
export function ContentDetailScreen() {
  const navigate = useNavigate();
  const { contentId } = useParams();
  const { statusOf, isEvaluated, contentScoreOf, setSelected } = useAppUi();
  const [openTest, setOpenTest] = useState(0);
  const [schoolNotes, setSchoolNotes] = useState('');

  const cdC = CURRICULUM_CONTENTS.find((c) => c.id === contentId) || CURRICULUM_CONTENTS[1];
  const cdEv = isEvaluated(cdC);
  const cdAvg = cdEv ? mean(STUDENTS.map((s) => contentScoreOf(s, cdC))) : null;
  const cdFr = cdC.sk.includes('fractions');
  const cdSt = STATUS_STYLE[statusOf(cdC)];

  const skillsText =
    cdC.sk.map((k) => SKILLS.find((x) => x.id === k)?.name).filter(Boolean).join(' · ') ||
    'Por definir con el equipo';

  const pdas = cdFr ? FRACTIONS_PDA : [cdC.pda];

  const cdItems = cdFr
    ? FRACTION_SHEET.map((q, j) => ({
        n: j + 1,
        q: q.q,
        opts: q.o.map((t, m) => ({
          L: 'ABCD'[m],
          t,
          note: m === q.k ? 'Correcta' : DISTRACTOR_ERRORS[j][m],
          bg: m === q.k ? LEVELS[2].bg : COLORS.bg,
          fg: m === q.k ? LEVELS[2].fg : COLORS.ink,
        })),
      }))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button
        type="button"
        onClick={() => navigate('/docente/temario')}
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
        ← Temario de 3.º
      </button>

      <div>
        <div style={{ fontSize: '14px', color: COLORS.muted }}>
          Saberes y pensamiento científico · 3.º · Fase 4
        </div>
        <h1
          className="font-display"
          style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '30px', lineHeight: 1.15, textWrap: 'pretty' }}
        >
          {cdC.t}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
          <span
            style={{
              padding: '5px 11px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 700,
              background: cdSt.bg,
              color: cdSt.fg,
            }}
          >
            {cdSt.l}
          </span>
          <span style={{ fontSize: '14px', color: COLORS.muted }}>Habilidades: {skillsText}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1.5 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              Lo que se espera que logren
            </h2>
            {pdas.map((pda, idx) => (
              <div key={pda} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    flex: 'none',
                    borderRadius: '50%',
                    background: COLORS.primarySoftBg,
                    color: COLORS.primarySoftFg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontSize: '15px', lineHeight: 1.45, paddingTop: '2px' }}>{pda}</span>
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
              gap: '12px',
            }}
          >
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              Pruebas disponibles
            </h2>
            {cdC.tests.length === 0 && (
              <div style={{ fontSize: '14px', color: COLORS.muted }}>
                Todavía no hay pruebas para este contenido.
              </div>
            )}
            {cdC.tests.map((testName, j) => {
              const open = openTest === j;
              const showItems = open && cdFr && j === 0;
              const noItems = open && !(cdFr && j === 0);

              return (
                <div
                  key={testName}
                  style={{ border: `1px solid ${COLORS.border}`, borderRadius: '16px', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      background: '#F8FAFD',
                    }}
                  >
                    <div style={{ flex: '1 1 200px', fontSize: '15px', fontWeight: 700 }}>{testName}</div>
                    <button
                      type="button"
                      onClick={() => setOpenTest((prev) => (prev === j ? -1 : j))}
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        background: '#fff',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {open ? 'Ocultar reactivos' : 'Ver reactivos'}
                    </button>
                  </div>

                  {showItems && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {cdItems.map((q) => (
                        <div
                          key={q.n}
                          style={{
                            padding: '12px 14px',
                            borderTop: '1px solid #EEF1F6',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ fontSize: '14px', lineHeight: 1.35 }}>
                            <b>{q.n}.</b> {q.q}
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: '6px',
                            }}
                          >
                            {q.opts.map((o) => (
                              <div
                                key={o.L}
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  alignItems: 'flex-start',
                                  padding: '7px 10px',
                                  borderRadius: '10px',
                                  background: o.bg,
                                  color: o.fg,
                                  fontSize: '13px',
                                  lineHeight: 1.35,
                                }}
                              >
                                <b style={{ flex: 'none' }}>
                                  {o.L}) {o.t}
                                </b>
                                <span>{o.note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {noItems && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderTop: '1px solid #EEF1F6',
                        fontSize: '13px',
                        color: COLORS.muted,
                      }}
                    >
                      En el MVP solo Fracciones · prueba 1 tiene reactivos de ejemplo.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '13px', color: COLORS.muted }}>Cobertura de este contenido</div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
              {cdEv ? '45 de 45' : '0 de 45'}
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: cdEv ? '100%' : '0%',
                  background: COLORS.primaryAccent,
                  borderRadius: '999px',
                }}
              />
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.4 }}>
              {cdEv
                ? `alumnos evaluados · promedio ${cdAvg}% · ${LEVELS[getLevelIndex(cdAvg)].label}`
                : 'alumnos evaluados. Asigna una prueba para empezar.'}
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 700 }}>Notas de mi escuela</div>
            <div style={{ fontSize: '13px', color: COLORS.muted }}>
              Para contextualizar el programa (programa analítico).
            </div>
            <textarea
              value={schoolNotes}
              onChange={(e) => setSchoolNotes(e.target.value)}
              placeholder="Ej. Usar el mercado de la colonia como ejemplo de medios y cuartos."
              style={{
                minHeight: '90px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.borderInput}`,
                padding: '10px 12px',
                fontSize: '14px',
                lineHeight: 1.45,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSelected({ [cdC.id]: true });
              navigate('/docente/temario');
            }}
            style={{
              height: '52px',
              borderRadius: '16px',
              border: 0,
              background: COLORS.primary,
              color: '#fff',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Asignar prueba de este contenido
          </button>
        </div>
      </div>
    </div>
  );
}
