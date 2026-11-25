import { useCallback, useEffect, useState } from 'react';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { errorMessageOf } from '@/shared/api/client';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { useAppUi } from '@/shared/state/AppUiContext';
import { assessmentsApi } from './assessments.api';
import { createEmptyQuizDraft, quizDetailToDraft } from './assessments.logic';
import { QuizBuilderTab } from './QuizBuilderTab';
import { QuizDetailModal } from './QuizDetailModal';
import { QuizzesCatalogTab } from './QuizzesCatalogTab';
import './assessments.css';

/**
 * Vista docente: "Cuestionarios y constructor".
 * Contiene dos pestañas independientes accesibles desde la parte superior:
 *   1. "Cuestionarios y pruebas" (catálogo propio, colegas y precargados + recomendaciones dinámicas + PDF)
 *   2. "Constructor de cuestionarios" (editor tipo Kahoot! + desglose de cuestionarios realizados)
 */
export function QuizzesBuilderScreen() {
  const { groups, activeGroup, setActiveGroupId } = useTeacherGroups();
  const { say } = useAppUi();

  const [activeTab, setActiveTab] = useState('catalog');
  const [activeOrigin, setActiveOrigin] = useState('all');

  const [catalogState, setCatalogState] = useState({
    loading: true,
    error: '',
    quizzes: [],
    counts: { all: 0, recommended: 0, own: 0, other_teachers: 0, preloaded: 0 },
    groupContext: null,
  });

  // Lista completa de cuestionarios propios para el desglose del constructor.
  const [ownQuizzes, setOwnQuizzes] = useState([]);

  const [detailState, setDetailState] = useState({
    open: false,
    loading: false,
    error: '',
    quiz: null,
  });

  const [draft, setDraft] = useState(() => createEmptyQuizDraft(activeGroup?.grade ?? 3));
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [lastSavedQuiz, setLastSavedQuiz] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const activeGroupId = activeGroup?.id ?? null;

  const loadQuizzes = useCallback(async () => {
    setCatalogState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await assessmentsApi.listQuizzes({ groupId: activeGroupId, origin: 'all' });
      const fullList = res.quizzes ?? [];
      setOwnQuizzes(fullList.filter((q) => q.origin === 'own'));

      setCatalogState({
        loading: false,
        error: '',
        quizzes: fullList,
        counts: res.counts ?? { all: 0, recommended: 0, own: 0, other_teachers: 0, preloaded: 0 },
        groupContext: res.groupContext ?? null,
      });
    } catch (error) {
      setCatalogState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessageOf(error),
      }));
    }
  }, [activeGroupId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const openQuizDetail = async (quizId) => {
    setDetailState({ open: true, loading: true, error: '', quiz: null });
    try {
      const detail = await assessmentsApi.getQuiz(quizId, { groupId: activeGroupId });
      setDetailState({ open: true, loading: false, error: '', quiz: detail });
    } catch (error) {
      setDetailState({ open: true, loading: false, error: errorMessageOf(error), quiz: null });
    }
  };

  const closeQuizDetail = () => {
    setDetailState({ open: false, loading: false, error: '', quiz: null });
  };

  const loadQuizIntoBuilder = async (quizOrId) => {
    setSaveError('');
    setLastSavedQuiz(null);
    try {
      const detail =
        typeof quizOrId === 'object' && quizOrId?.questions
          ? quizOrId
          : await assessmentsApi.getQuiz(quizOrId, { groupId: activeGroupId });
      if (!detail.canEdit) {
        say('Solo puedes editar cuestionarios creados por ti.');
        return;
      }
      setDraft(quizDetailToDraft(detail));
      setEditingQuizId(detail.id);
      setActiveQuestionIndex(0);
      closeQuizDetail();
      setActiveTab('builder');
    } catch (error) {
      say(errorMessageOf(error));
    }
  };

  const handleCancelEdit = () => {
    setEditingQuizId(null);
    setDraft(createEmptyQuizDraft(activeGroup?.grade ?? 3));
    setActiveQuestionIndex(0);
    setSaveError('');
    setLastSavedQuiz(null);
  };

  const handleSaveQuiz = async (payload) => {
    setSaving(true);
    setSaveError('');
    try {
      const saved = editingQuizId
        ? await assessmentsApi.updateQuiz(editingQuizId, payload)
        : await assessmentsApi.createQuiz(payload);
      setLastSavedQuiz(saved);
      setEditingQuizId(saved.id);
      setDraft(quizDetailToDraft(saved));
      say(editingQuizId ? 'Cuestionario actualizado.' : 'Cuestionario creado y guardado.');
      await loadQuizzes();
    } catch (error) {
      setSaveError(errorMessageOf(error));
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async (quiz) => {
    setExportingId(quiz.id);
    try {
      const blob = await assessmentsApi.exportQuizPdf(quiz.id, { groupId: activeGroupId });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cuestionario-${quiz.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`PDF listo: "${quiz.title}" (Carta B/N, sin respuestas).`);
    } catch (error) {
      say(errorMessageOf(error));
    } finally {
      setExportingId(null);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'catalog') setLastSavedQuiz(null);
  };

  return (
    <div className="qb-page">
      <header className="qb-header">
        <h1 className="font-display">Cuestionarios y constructor</h1>
        <p>
          Consulta cuestionarios propios, de otros docentes o precargados por Axi con recomendaciones según el desempeño de tu grupo, o construye nuevas pruebas tipo Kahoot!.
        </p>
      </header>

      {/* Botones superiores de navegación entre los dos bloques (pestañas independientes) */}
      <div role="tablist" aria-label="Secciones de cuestionarios" className="qb-tablist">
        <button
          type="button"
          role="tab"
          id="qb-tab-catalog"
          aria-selected={activeTab === 'catalog'}
          aria-controls="qb-panel-catalog"
          onClick={() => switchTab('catalog')}
          className={`qb-tab-card ${activeTab === 'catalog' ? 'is-active' : ''}`}
        >
          <div className="qb-tab-lead">
            <div className="qb-tab-icon">
              <InterfaceIcon name="paper" size={22} />
            </div>
            <div className="qb-tab-text">
              <span className="qb-tab-title">Cuestionarios y pruebas</span>
              <span className="qb-tab-sub">
                Filtra propios, de otros docentes y precargados; revisa reactivos y exporta PDF
              </span>
            </div>
          </div>
          <span className={`qb-badge ${activeTab === 'catalog' ? 'qb-badge-primary' : 'qb-badge-warm'}`}>
            {catalogState.counts.recommended > 0
              ? `${catalogState.counts.recommended} recomendados`
              : `${catalogState.counts.all} disponibles`}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="qb-tab-builder"
          aria-selected={activeTab === 'builder'}
          aria-controls="qb-panel-builder"
          onClick={() => switchTab('builder')}
          className={`qb-tab-card ${activeTab === 'builder' ? 'is-active' : ''}`}
        >
          <div className="qb-tab-lead">
            <div className="qb-tab-icon">
              <InterfaceIcon name="pencil" size={22} />
            </div>
            <div className="qb-tab-text">
              <span className="qb-tab-title">Constructor de cuestionarios</span>
              <span className="qb-tab-sub">
                Crea preguntas paso a paso estilo Kahoot! y consulta el desglose de tus pruebas
              </span>
            </div>
          </div>
          <span className={`qb-badge ${activeTab === 'builder' ? 'qb-badge-primary' : 'qb-badge-neutral'}`}>
            {editingQuizId ? 'Editando' : `${ownQuizzes.length} propios`}
          </span>
        </button>
      </div>

      {/* Renderiza únicamente la pestaña activa (nunca apiladas una arriba de la otra) */}
      {activeTab === 'catalog' ? (
        <div role="tabpanel" id="qb-panel-catalog" aria-labelledby="qb-tab-catalog">
          <QuizzesCatalogTab
            quizzes={catalogState.quizzes}
            counts={catalogState.counts}
            groupContext={catalogState.groupContext}
            activeOrigin={activeOrigin}
            onOriginChange={setActiveOrigin}
            groups={groups}
            activeGroupId={activeGroupId}
            onGroupChange={(id) => setActiveGroupId(id)}
            loading={catalogState.loading}
            error={catalogState.error}
            onRetry={loadQuizzes}
            onSelectQuiz={openQuizDetail}
            onEditQuiz={loadQuizIntoBuilder}
            onExportPdf={handleExportPdf}
            exportingId={exportingId}
            onGoToBuilder={() => {
              handleCancelEdit();
              setActiveTab('builder');
            }}
          />
        </div>
      ) : (
        <div role="tabpanel" id="qb-panel-builder" aria-labelledby="qb-tab-builder">
          <QuizBuilderTab
            draft={draft}
            setDraft={setDraft}
            activeIndex={activeQuestionIndex}
            setActiveIndex={setActiveQuestionIndex}
            editingQuizId={editingQuizId}
            ownQuizzes={ownQuizzes}
            onCancelEdit={handleCancelEdit}
            onSaveQuiz={handleSaveQuiz}
            saving={saving}
            saveError={saveError}
            lastSavedQuiz={lastSavedQuiz}
            onViewQuiz={openQuizDetail}
            onEditOwnQuiz={loadQuizIntoBuilder}
            onExportPdf={handleExportPdf}
            exportingId={exportingId}
          />
        </div>
      )}

      {detailState.open && (
        <QuizDetailModal
          quiz={detailState.quiz}
          loading={detailState.loading}
          error={detailState.error}
          onClose={closeQuizDetail}
          onEdit={loadQuizIntoBuilder}
          onExportPdf={handleExportPdf}
          exportingPdf={Boolean(detailState.quiz && exportingId === detailState.quiz.id)}
        />
      )}
    </div>
  );
}
