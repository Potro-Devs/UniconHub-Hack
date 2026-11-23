import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { STUDENT_ACHIEVEMENTS } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import {
  getEarnedAchievements,
  getQuizItems,
  pickFirstName,
} from './studentPortalStats';

/**
 * Pantalla de inicio del alumno: cuestionarios pendientes y logros.
 */
export function StudentHomeScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const { session } = useSession();
  const { axiColor, completedQuizzes, startStudentQuiz } = useAppUi();

  const firstName = pickFirstName(session?.student?.displayName, 'Sofía');
  const group = session?.group;
  const groupLabel =
    group?.grade && group?.section
      ? `${group.grade}.º ${group.section} · Primaria`
      : group?.name || '3.º A · Primaria';

  const quizItems = getQuizItems(completedQuizzes);
  const pendingQuizzes = quizItems.filter((q) => q.resolvedStatus === 'pending_screen');
  const heroQuiz = pendingQuizzes[0] ?? null;

  const earnedCount = getEarnedAchievements(completedQuizzes).length;

  const launchQuiz = (quizId) => {
    if (startStudentQuiz(quizId)) {
      navigate('/alumno/ejercicio');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            className="font-display"
            style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '26px' : '32px', lineHeight: 1.12 }}
          >
            ¡Hola, {firstName}!
          </h1>
          <div style={{ fontSize: '15px', color: COLORS.muted, marginTop: '4px' }}>
            {groupLabel} · Tus cuestionarios de hoy
          </div>
        </div>
      </div>

      {heroQuiz ? (
        <section
          aria-label="Cuestionario pendiente destacado"
          style={{
            background: '#fff',
            borderRadius: '24px',
            border: `2px solid ${COLORS.primary}`,
            padding: narrow ? '18px 16px' : '22px 24px',
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            alignItems: narrow ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: '18px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: COLORS.primarySoftBg,
                  color: COLORS.primarySoftFg,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Pendiente en pantalla
              </span>
              {heroQuiz.dueLabel && (
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.muted }}>
                  {heroQuiz.dueLabel}
                </span>
              )}
            </div>

            <h2
              className="font-display"
              style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '22px' : '26px', lineHeight: 1.2 }}
            >
              {heroQuiz.heroTitle || heroQuiz.title}
            </h2>

            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.45, color: COLORS.muted }}>
              {heroQuiz.classLabel} · {heroQuiz.teacher} · {heroQuiz.questionCount} preguntas con hasta 3 pistas por ejercicio.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                className="axi-btn-primary"
                onClick={() => launchQuiz(heroQuiz.id)}
                style={{
                  minHeight: '48px',
                  padding: '0 22px',
                  borderRadius: '14px',
                  border: 0,
                  background: COLORS.primary,
                  color: '#fff',
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: 700,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                {heroQuiz.ctaLabel || 'Empezar cuestionario'} →
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: COLORS.surfaceSubtle,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '18px',
              padding: '12px 14px',
              alignSelf: narrow ? 'stretch' : 'center',
            }}
          >
            <Mascot size={narrow ? 74 : 94} mood="feliz" color={axiColor} animate={!reducedMotion} />
            <div style={{ fontSize: '13px', lineHeight: 1.35, color: COLORS.muted, maxWidth: '170px' }}>
              <strong style={{ color: COLORS.ink, display: 'block', marginBottom: '2px' }}>
                {APP_NAME} te acompaña
              </strong>
              Resuelve a tu ritmo, sin cronómetro.
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-label="Pendientes completados"
          style={{
            background: '#fff',
            borderRadius: '24px',
            border: `2px solid ${COLORS.border}`,
            padding: narrow ? '18px 16px' : '22px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 260px' }}>
            <Mascot size={82} mood="celebra" color={axiColor} animate={!reducedMotion} />
            <div>
              <h2 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '22px', lineHeight: 1.2 }}>
                ¡Terminaste tus cuestionarios pendientes!
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '15px', color: COLORS.muted, lineHeight: 1.4 }}>
                Tus respuestas ya quedaron guardadas. Mira tus logros.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className="axi-btn-primary"
              onClick={() => navigate('/alumno/logros')}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '12px',
                border: 0,
                background: COLORS.primary,
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Ver mis logros
            </button>
          </div>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px' }}>
            Cuestionarios programados ({quizItems.length})
          </h2>
          <span style={{ fontSize: '13px', color: COLORS.muted }}>
            {pendingQuizzes.length} {pendingQuizzes.length === 1 ? 'pendiente' : 'pendientes'} por responder
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {quizItems.map((quiz) => {
            const isPending = quiz.resolvedStatus === 'pending_screen';
            const isPaper = quiz.resolvedStatus === 'completed_paper';
            const chipBg = isPending ? COLORS.primarySoftBg : quiz.level?.bg || COLORS.surfaceSubtle;
            const chipFg = isPending ? COLORS.primarySoftFg : quiz.level?.fg || COLORS.ink;
            const chipText = isPending
              ? 'Pendiente · En pantalla'
              : isPaper
                ? 'Respondido en papel · Bloqueado'
                : 'Completado · En pantalla';

            return (
              <article
                key={quiz.id}
                className="axi-card-hover"
                style={{
                  background: '#fff',
                  borderRadius: '20px',
                  border: `1px solid ${COLORS.border}`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: chipBg,
                      color: chipFg,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {chipText}
                  </span>
                  {isPending && quiz.dueLabel && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted }}>
                      {quiz.dueLabel}
                    </span>
                  )}
                </div>

                <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '19px', lineHeight: 1.25 }}>
                  {quiz.title}
                </h3>

                <div style={{ fontSize: '13px', color: COLORS.muted }}>
                  {quiz.classLabel} · {quiz.teacher}
                </div>

                {!isPending && quiz.scorePct != null && quiz.level && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '12px',
                      background: COLORS.surfaceSubtle,
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: quiz.level.bg,
                        color: quiz.level.fg,
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {quiz.scorePct}% · {quiz.level.label}
                    </span>
                    {quiz.completion?.withSupportCount > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.muted }}>
                        +{quiz.completion.withSupportCount} logrado con apoyo
                      </span>
                    )}
                  </div>
                )}

                {isPaper && quiz.note && (
                  <p style={{ margin: 0, fontSize: '13px', color: COLORS.muted, lineHeight: 1.4 }}>
                    {quiz.note}
                  </p>
                )}

                {isPending && (
                  <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                    <button
                      type="button"
                      className={quiz.ctaTone === 'primary' ? 'axi-btn-primary' : undefined}
                      onClick={() => launchQuiz(quiz.id)}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '12px',
                        border: 0,
                        background: quiz.ctaTone === 'primary' ? COLORS.primary : COLORS.ink,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      {quiz.ctaLabel || 'Resolver ahora'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
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
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mascot size={70} mood="celebra" color={axiColor} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primaryText, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Tus logros
            </div>
            <h2 className="font-display" style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '19px', lineHeight: 1.2 }}>
              {earnedCount} sellos de esfuerzo
            </h2>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.45, color: COLORS.muted }}>
          Los sellos no se pierden ({STUDENT_ACHIEVEMENTS.length} base del ciclo). Cada reto suma a tu camino con {APP_NAME}.
        </p>

        <button
          type="button"
          onClick={() => navigate('/alumno/logros')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: 0,
            background: COLORS.celebrationBg,
            color: COLORS.celebrationFg,
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Ver mis logros →
        </button>
      </section>
    </div>
  );
}
