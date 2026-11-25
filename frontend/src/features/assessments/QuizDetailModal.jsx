import { useEffect } from 'react';
import { APP_NAME, COLORS } from '@/config/brand';
import { FormMessage } from '@/shared/components/FormMessage';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle } from '@/shared/styles/ui';
import { ORIGIN_LABELS, QUESTION_TYPE_META, getLevelStyle } from './assessments.logic';

/**
 * Modal de vista previa de un cuestionario: muestra sus preguntas y respuestas.
 * Solo habilita edición si `quiz.canEdit === true` (propio del docente actual).
 * Siempre permite exportar a PDF Carta B/N sin respuestas.
 */
export function QuizDetailModal({
  quiz,
  loading,
  error,
  onClose,
  onEdit,
  onExportPdf,
  exportingPdf,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const stat = quiz?.groupSkillStat;
  const levelStyle = stat ? getLevelStyle(stat.level) : null;

  return (
    <div
      className="qb-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="qb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qb-modal-title"
      >
        <header className="qb-modal-header">
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {quiz ? (
              <>
                <div className="qb-quiz-meta">
                  <span className="qb-badge qb-badge-primary">
                    {ORIGIN_LABELS[quiz.origin] ?? 'Cuestionario'}
                  </span>
                  <span className="qb-badge qb-badge-neutral">
                    {quiz.skill?.name} · {quiz.grade}.º grado
                  </span>
                  {quiz.isRecommended && (
                    <span className="qb-badge qb-badge-warm">
                      Mejor opción para tu grupo
                    </span>
                  )}
                  {stat && levelStyle && (
                    <span
                      className="qb-badge"
                      style={{ background: levelStyle.bg, color: levelStyle.fg }}
                    >
                      {stat.average == null ? 'Sin evaluar' : `${stat.average}% · ${stat.label}`}
                    </span>
                  )}
                </div>
                <h2 id="qb-modal-title" className="font-display" style={{ margin: 0, fontSize: '24px', lineHeight: 1.2 }}>
                  {quiz.title}
                </h2>
                <div style={{ fontSize: '14px', color: COLORS.muted }}>
                  Autor: <strong>{quiz.authorName}</strong> · {quiz.questionCount}{' '}
                  {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'}
                </div>
              </>
            ) : (
              <h2 id="qb-modal-title" className="font-display" style={{ margin: 0, fontSize: '22px' }}>
                Detalle del cuestionario
              </h2>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del cuestionario"
            style={{
              ...buttonStyle('secondary'),
              minHeight: '44px',
              padding: '0 14px',
              flex: 'none',
            }}
          >
            Cerrar
          </button>
        </header>

        <div className="qb-modal-body">
          {loading && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: COLORS.muted }}>
              Cargando preguntas y respuestas…
            </div>
          )}

          {!loading && error && <FormMessage message={error} />}

          {!loading && !error && quiz && (
            <>
              {quiz.description && (
                <p style={{ margin: 0, fontSize: '15px', color: COLORS.muted, lineHeight: 1.5 }}>
                  {quiz.description}
                </p>
              )}

              {quiz.recommendationReason && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: COLORS.primarySoftBg,
                    color: COLORS.primarySoftFg,
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {quiz.recommendationReason}
                </div>
              )}

              {!quiz.canEdit && (
                <div
                  role="note"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: '#EEF2F9',
                    color: COLORS.muted,
                    fontSize: '14px',
                  }}
                >
                  Modo consulta: solo el docente autor puede editar este cuestionario. Puedes revisar sus preguntas o exportarlo a PDF sin respuestas para tu grupo.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(quiz.questions ?? []).map((q) => {
                  const typeMeta = QUESTION_TYPE_META[q.questionType] ?? { label: q.questionType };
                  return (
                    <article key={q.id ?? q.position} className="qb-detail-q">
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span className="qb-badge qb-badge-neutral">
                          Pregunta {q.position} · {typeMeta.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, lineHeight: 1.4 }}>
                        {q.prompt}
                      </div>

                      {q.questionType === 'fill_blank' ? (
                        <div className="qb-detail-opt is-correct">
                          <span>Respuesta esperada: {q.correctAnswer}</span>
                          <span>✓ Correcta</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(q.options ?? []).map((opt) => (
                            <div
                              key={`${q.position}-${opt.label}`}
                              className={`qb-detail-opt ${opt.isCorrect ? 'is-correct' : ''}`}
                            >
                              <span>
                                <strong>{opt.label})</strong> {opt.text}
                              </span>
                              {opt.isCorrect && <span>✓ Correcta</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {q.hint && (
                        <div style={{ fontSize: '13px', color: COLORS.muted, paddingTop: '2px' }}>
                          <strong>Pista de {APP_NAME}:</strong> {q.hint}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {quiz && !loading && !error && (
          <footer className="qb-modal-footer">
            <div style={{ fontSize: '13px', color: COLORS.muted }}>
              El PDF se genera en hoja Carta blanco y negro <strong>sin respuestas</strong>, listo para fotocopiar.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onExportPdf(quiz)}
                disabled={exportingPdf}
                style={buttonStyle('primary', { disabled: exportingPdf })}
              >
                <InterfaceIcon name="paper" size={18} />
                {exportingPdf ? 'Generando PDF…' : 'Exportar a PDF'}
              </button>
              {quiz.canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(quiz)}
                  style={buttonStyle('secondary')}
                >
                  <InterfaceIcon name="pencil" size={18} />
                  Editar preguntas y respuestas
                </button>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
