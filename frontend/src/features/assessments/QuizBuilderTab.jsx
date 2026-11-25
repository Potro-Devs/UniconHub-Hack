import { useMemo, useState } from 'react';
import { APP_NAME, COLORS } from '@/config/brand';
import { FormMessage } from '@/shared/components/FormMessage';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle } from '@/shared/styles/ui';
import {
  GRADE_OPTIONS,
  MIN_QUESTIONS_PER_QUIZ,
  QUESTION_TYPE_META,
  SKILL_OPTIONS,
  createEmptyQuestion,
  summarizeOwnQuizzes,
  switchQuestionType,
  validateQuizDraft,
} from './assessments.logic';

const QUESTION_TYPES_LIST = [
  QUESTION_TYPE_META.multiple_choice,
  QUESTION_TYPE_META.true_false,
  QUESTION_TYPE_META.fill_blank,
];

/**
 * Pestaña 2: "Constructor de cuestionarios".
 * Editor interactivo estilo Kahoot! (agregar pregunta, elegir tipo, definir respuestas y marcar correcta),
 * guardado en backend con vista inmediata del cuestionario creado y desglose de cuestionarios propios.
 */
export function QuizBuilderTab({
  draft,
  setDraft,
  activeIndex,
  setActiveIndex,
  editingQuizId,
  ownQuizzes,
  onCancelEdit,
  onSaveQuiz,
  saving,
  saveError,
  lastSavedQuiz,
  onViewQuiz,
  onEditOwnQuiz,
  onExportPdf,
  exportingId,
}) {
  const [localError, setLocalError] = useState('');

  const safeIndex = Math.min(activeIndex, Math.max(0, draft.questions.length - 1));
  const activeQuestion = draft.questions[safeIndex] ?? draft.questions[0];

  const ownSummary = useMemo(() => summarizeOwnQuizzes(ownQuizzes), [ownQuizzes]);

  const typeCounts = useMemo(() => {
    const counts = { multiple_choice: 0, true_false: 0, fill_blank: 0 };
    for (const q of draft.questions) {
      counts[q.questionType] = (counts[q.questionType] ?? 0) + 1;
    }
    return counts;
  }, [draft.questions]);

  const updateQuestionAt = (idx, updater) => {
    setLocalError('');
    setDraft((prev) => {
      const next = [...prev.questions];
      next[idx] = typeof updater === 'function' ? updater(next[idx]) : { ...next[idx], ...updater };
      return { ...prev, questions: next };
    });
  };

  const addQuestion = () => {
    setLocalError('');
    const nextIdx = draft.questions.length;
    setDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion('multiple_choice')],
    }));
    setActiveIndex(nextIdx);
  };

  const duplicateActiveQuestion = () => {
    setLocalError('');
    const clone = {
      ...activeQuestion,
      uid: `q-dup-${Date.now()}`,
      options: (activeQuestion.options ?? []).map((o) => ({ ...o })),
    };
    const insertAt = safeIndex + 1;
    setDraft((prev) => {
      const next = [...prev.questions];
      next.splice(insertAt, 0, clone);
      return { ...prev, questions: next };
    });
    setActiveIndex(insertAt);
  };

  const removeActiveQuestion = () => {
    if (draft.questions.length <= 1) return;
    setLocalError('');
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== safeIndex),
    }));
    setActiveIndex(Math.max(0, safeIndex - 1));
  };

  const handleMarkMcCorrect = (optIdx) => {
    updateQuestionAt(safeIndex, (q) => {
      const nextOptions = q.options.map((opt, idx) => ({
        ...opt,
        isCorrect: idx === optIdx,
      }));
      return {
        ...q,
        options: nextOptions,
        correctAnswer: nextOptions[optIdx]?.text ?? '',
      };
    });
  };

  const handleMcOptionText = (optIdx, text) => {
    updateQuestionAt(safeIndex, (q) => {
      const nextOptions = q.options.map((opt, idx) => (idx === optIdx ? { ...opt, text } : opt));
      const correct = nextOptions.find((o) => o.isCorrect);
      return {
        ...q,
        options: nextOptions,
        correctAnswer: correct?.text ?? '',
      };
    });
  };

  const handleMarkTrueFalse = (answerText) => {
    updateQuestionAt(safeIndex, (q) => ({
      ...q,
      options: [
        { label: 'A', text: 'Verdadero', isCorrect: answerText === 'Verdadero' },
        { label: 'B', text: 'Falso', isCorrect: answerText === 'Falso' },
      ],
      correctAnswer: answerText,
    }));
  };

  const handleSaveSubmit = (event) => {
    event.preventDefault();
    const check = validateQuizDraft(draft);
    if (!check.valid) {
      setLocalError(check.error);
      if (check.focusIndex != null) setActiveIndex(check.focusIndex);
      return;
    }
    setLocalError('');
    onSaveQuiz(check.payload);
  };

  const selectedSkillName = SKILL_OPTIONS.find((s) => s.code === draft.skillCode)?.name ?? 'Fracciones';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {editingQuizId && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '16px',
            background: COLORS.primarySoftBg,
            border: `1.5px solid ${COLORS.primary}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.primarySoftFg }}>
            Editando tu cuestionario: «{draft.title || 'Sin título'}»
          </span>
          <button type="button" onClick={onCancelEdit} style={buttonStyle('secondary')}>
            Cancelar y crear uno nuevo
          </button>
        </div>
      )}

      {lastSavedQuiz && (
        <div className="qb-success-box" role="status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong>¡Cuestionario guardado con éxito!</strong>
            <span style={{ fontSize: '14px' }}>
              «{lastSavedQuiz.title}» ({lastSavedQuiz.questionCount}{' '}
              {lastSavedQuiz.questionCount === 1 ? 'pregunta' : 'preguntas'}) ya está listo en tu biblioteca.
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onViewQuiz(lastSavedQuiz.id)}
              style={buttonStyle('primary')}
            >
              Ver cuestionario creado
            </button>
            <button
              type="button"
              disabled={exportingId === lastSavedQuiz.id}
              onClick={() => onExportPdf(lastSavedQuiz)}
              style={buttonStyle('secondary', { disabled: exportingId === lastSavedQuiz.id })}
            >
              <InterfaceIcon name="paper" size={18} />
              {exportingId === lastSavedQuiz.id ? 'Generando PDF…' : 'Exportar a PDF'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveSubmit} className="qb-builder-grid">
        {/* Columna izquierda: Configuración general + Constructor Kahoot! */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Datos generales del cuestionario */}
          <section className="qb-panel" aria-labelledby="qb-meta-title">
            <h2 id="qb-meta-title" className="font-display" style={{ margin: 0, fontSize: '20px' }}>
              1. Datos del cuestionario
            </h2>

            <div className="qb-field">
              <label htmlFor="qb-title-input" className="qb-label">
                Título del cuestionario
              </label>
              <input
                id="qb-title-input"
                type="text"
                maxLength={120}
                placeholder="Ej. Repaso de fracciones equivalentes"
                value={draft.title}
                onChange={(e) => {
                  setLocalError('');
                  setDraft((prev) => ({ ...prev, title: e.target.value }));
                }}
                className="qb-input"
              />
            </div>

            <div className="qb-form-row">
              <div className="qb-field">
                <label htmlFor="qb-skill-select" className="qb-label">
                  Habilidad clave
                </label>
                <select
                  id="qb-skill-select"
                  value={draft.skillCode}
                  onChange={(e) => setDraft((prev) => ({ ...prev, skillCode: e.target.value }))}
                  className="qb-select"
                >
                  {SKILL_OPTIONS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="qb-field">
                <label htmlFor="qb-grade-select" className="qb-label">
                  Grado
                </label>
                <select
                  id="qb-grade-select"
                  value={draft.grade}
                  onChange={(e) => setDraft((prev) => ({ ...prev, grade: Number(e.target.value) }))}
                  className="qb-select"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}.º grado
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="qb-field">
              <label htmlFor="qb-desc-input" className="qb-label">
                Propósito o descripción breve (opcional)
              </label>
              <input
                id="qb-desc-input"
                type="text"
                maxLength={300}
                placeholder="Ej. Identifica si el alumno compara fracciones con el mismo entero."
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                className="qb-input"
              />
            </div>
          </section>

          {/* Tira de preguntas estilo Kahoot! */}
          <section className="qb-panel" aria-label="Preguntas del cuestionario">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span className="qb-label">
                2. Preguntas del cuestionario ({draft.questions.length})
              </span>
              <button
                type="button"
                onClick={addQuestion}
                style={{
                  ...buttonStyle('secondary'),
                  minHeight: '44px',
                  background: COLORS.primarySoftBg,
                  color: COLORS.primarySoftFg,
                  borderColor: COLORS.primary,
                }}
              >
                + Agregar pregunta
              </button>
            </div>

            <div className="qb-q-strip">
              {draft.questions.map((q, idx) => {
                const isActive = idx === safeIndex;
                const shortType = QUESTION_TYPE_META[q.questionType]?.short ?? 'Pregunta';
                return (
                  <button
                    key={q.uid}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`qb-q-pill ${isActive ? 'is-active' : ''}`}
                  >
                    <span>{idx + 1} · {shortType}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Editor de la pregunta activa */}
          <section className="qb-panel" aria-labelledby="qb-active-q-title">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <h2 id="qb-active-q-title" className="font-display" style={{ margin: 0, fontSize: '22px' }}>
                Pregunta {safeIndex + 1} de {draft.questions.length}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={duplicateActiveQuestion}
                  style={{ ...buttonStyle('secondary'), minHeight: '44px', padding: '0 12px', fontSize: '14px' }}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  disabled={draft.questions.length <= 1}
                  onClick={removeActiveQuestion}
                  style={{
                    ...buttonStyle('secondary', { disabled: draft.questions.length <= 1 }),
                    minHeight: '44px',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                >
                  Quitar
                </button>
              </div>
            </div>

            {/* Selector de tipo de pregunta */}
            <div className="qb-field">
              <span className="qb-label">Tipo de pregunta</span>
              <div className="qb-qtype-grid" role="group" aria-label="Tipo de pregunta">
                {QUESTION_TYPES_LIST.map((t) => {
                  const active = activeQuestion.questionType === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateQuestionAt(safeIndex, (q) => switchQuestionType(q, t.code))}
                      className={`qb-qtype-btn ${active ? 'is-active' : ''}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enunciado */}
            <div className="qb-field">
              <label htmlFor="qb-prompt-input" className="qb-label">
                Escribe la pregunta para el alumno
              </label>
              <textarea
                id="qb-prompt-input"
                rows={3}
                maxLength={400}
                placeholder={
                  activeQuestion.questionType === 'fill_blank'
                    ? 'Usa ___ para marcar el espacio en blanco. Ej. Un entero tiene ___ cuartos.'
                    : 'Escribe aquí la pregunta clara y directa para tus alumnos…'
                }
                value={activeQuestion.prompt}
                onChange={(e) => updateQuestionAt(safeIndex, { prompt: e.target.value })}
                className="qb-textarea"
              />
            </div>

            {/* Respuestas por tipo */}
            {activeQuestion.questionType === 'multiple_choice' && (
              <div className="qb-field">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '6px' }}>
                  <span className="qb-label">Posibles respuestas (marca la correcta)</span>
                  <span style={{ fontSize: '13px', color: COLORS.muted }}>Mínimo 2 opciones · 1 correcta</span>
                </div>

                <div className="qb-mc-grid">
                  {activeQuestion.options.map((opt, optIdx) => (
                    <div
                      key={opt.label}
                      className={`qb-opt-card ${opt.isCorrect ? 'is-correct' : ''}`}
                    >
                      <div className="qb-opt-header">
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Opción {opt.label}</span>
                        <button
                          type="button"
                          onClick={() => handleMarkMcCorrect(optIdx)}
                          className="qb-opt-mark-btn"
                        >
                          {opt.isCorrect ? '✓ Correcta' : 'Marcar correcta'}
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={160}
                        aria-label={`Texto de Opción ${opt.label}`}
                        placeholder={`Escribe la opción ${opt.label}`}
                        value={opt.text}
                        onChange={(e) => handleMcOptionText(optIdx, e.target.value)}
                        className="qb-input"
                        style={{ background: '#fff' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeQuestion.questionType === 'true_false' && (
              <div className="qb-field">
                <span className="qb-label">Selecciona la respuesta correcta</span>
                <div className="qb-tf-grid">
                  {['Verdadero', 'Falso'].map((choice) => {
                    const isCorrect = activeQuestion.correctAnswer === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={isCorrect}
                        onClick={() => handleMarkTrueFalse(choice)}
                        className={`qb-tf-btn ${isCorrect ? 'is-correct' : ''}`}
                      >
                        {isCorrect ? `✓ ${choice} (Correcta)` : choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeQuestion.questionType === 'fill_blank' && (
              <div className="qb-field">
                <label htmlFor="qb-fill-answer" className="qb-label">
                  Respuesta exacta para completar la frase (___)
                </label>
                <input
                  id="qb-fill-answer"
                  type="text"
                  maxLength={120}
                  placeholder="Ej. 3/4 o 28"
                  value={activeQuestion.correctAnswer}
                  onChange={(e) => updateQuestionAt(safeIndex, { correctAnswer: e.target.value })}
                  className="qb-input"
                  style={{ borderWidth: '2px', borderColor: '#1A8762', background: '#fff' }}
                />
                <span style={{ fontSize: '13px', color: COLORS.muted }}>
                  En el PDF y en pantalla el alumno verá la línea en blanco para escribir esta respuesta.
                </span>
              </div>
            )}

            {/* Pista opcional */}
            <div className="qb-field">
              <label htmlFor="qb-hint-input" className="qb-label">
                Pista de {APP_NAME} (opcional, sin revelar la respuesta)
              </label>
              <input
                id="qb-hint-input"
                type="text"
                maxLength={240}
                placeholder="Ej. Recuerda contar primero el total de partes iguales."
                value={activeQuestion.hint}
                onChange={(e) => updateQuestionAt(safeIndex, { hint: e.target.value })}
                className="qb-input"
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px', borderTop: `1px solid ${COLORS.border}` }}>
              <button
                type="button"
                onClick={addQuestion}
                style={buttonStyle('secondary')}
              >
                + Agregar otra pregunta
              </button>
            </div>
          </section>
        </div>

        {/* Columna derecha: Resumen para guardar + Desglose de cuestionarios realizados */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <section className="qb-panel" aria-labelledby="qb-save-summary-title">
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primaryText, textTransform: 'uppercase' }}>
                Resumen del cuestionario
              </span>
              <h2 id="qb-save-summary-title" className="font-display" style={{ margin: '4px 0 0', fontSize: '22px' }}>
                {draft.title.trim() || 'Nuevo cuestionario'}
              </h2>
              <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '2px' }}>
                {selectedSkillName} · {draft.grade}.º grado
              </div>
            </div>

            <div className="qb-summary-metrics">
              <div className="qb-metric-cell">
                <span className="qb-metric-num">{draft.questions.length}</span>
                <span className="qb-metric-lbl">Preguntas</span>
              </div>
              <div className="qb-metric-cell">
                <span className="qb-metric-num">{typeCounts.multiple_choice}</span>
                <span className="qb-metric-lbl">Op. múltiple</span>
              </div>
              <div className="qb-metric-cell">
                <span className="qb-metric-num">{typeCounts.true_false + typeCounts.fill_blank}</span>
                <span className="qb-metric-lbl">V/F y Completar</span>
              </div>
            </div>

            <FormMessage message={localError || saveError} />

            <button
              type="submit"
              disabled={saving}
              style={buttonStyle('primary', { fullWidth: true, tall: true, disabled: saving })}
            >
              {saving
                ? 'Guardando cambios…'
                : editingQuizId
                  ? 'Guardar cambios del cuestionario'
                  : 'Guardar cuestionario'}
            </button>

            <div style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.4 }}>
              Incluye al menos {MIN_QUESTIONS_PER_QUIZ} preguntas. Al guardar podrás visualizar tu cuestionario completo, editar sus reactivos en cualquier momento y exportarlo a PDF sin respuestas.
            </div>
          </section>

          {/* Desglose de cuestionarios realizados por el docente */}
          <section className="qb-panel" aria-labelledby="qb-own-breakdown-title">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 id="qb-own-breakdown-title" className="font-display" style={{ margin: 0, fontSize: '20px' }}>
                Desglose de tus cuestionarios realizados
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: COLORS.muted }}>
                Has creado <strong>{ownSummary.totalQuizzes}</strong>{' '}
                {ownSummary.totalQuizzes === 1 ? 'cuestionario' : 'cuestionarios'} con{' '}
                <strong>{ownSummary.totalQuestions}</strong>{' '}
                {ownSummary.totalQuestions === 1 ? 'pregunta' : 'preguntas'} en total.
              </p>
            </div>

            {ownSummary.bySkill.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ownSummary.bySkill.map((item) => (
                  <span key={item.code} className="qb-badge qb-badge-primary">
                    {item.name}: {item.count} ({item.questions} preg.)
                  </span>
                ))}
              </div>
            )}

            {ownSummary.ownQuizzes.length === 0 ? (
              <div style={{ fontSize: '14px', color: COLORS.muted }}>
                Aún no has creado cuestionarios propios. Guarda el que estás construyendo para verlo aquí.
              </div>
            ) : (
              <div className="qb-own-list">
                {ownSummary.ownQuizzes.map((quiz) => (
                  <article key={quiz.id} className="qb-own-item">
                    <div style={{ fontWeight: 700, fontSize: '15px', color: COLORS.ink }}>
                      {quiz.title}
                    </div>
                    <div style={{ fontSize: '13px', color: COLORS.muted }}>
                      {quiz.skill?.name} · {quiz.grade}.º grado · {quiz.questionCount}{' '}
                      {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'}
                    </div>
                    <div className="qb-own-actions">
                      <button
                        type="button"
                        onClick={() => onViewQuiz(quiz.id)}
                        style={{ ...buttonStyle('secondary'), minHeight: '44px', padding: '0 12px', fontSize: '14px' }}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditOwnQuiz(quiz.id)}
                        style={{ ...buttonStyle('secondary'), minHeight: '44px', padding: '0 12px', fontSize: '14px' }}
                      >
                        <InterfaceIcon name="pencil" size={16} />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={exportingId === quiz.id}
                        onClick={() => onExportPdf(quiz)}
                        style={{ ...buttonStyle('secondary', { disabled: exportingId === quiz.id }), minHeight: '44px', padding: '0 12px', fontSize: '14px' }}
                      >
                        <InterfaceIcon name="paper" size={16} />
                        {exportingId === quiz.id ? 'PDF…' : 'PDF'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </form>
    </div>
  );
}
