import { useMemo, useState } from 'react';
import { COLORS } from '@/config/brand';
import { schoolYearToDisplay } from '@/features/groups/groups.logic';
import { Mascot } from '@/features/mascot';
import { FormMessage } from '@/shared/components/FormMessage';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle } from '@/shared/styles/ui';
import {
  ORIGIN_FILTERS,
  ORIGIN_LABELS,
  QUESTION_TYPE_META,
  SKILL_OPTIONS,
  getLevelStyle,
} from './assessments.logic';

function summarizeTypes(counts = {}) {
  const parts = [];
  if (counts.multiple_choice) parts.push(`${counts.multiple_choice} ${QUESTION_TYPE_META.multiple_choice.short}`);
  if (counts.true_false) parts.push(`${counts.true_false} ${QUESTION_TYPE_META.true_false.short}`);
  if (counts.fill_blank) parts.push(`${counts.fill_blank} ${QUESTION_TYPE_META.fill_blank.short}`);
  return parts.join(' · ') || 'Sin reactivos';
}

function buildPrioritySummary(groupContext, recommendedCount) {
  if (!groupContext) {
    return 'Selecciona un grupo para recibir recomendaciones dinámicas según el desempeño actual de tus alumnos.';
  }
  const stats = Object.values(groupContext.skillStats ?? {});
  const unassessed = stats.filter((s) => s.average == null);
  const priority = stats
    .filter((s) => s.average != null)
    .sort((a, b) => a.average - b.average)[0];

  const highlights = [];
  if (unassessed.length > 0) {
    highlights.push(`sin evidencia en ${unassessed.map((s) => s.name).join(', ')}`);
  }
  if (priority) {
    highlights.push(`${priority.name} en ${priority.average}% (${priority.label})`);
  }

  const detail = highlights.length ? `El grupo ${groupContext.groupName} presenta ${highlights.join(' y ')}.` : '';
  return `${detail} ${recommendedCount > 0 ? `Axi destacó ${recommendedCount} cuestionarios ideales para reforzar estas áreas.` : 'Explora los cuestionarios disponibles para reutilizar en clase.'}`.trim();
}

/**
 * Pestaña 1: "Cuestionarios y pruebas".
 * Permite explorar cuestionarios propios, de otros docentes y precargados por el sistema,
 * ordenados dinámicamente según el desempeño del grupo activo, ver sus reactivos y exportar PDF.
 */
