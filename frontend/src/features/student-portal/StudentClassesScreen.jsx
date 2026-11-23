import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { FormMessage } from '@/shared/components/FormMessage';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { normalizeJoinCodeInput } from '@/shared/state/session';
import { getQuizItems } from './studentPortalStats';

/**
 * Pantalla "Mis clases" del alumno: unión por código y grupos inscritos.
 */
export function StudentClassesScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const { enrolledClasses, completedQuizzes, joinStudentClass } = useAppUi();
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState(null);

  const quizItems = getQuizItems(completedQuizzes);

  const handleSubmit = (event) => {
    event.preventDefault();
    const res = joinStudentClass(codeInput);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setCodeInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1
          className="font-display"
          style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '26px' : '32px', lineHeight: 1.12 }}
        >
          Mis clases
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '15px', color: COLORS.muted, lineHeight: 1.45 }}>
          Revisa los grupos donde estás inscrito o agrega una nueva clase con el código que te dio tu docente.
        </p>
      </div>

      <section
        aria-label="Unirme con código de clase"
        style={{
          background: '#fff',
          borderRadius: '22px',
          border: `1.5px solid ${COLORS.border}`,
          padding: narrow ? '18px 16px' : '22px 24px',
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 260px' }}>
          <Mascot size={78} mood="feliz" color="azul" />
          <div>
            <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
              Unirme con código de clase
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: COLORS.muted, lineHeight: 1.45 }}>
              Escribe el código de 5 o 6 letras y números de tu materia (por ejemplo: <strong>4B9X2</strong>). {APP_NAME} guardará tu nueva clase aquí.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            flex: '1 1 280px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: '10px' }}>
            <label htmlFor="student-class-code" className="sr-only">
              Código de clase
            </label>
            <input
              id="student-class-code"
              type="text"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(normalizeJoinCodeInput(e.target.value));
                if (error) setError(null);
              }}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ej. 4B9X2"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'class-join-error' : undefined}
              style={{
                flex: 1,
                minHeight: '48px',
                padding: '0 14px',
                borderRadius: '14px',
                border: `2px solid ${error ? 'oklch(0.6 0.16 25)' : COLORS.borderInput}`,
                background: COLORS.surfaceSubtle,
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: '20px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: COLORS.ink,
              }}
            />
            <button
              type="submit"
              className="axi-btn-primary"
              style={{
                minHeight: '48px',
                padding: '0 18px',
                borderRadius: '14px',
                border: 0,
                background: COLORS.primary,
                color: '#fff',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Unirme a la clase
            </button>
          </div>
          <FormMessage id="class-join-error" message={error} />
        </form>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px' }}>
          Tus clases inscritas ({enrolledClasses.length})
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {enrolledClasses.map((cls) => {
            const pendingInClass = quizItems.filter(
              (q) => q.classId === cls.id && q.resolvedStatus === 'pending_screen',
            ).length;
            const showQuizzesBtn = pendingInClass > 0 || cls.ctaType === 'quizzes';

            return (
              <article
                key={cls.id}
                className="axi-card-hover"
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
                      fontSize: '12px',
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
                      fontSize: '12px',
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

                <div style={{ fontSize: '14px', color: COLORS.muted, lineHeight: 1.4 }}>
                  {cls.teacherLine}
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: pendingInClass > 0 ? COLORS.primaryText : COLORS.muted,
                  }}
                >
                  {pendingInClass > 0
                    ? `${pendingInClass} ${pendingInClass === 1 ? 'cuestionario pendiente' : 'cuestionarios pendientes'}`
                    : 'Sin cuestionarios pendientes por ahora'}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => navigate(showQuizzesBtn ? '/alumno/inicio' : '/alumno/progreso')}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '12px',
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surfaceSubtle,
                      color: COLORS.primaryText,
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    {showQuizzesBtn ? 'Ver cuestionarios →' : 'Ver mi avance →'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
