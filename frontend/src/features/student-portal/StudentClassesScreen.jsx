import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { STUDENT_CLASSES } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { getQuizItems } from './studentPortalStats';

/**
 * Pantalla "Mis clases" del alumno: grupos en los que la escuela lo inscribió.
 */
export function StudentClassesScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const { completedQuizzes } = useAppUi();

  const quizItems = getQuizItems(completedQuizzes);

  return (
    <div className="kid-page kid-collection" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1
          className="font-display"
          style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '26px' : '32px', lineHeight: 1.12 }}
        >
          Mis clases
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '15px', color: COLORS.muted, lineHeight: 1.45 }}>
          Estos son los grupos en los que tu escuela te inscribió. Si te falta una clase, avísale a tu maestra o maestro.
        </p>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px' }}>
          Tus clases inscritas ({STUDENT_CLASSES.length})
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {STUDENT_CLASSES.map((cls) => {
            const pendingInClass = quizItems.filter(
              (q) => q.classId === cls.id && q.resolvedStatus === 'pending_screen',
            ).length;
            const showQuizzesBtn = pendingInClass > 0 || cls.ctaType === 'quizzes';

            return (
              <article
                key={cls.id}
                className="axi-card-hover kid-collection-card"
                style={{
                  background: '#fff',
                  borderRadius: '20px',
                  border: `1px solid ${COLORS.border}`,
                  padding: '18px',
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
                      background: COLORS.primarySoftBg,
                      color: COLORS.primarySoftFg,
                      fontSize: '16px',
                      fontWeight: 700,
                    }}
                  >
                    {cls.gradeLabel}
                  </span>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: COLORS.surfaceSubtle,
                      border: `1px solid ${COLORS.border}`,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: COLORS.muted,
                    }}
                  >
                    Código {cls.code}
                  </span>
                </div>

                <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
                  {cls.name}
                </h3>

                <div style={{ fontSize: '16px', color: COLORS.muted, lineHeight: 1.4 }}>
                  {cls.teacherLine}
                </div>

                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: pendingInClass > 0 ? COLORS.primaryText : COLORS.muted,
                  }}
                >
                  {pendingInClass > 0
                    ? `${pendingInClass} ${pendingInClass === 1 ? 'cuestionario pendiente' : 'cuestionarios pendientes'}`
                    : 'Sin cuestionarios pendientes por ahora'}
                </div>

                {showQuizzesBtn && (
                  <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/alumno/inicio')}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '12px',
                        border: `1px solid ${COLORS.border}`,
                        background: COLORS.surfaceSubtle,
                        color: COLORS.primaryText,
                        fontWeight: 700,
                        fontSize: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      Ver cuestionarios →
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
