import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { BlockCompleteOverlay } from './BlockCompleteOverlay';
import { nextUnanswered, splitStem } from './assignmentLogic';
import { diagnosticsApi, friendlyDiagnosticsError } from './diagnostics.api';

const MAX_HINTS = 3;
const isFraction = (text) => /^\d+\/\d+$/.test(text);

/**
 * Ejercicio del alumno con datos reales (`/api/v1/diagnostics`): una pregunta a la vez, pistas
 * graduadas pedidas al servidor y retroalimentación neutra ("Respuesta guardada"): el servidor
 * nunca revela si fue correcta, para no distorsionar el diagnóstico. Al terminar se registra el
 * corte de dominio y se muestra un resumen amable.
 */
export function StudentAssignmentScreen() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const { axiColor } = useAppUi();

  const [state, setState] = useState({ status: 'loading', assignment: null, questions: [], error: null });
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null); // 'hint' | 'answer' | 'complete'
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [overlay, setOverlay] = useState(false);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    diagnosticsApi.start(assignmentId, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        const questions = [...data.questions].sort((a, b) => a.position - b.position);
        setState({ status: 'ready', assignment: data.assignment, questions, error: null });
        setIndex(Math.max(0, nextUnanswered(questions)));
      })
      .catch((error) => { if (!cancelled && error?.name !== 'AbortError') setState({ status: 'error', assignment: null, questions: [], error }); });
    return () => { cancelled = true; controller.abort(); };
  }, [assignmentId]);

  const { questions, assignment } = state;
  const question = questions[index];
  const answeredCount = useMemo(() => questions.filter((q) => q.answered).length, [questions]);
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const hintsUsed = useMemo(() => questions.reduce((sum, q) => sum + (q.hints?.length ?? 0), 0), [questions]);

  const updateQuestion = (id, patch) => setState((prev) => ({
    ...prev, questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  }));

  const askHint = async () => {
    if (!question || question.answered || (question.hints?.length ?? 0) >= MAX_HINTS) return;
    setPending('hint');
    setNotice(null);
    try {
      const level = (question.hints?.length ?? 0) + 1;
      const data = await diagnosticsApi.requestHint(assignmentId, question.id, level);
      updateQuestion(question.id, { hints: [...(question.hints ?? []), data.hint], maxHintLevelUsed: data.level });
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyDiagnosticsError(error) });
    } finally {
      setPending(null);
    }
  };

  const saveAnswer = async () => {
    if (!question || selected == null) return;
    setPending('answer');
    setNotice(null);
    try {
      await diagnosticsApi.answer(assignmentId, question.id, selected);
      const updated = questions.map((q) => (q.id === question.id ? { ...q, answered: true, selectedOptionId: selected } : q));
      setState((prev) => ({ ...prev, questions: updated }));
      setSelected(null);
      setNotice({ tone: 'ok', text: 'Respuesta guardada.' });
      const next = nextUnanswered(updated, index + 1);
      if (next >= 0) setIndex(next);
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyDiagnosticsError(error) });
    } finally {
      setPending(null);
    }
  };

  const finish = async () => {
    setPending('complete');
    setNotice(null);
    try {
      const data = await diagnosticsApi.complete(assignmentId);
      setResult(data);
      setSkip(false);
      setOverlay(true);
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyDiagnosticsError(error) });
    } finally {
      setPending(null);
    }
  };

  if (state.status === 'loading') return <p role="status" aria-live="polite">Preparando tu actividad…</p>;
  if (state.status === 'error') {
    return (
      <div className="kid-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
        <Mascot size={120} color={axiColor} mood="calma" animated={false} />
        <p role="alert" style={{ fontSize: '20px', margin: 0 }}>{friendlyDiagnosticsError(state.error)}</p>
        <button type="button" className="kid-button kid-button-primary" onClick={() => navigate('/alumno/inicio')}>Volver al inicio</button>
      </div>
    );
  }

  if (result) {
    const recorded = result.skills.filter((s) => s.masteryRecorded);
    return (
      <div className="kid-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Mascot size={110} color={axiColor} mood="acierto" animated={!reducedMotion} />
          <div>
            <p className="kid-eyebrow" style={{ margin: 0 }}>ACTIVIDAD TERMINADA</p>
            <h1 className="font-display" style={{ margin: '4px 0 0', fontSize: narrow ? '26px' : '32px' }}>¡Terminaste {assignment.title}!</h1>
            <p style={{ margin: '6px 0 0', fontSize: '17px', color: COLORS.muted }}>
              {hintsUsed ? `Pediste ${hintsUsed} ${hintsUsed === 1 ? 'pista' : 'pistas'} y seguiste intentando.` : 'Lo pensaste con calma, paso a paso.'}
            </p>
          </div>
        </header>
        <section className="kid-helper-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {result.skills.map((s) => (
            <div key={s.code} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong style={{ fontSize: '18px' }}>{s.name}</strong>
              <span style={{ fontSize: '17px', lineHeight: 1.4 }}>{s.message}</span>
              {s.achievedWithSupport > 0 && <span style={{ fontSize: '15px', color: COLORS.muted }}>Logrado con apoyo: {s.achievedWithSupport} {s.achievedWithSupport === 1 ? 'respuesta' : 'respuestas'}</span>}
            </div>
          ))}
          {recorded.length > 0 && <p style={{ margin: 0, fontSize: '15px', color: COLORS.muted }}>Tu maestra o maestro ya puede ver tu avance.</p>}
        </section>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="kid-button kid-button-primary" onClick={() => navigate('/alumno/inicio')}>Volver al inicio</button>
          <button type="button" className="kid-button" onClick={() => navigate('/alumno/juegos')}>Practicar con juegos</button>
        </div>
        {overlay && (
          <BlockCompleteOverlay
            axiColor={axiColor}
            effortMsg={hintsUsed ? `Pediste ${hintsUsed} ${hintsUsed === 1 ? 'pista' : 'pistas'} y seguiste intentando.` : 'Lo pensaste con calma, paso a paso.'}
            skip={skip}
            onSkip={() => setSkip(true)}
            onContinue={() => setOverlay(false)}
          />
        )}
      </div>
    );
  }

  const hints = question?.hints ?? [];
  const hasTextOptions = question?.options.some((o) => !isFraction(o.text));
  // Reactivos de lectura: el texto se muestra aparte de la pregunta.
  const { passage, prompt } = splitStem(question?.stem);
  const busy = pending != null;

  return (
    <div className="kid-exercise" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>
          {assignment.title} · Pregunta {index + 1} de {questions.length}
        </div>
        <div aria-label={`${answeredCount} de ${questions.length} preguntas contestadas`} style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {questions.map((q, i) => (
            <button key={q.id} type="button" onClick={() => { setIndex(i); setSelected(null); setNotice(null); }}
              aria-label={`Ir a la pregunta ${i + 1}${q.answered ? ', contestada' : ''}`} aria-current={i === index ? 'step' : undefined}
              style={{ width: '28px', height: '28px', borderRadius: '999px', border: `2px solid ${i === index ? COLORS.primaryAccent : COLORS.border}`,
                background: q.answered ? COLORS.ink : '#fff', color: q.answered ? '#fff' : COLORS.ink, fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
              {q.answered ? '✓' : i + 1}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '30px', padding: narrow ? '20px' : '28px', display: 'flex', flexDirection: 'column', gap: '22px', boxShadow: '0 6px 0 oklch(0.85 0.05 225)' }}>
        {passage && (
          <div style={{ padding: '14px 18px', borderRadius: '18px', background: COLORS.surfaceSubtle, border: `1.5px solid ${COLORS.border}`, fontSize: narrow ? '17px' : '18px', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: '6px' }}>{passage[0]}</strong>
            {passage.slice(1).map((p, i) => <p key={i} style={{ margin: '0 0 8px' }}>{p}</p>)}
          </div>
        )}
        <div className="font-display" style={{ fontWeight: 700, fontSize: narrow ? '24px' : '28px', lineHeight: 1.25 }}>{prompt}</div>

        {question.answered ? (
          <div role="status" style={{ padding: '14px 16px', borderRadius: '20px', background: COLORS.primarySoftBg, fontSize: '19px', fontWeight: 700 }}>
            Ya guardaste tu respuesta a esta pregunta.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '16px', color: COLORS.muted }}>Elige tu respuesta y guárdala.</p>
              <button type="button" className="kid-button kid-button-small" disabled={busy || hints.length >= MAX_HINTS} onClick={askHint}>
                {hints.length >= MAX_HINTS ? 'Ya viste las 3 pistas' : pending === 'hint' ? 'Buscando tu pista…' : `Necesito una pista (${hints.length + 1}/3)`}
              </button>
            </div>
            {hints.length > 0 && (
              <div role="status" style={{ background: COLORS.noticeBg, borderRadius: '18px', padding: '16px', fontSize: '18px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {hints.map((h, i) => <span key={i}><strong>Pista {i + 1}: </strong>{h}</span>)}
              </div>
            )}
            <div role="radiogroup" aria-label="Opciones de respuesta" style={{ display: 'grid', gridTemplateColumns: narrow && hasTextOptions ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              {question.options.map((o) => {
                const frac = isFraction(o.text);
                const [num, den] = frac ? o.text.split('/') : ['', ''];
                const on = selected === o.id;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={on} className="kid-option" disabled={busy}
                    aria-label={`${o.label}: ${o.text}`} onClick={() => setSelected(o.id)}
                    style={{ minHeight: frac ? '104px' : '74px', borderRadius: '22px', border: `2px solid ${on ? COLORS.primary : COLORS.borderInput}`,
                      background: on ? COLORS.primarySoftBg : '#fff', color: COLORS.ink, boxShadow: `0 4px 0 ${on ? COLORS.primary : COLORS.borderInput}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: frac ? '32px 12px 16px' : '36px 18px 18px', fontFamily: "'Baloo 2', sans-serif", fontWeight: frac ? 800 : 700,
                      fontSize: frac ? '30px' : narrow ? '17px' : '18px', lineHeight: frac ? 1.1 : 1.3, textAlign: 'center' }}>
                    <span className="kid-option-letter" aria-hidden="true">{on ? '●' : o.label}</span>
                    {frac ? (
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '34px', lineHeight: 1 }}>
                        <span>{num}</span><span style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'currentColor' }} /><span>{den}</span>
                      </span>
                    ) : <span>{o.text}</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="kid-button kid-button-primary" disabled={busy || selected == null} onClick={saveAnswer} style={{ alignSelf: 'flex-start' }}>
              {pending === 'answer' ? 'Guardando…' : 'Guardar respuesta'}
            </button>
          </>
        )}

        {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} style={{ fontSize: '17px', fontWeight: 700, color: notice.tone === 'error' ? COLORS.alertFg : COLORS.successFg }}>{notice.text}</div>}

        {(allAnswered || answeredCount > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '14px 16px', borderRadius: '20px', background: allAnswered ? 'oklch(0.93 0.07 165)' : COLORS.surfaceSubtle }}>
            <span style={{ flex: '1 1 220px', fontSize: '17px', fontWeight: 700 }}>
              {allAnswered ? '¡Contestaste todas las preguntas!' : `Llevas ${answeredCount} de ${questions.length}. Si ya no quieres seguir, puedes terminar.`}
            </span>
            <button type="button" className={allAnswered ? 'kid-button kid-button-primary' : 'kid-button'} disabled={busy} onClick={finish}>
              {pending === 'complete' ? 'Terminando…' : 'Terminar actividad'}
            </button>
          </div>
        )}
      </div>

      <div className="kid-helper-panel" style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
        <Mascot size={96} mood={hints.length ? 'pista' : 'feliz'} color={axiColor} animated={!reducedMotion} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: COLORS.primaryText }}>{hints.length ? `Pista ${hints.length} de 3` : APP_NAME}</div>
          <div style={{ fontSize: '19px', lineHeight: 1.35 }}>
            {question.answered ? 'Puedes ir a otra pregunta con los círculos de arriba.' : hints.length ? 'Tu pista está junto a la pregunta. Mírala con calma.' : 'Lee con calma. Si te atoras, pídeme una pista.'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '15px', textAlign: 'center', color: '#3A4565' }}>Sin prisa: aquí no hay tiempo límite.</div>
    </div>
  );
}
