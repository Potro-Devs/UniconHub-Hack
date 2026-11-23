import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS, LEVELS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { getQuizItems, getStudentSkillSummaries } from './studentPortalStats';

/**
 * Pantalla "Mi progreso" del alumno: evolución ponderada en las 5 habilidades clave.
 */
export function StudentProgressScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const { stuIdx, completedQuizzes } = useAppUi();

  const skills = getStudentSkillSummaries(stuIdx, completedQuizzes);
  const quizItems = getQuizItems(completedQuizzes);
  const completedCount = quizItems.filter((q) => q.resolvedStatus !== 'pending_screen').length;
  const pendingCount = quizItems.length - completedCount;

  const strongest = [...skills].sort((a, b) => b.currentPct - a.currentPct)[0];
  const bestGrowth = [...skills].sort((a, b) => b.deltaPct - a.deltaPct)[0];
  const nextFocus = [...skills].sort((a, b) => a.currentPct - b.currentPct)[0];

  const completedScreenList = Object.values(completedQuizzes);
  const totalAutonomous = completedScreenList.reduce((s, q) => s + (q.autonomousCount ?? 0), 0);
  const totalWithSupport = completedScreenList.reduce((s, q) => s + (q.withSupportCount ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1
          className="font-display"
          style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '26px' : '32px', lineHeight: 1.12 }}
        >
          Mi progreso
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '15px', color: COLORS.muted, lineHeight: 1.45 }}>
          Tu dominio evolutivo toma en cuenta tu inicio de ciclo y da mayor peso a tus cuestionarios más recientes.
        </p>
      </div>

      <section
        aria-label="Resumen de avance"
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Habilidad más fuerte
          </div>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1.2 }}>
            {strongest.name}
          </div>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '999px',
                background: strongest.level.bg,
                color: strongest.level.fg,
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {strongest.currentPct}% · {strongest.level.label}
            </span>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Tu crecimiento este ciclo
          </div>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1.2 }}>
            {bestGrowth.name}{' '}
            <span style={{ color: COLORS.primaryText }}>
              {bestGrowth.deltaPct >= 0 ? `+${bestGrowth.deltaPct}%` : `${bestGrowth.deltaPct}%`}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: COLORS.muted }}>
            De {bestGrowth.initialPct}% al inicio a {bestGrowth.currentPct}% actualmente
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Cuestionarios completados
          </div>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '24px', lineHeight: 1.15 }}>
            {completedCount} de {quizItems.length}
          </div>
          <div style={{ fontSize: '14px', color: COLORS.muted }}>
            {pendingCount > 0
              ? `Tienes ${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'} en pantalla`
              : 'Todos los programados completados'}
          </div>
        </div>
      </section>

      <section
        aria-label="Evolución en tus 5 habilidades clave"
        style={{
          background: '#fff',
          borderRadius: '22px',
          border: `1px solid ${COLORS.border}`,
          padding: narrow ? '18px 16px' : '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px' }}>
            Tus 5 habilidades clave
          </h2>
          <span style={{ fontSize: '13px', color: COLORS.muted }}>
            Comparativa: inicio del ciclo vs. dominio actual
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {skills.map((skill) => (
            <article
              key={skill.id}
              style={{
                padding: '14px 16px',
                borderRadius: '16px',
                background: COLORS.surfaceSubtle,
                border: `1px solid ${COLORS.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>
                  {skill.name}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: skill.level.bg,
                      color: skill.level.fg,
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {skill.currentPct}% · {skill.level.label}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.muted }}>
                    {skill.deltaPct >= 0 ? `+${skill.deltaPct}% vs. inicio` : 'En consolidación'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: narrow ? '94px' : '120px', flexShrink: 0, fontSize: '12px', color: COLORS.muted, fontWeight: 600 }}>
                    Inicio ({skill.initialPct}%)
                  </span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${skill.initialPct}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: COLORS.mutedLight,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: narrow ? '94px' : '120px', flexShrink: 0, fontSize: '12px', color: COLORS.ink, fontWeight: 700 }}>
                    Actual ({skill.currentPct}%)
                  </span>
                  <div style={{ flex: 1, height: '12px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${skill.currentPct}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: skill.level.solid,
                      }}
                    />
                  </div>
                </div>
              </div>

              {skill.withSupportCount > 0 && (
                <div style={{ fontSize: '13px', color: COLORS.primarySoftFg, fontWeight: 700 }}>
                  Además lograste {skill.withSupportCount}{' '}
                  {skill.withSupportCount === 1 ? 'pregunta' : 'preguntas'} con apoyo de pistas (registradas aparte de tu dominio autónomo).
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
          gap: '14px',
        }}
      >
        <section
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mascot size={70} mood="pista" color="amarillo" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primaryText, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Mensaje de {APP_NAME}
              </div>
              <h2 className="font-display" style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '19px', lineHeight: 1.2 }}>
                Tu siguiente paso: {nextFocus.name}
              </h2>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted, lineHeight: 1.45 }}>
            Vas avanzando a tu propio ritmo. Dedicar un momento a <strong>{nextFocus.name}</strong> ({nextFocus.currentPct}% · {nextFocus.level.label}) te ayudará a sentirte más seguro paso a paso.
          </p>

          <button
            type="button"
            className="axi-btn-primary"
            onClick={() => navigate('/alumno/inicio')}
            style={{
              alignSelf: 'flex-start',
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: 0,
              background: COLORS.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Ir a mis pendientes →
          </button>
        </section>

        <section
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Autonomía reciente
          </div>
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '19px', lineHeight: 1.2 }}>
            {completedScreenList.length > 0
              ? `${totalAutonomous} aciertos autónomos y ${totalWithSupport} con apoyo`
              : 'Tus respuestas autónomas y con apoyo se muestran aparte'}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted, lineHeight: 1.45 }}>
            Cuando respondes sin usar pistas cuentas tu dominio autónomo. Si usas una pista para entender mejor, tu acierto se guarda como <strong>Logrado con apoyo</strong> para que tú y tu docente sepan qué tema reforzar.
          </p>
        </section>
      </div>

      <section
        aria-label="Escala de niveles"
        style={{
          background: '#fff',
          borderRadius: '20px',
          border: `1px solid ${COLORS.border}`,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div className="font-display" style={{ fontWeight: 700, fontSize: '17px' }}>
          ¿Qué significa cada nivel?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {LEVELS.map((lvl) => (
            <span
              key={lvl.code}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                background: lvl.bg,
                color: lvl.fg,
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {lvl.range} · {lvl.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