export function QuizzesCatalogTab({
  quizzes,
  counts,
  groupContext,
  activeOrigin,
  onOriginChange,
  groups,
  activeGroupId,
  onGroupChange,
  loading,
  error,
  onRetry,
  onSelectQuiz,
  onEditQuiz,
  onExportPdf,
  exportingId,
  onGoToBuilder,
}) {
  const [skillFilter, setSkillFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredQuizzes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quizzes.filter((q) => {
      if (activeOrigin === 'recommended' && !q.isRecommended) return false;
      if (activeOrigin === 'own' && q.origin !== 'own') return false;
      if (activeOrigin === 'other_teachers' && q.origin !== 'other_teacher') return false;
      if (activeOrigin === 'preloaded' && q.origin !== 'preloaded') return false;
      if (skillFilter !== 'all' && q.skill?.code !== skillFilter) return false;
      if (!term) return true;
      return (
        q.title.toLowerCase().includes(term) ||
        (q.description ?? '').toLowerCase().includes(term) ||
        (q.authorName ?? '').toLowerCase().includes(term) ||
        (q.skill?.name ?? '').toLowerCase().includes(term)
      );
    });
  }, [quizzes, activeOrigin, skillFilter, search]);

  const recommendedCount = counts?.recommended ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Panel de desempeño y recomendación dinámica */}
      <section className="qb-panel" aria-labelledby="qb-rec-heading">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 id="qb-rec-heading" className="font-display" style={{ margin: 0, fontSize: '22px', lineHeight: 1.2 }}>
              Recomendaciones según desempeño del grupo
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted }}>
              Elige el grupo para detectar dinámicamente qué cuestionarios responden mejor a sus necesidades actuales.
            </p>
          </div>

          {groups.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} aria-label="Seleccionar grupo">
              {groups.map((g) => {
                const selected = String(g.id) === String(activeGroupId);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onGroupChange(g.id)}
                    className={`qb-pill-btn ${selected ? 'is-active' : ''}`}
                    style={
                      selected
                        ? { background: COLORS.primary, borderColor: COLORS.primary, color: '#fff' }
                        : undefined
                    }
                  >
                    {g.name} · {schoolYearToDisplay(g.schoolYear)} ({g.studentCount})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="qb-rec-banner">
          <Mascot size={52} mood="pista" />
          <div className="qb-rec-banner-body">
            <strong>
              {groupContext ? `Sugerencia dinámica para ${groupContext.groupName}` : 'Recomendación dinámica'}
            </strong>
            <p>{buildPrioritySummary(groupContext, recommendedCount)}</p>
          </div>
        </div>
      </section>

      {/* Filtros de autoría, habilidad y búsqueda */}
      <section className="qb-panel" aria-label="Filtros de cuestionarios">
        <div className="qb-filters-bar">
          <div className="qb-filter-pills" role="group" aria-label="Filtrar por origen del cuestionario">
            {ORIGIN_FILTERS.map((f) => {
              const active = activeOrigin === f.id;
              const count = counts?.[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onOriginChange(f.id)}
                  className={`qb-pill-btn ${active ? 'is-active' : ''}`}
                >
                  <span>{f.label}</span>
                  <span style={{ opacity: 0.85 }}>({count})</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: '1 1 260px', justifyContent: 'flex-end' }}>
            <select
              aria-label="Filtrar por habilidad"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="qb-select"
              style={{ maxWidth: '220px', flex: '1 1 160px' }}
            >
              <option value="all">Todas las habilidades</option>
              {SKILL_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="search"
              aria-label="Buscar cuestionario"
              placeholder="Buscar por título o autor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="qb-input"
              style={{ maxWidth: '240px', flex: '1 1 170px' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '14px', color: COLORS.muted }}>
          Mostrando <strong>{filteredQuizzes.length}</strong>{' '}
          {filteredQuizzes.length === 1 ? 'cuestionario reutilizable' : 'cuestionarios reutilizables'}
        </div>
      </section>

      <div className="qb-quiz-results">
        {error && (
          <div className="qb-panel">
            <FormMessage message={error} />
            <button type="button" onClick={onRetry} style={{ ...buttonStyle('secondary'), alignSelf: 'flex-start' }}>
              Intentar de nuevo
            </button>
          </div>
        )}

        {loading && (
          <div className="qb-panel" style={{ textAlign: 'center', padding: '28px', color: COLORS.muted }}>
            Cargando cuestionarios y calculando recomendaciones del grupo…
          </div>
        )}

        {!loading && !error && filteredQuizzes.length === 0 && (
          <div className="qb-panel" style={{ alignItems: 'flex-start' }}>
            <h3 className="font-display" style={{ margin: 0, fontSize: '20px' }}>
              No hay cuestionarios en esta selección
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted }}>
              Prueba otro filtro de origen o crea un cuestionario nuevo a tu medida.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {activeOrigin !== 'all' || skillFilter !== 'all' || search ? (
                <button
                  type="button"
                  onClick={() => {
                    onOriginChange('all');
                    setSkillFilter('all');
                    setSearch('');
                  }}
                  style={buttonStyle('secondary')}
                >
                  Ver todos los cuestionarios
                </button>
              ) : null}
              <button type="button" onClick={onGoToBuilder} style={buttonStyle('primary')}>
                Ir al Constructor de cuestionarios
              </button>
            </div>
          </div>
        )}

        {!loading && !error && filteredQuizzes.length > 0 && (
          <div className="qb-quiz-list">
            {filteredQuizzes.map((quiz) => {
              const stat = quiz.groupSkillStat;
              const levelStyle = stat ? getLevelStyle(stat.level) : null;
              const isExporting = exportingId === quiz.id;

              return (
                <article
                  key={quiz.id}
                  className={`qb-quiz-card ${quiz.isRecommended ? 'is-recommended' : ''}`}
                  onClick={() => onSelectQuiz(quiz.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                    <div className="qb-quiz-meta">
                      {quiz.isRecommended && (
                        <span className="qb-badge qb-badge-primary">
                          ★ Mejor para {groupContext?.groupName ?? 'tu grupo'}
                        </span>
                      )}
                      <span
                        className={`qb-badge ${
                          quiz.origin === 'own'
                            ? 'qb-badge-primary'
                            : quiz.origin === 'preloaded'
                              ? 'qb-badge-warm'
                              : 'qb-badge-neutral'
                        }`}
                      >
                        {ORIGIN_LABELS[quiz.origin] ?? 'Cuestionario'}
                      </span>
                      {stat && levelStyle && (
                        <span
                          className="qb-badge"
                          style={{ background: levelStyle.bg, color: levelStyle.fg }}
                        >
                          {stat.average == null ? 'Sin evaluar' : `${stat.average}% · ${stat.label}`}
                        </span>
                      )}
                      <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.muted }}>
                        {quiz.skill?.name} · {quiz.grade}.º · {quiz.questionCount}{' '}
                        {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'}
                      </span>
                    </div>

                    <h3 className="qb-quiz-title">{quiz.title}</h3>

                    {quiz.description && <p className="qb-quiz-desc">{quiz.description}</p>}

                    <div style={{ fontSize: '13px', color: COLORS.muted, display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                      <span>
                        Autor: <strong>{quiz.authorName}</strong>
                      </span>
                      <span>Tipos: {summarizeTypes(quiz.questionTypeCounts)}</span>
                    </div>
                  </div>

                  <div
                    className="qb-quiz-actions"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectQuiz(quiz.id)}
                      style={buttonStyle(quiz.isRecommended ? 'primary' : 'secondary', { fullWidth: true })}
                    >
                      Ver preguntas y respuestas
                    </button>

                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => onExportPdf(quiz)}
                      style={buttonStyle('secondary', { fullWidth: true, disabled: isExporting })}
                    >
                      <InterfaceIcon name="paper" size={18} />
                      {isExporting ? 'Generando PDF…' : 'Exportar a PDF'}
                    </button>

                    {quiz.canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditQuiz(quiz.id)}
                        style={buttonStyle('ghost', { fullWidth: true })}
                      >
                        <InterfaceIcon name="pencil" size={18} />
                        Editar mi cuestionario
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
