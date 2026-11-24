import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { SKILLS, STUDENT_QUIZZES } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { BlockCompleteOverlay } from './BlockCompleteOverlay';
import { LevelUpOverlay } from './LevelUpOverlay';
import { MilestoneOverlay } from './MilestoneOverlay';
import { getStudentSkillSummaries } from './studentPortalStats';

/**
 * Pantalla 07: Motor de ejercicios del alumno con 3 niveles de pistas de Axi.
 */
export function StudentExerciseScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const {
    axiColor,
    stuIdx,
    activeQuizId,
    completedQuizzes,
    recordQuizAnswer,
    completeActiveQuiz,
    exIdx,
    setExIdx,
    fb,
    setFb,
    tried,
    setTried,
    hint,
    setHint,
    hintsUsed,
    setHintsUsed,
    overlay,
    setOverlay,
    skip,
    setSkip,
  } = useAppUi();

  const [lastReaction, setLastReaction] = useState(null);
  const [reactionKey, setReactionKey] = useState(0);

  useEffect(() => {
    setLastReaction(null);
  }, [exIdx]);

  const activeQuiz = STUDENT_QUIZZES.find((item) => item.id === activeQuizId) ?? STUDENT_QUIZZES[0];
  const exercises = activeQuiz.exercises;
  const sheet = activeQuiz.sheet;
  const safeExIdx = Math.min(exIdx, exercises.length - 1);
  const ex = exercises[safeExIdx];
  const q = sheet[ex.s];
  const hasTextOptions = q.o.some((optText) => !/^\d+\/\d+$/.test(optText));

  const skillName = SKILLS.find((s) => s.id === activeQuiz.skillId)?.name ?? 'Fracciones';
  const beforeSummary = getStudentSkillSummaries(stuIdx, {}).find(
    (s) => s.id === activeQuiz.skillId,
  );
  const afterSummary = getStudentSkillSummaries(stuIdx, completedQuizzes).find(
    (s) => s.id === activeQuiz.skillId,
  );

  const pickOption = (optIdx) => {
    if (fb === 'ok' || tried.includes(optIdx)) return;
    const isCorrect = optIdx === q.k;
    const errorTag = isCorrect ? null : activeQuiz.distractorErrors?.[ex.s]?.[optIdx] ?? null;
    recordQuizAnswer(safeExIdx, { isCorrect, maxHintUsed: hint, errorTag });
    setFb(isCorrect ? 'ok' : 'casi');
    if (isCorrect) {
      setLastReaction('acierto');
    } else {
      setTried((prev) => [...prev, optIdx]);
      setLastReaction('calma');
    }
    setReactionKey((prev) => prev + 1);
  };

  const handleNext = () => {
    if (safeExIdx < exercises.length - 1) {
      setExIdx((prev) => prev + 1);
      setFb(null);
      setTried([]);
      setHint(0);
      setLastReaction(null);
    } else {
      completeActiveQuiz();
      setSkip(false);
      setOverlay('bloque');
    }
  };

  const askHint = () => {
    if (hint < 3) {
      setHint((prev) => prev + 1);
      setHintsUsed((prev) => prev + 1);
      setLastReaction('pista');
      setReactionKey((prev) => prev + 1);
    }
  };

  const axiMood =
    lastReaction ||
    (fb === 'ok' ? 'acierto' : hint > 0 ? 'pista' : fb === 'casi' ? 'calma' : 'feliz');

  const bubble =
    axiMood === 'acierto'
      ? safeExIdx < exercises.length - 1
        ? '¡Muy bien! Vas por buen camino. Sigamos con la siguiente pregunta.'
        : '¡Muy bien! Terminaste esta pregunta.'
      : axiMood === 'pista' && hint > 0
      ? 'Tu pista está junto a la pregunta. Mírala y vuelve a intentarlo.'
      : axiMood === 'calma'
      ? hint > 0
        ? 'Puedes revisar la pista que está junto a la pregunta.'
        : '¡Casi! Tú puedes. Tómate un respiro, prueba con una pista e inténtalo de nuevo.'
      : hint > 0
      ? 'Tu pista está junto a la pregunta.'
      : 'Lee con calma. Si te atoras, pídeme una pista.';

  const hintTag =
    axiMood === 'acierto'
      ? `${APP_NAME} · ¡Muy bien!`
      : axiMood === 'calma'
      ? `${APP_NAME} · Tú puedes`
      : hint > 0
      ? `Pista ${hint} de 3`
      : APP_NAME;

  const panelTone =
    axiMood === 'acierto'
      ? { bg: '#ECFDF5', border: '#A7F3D0', tagColor: '#047857' }
      : axiMood === 'pista'
      ? { bg: '#EFF6FF', border: '#BFDBFE', tagColor: '#1D4ED8' }
      : axiMood === 'calma'
      ? { bg: '#FFFBEB', border: '#FDE68A', tagColor: '#B45309' }
      : { bg: '#fff', border: 'transparent', tagColor: COLORS.primaryText };

  const effortMsg = hintsUsed
    ? `Pediste ${hintsUsed} ${hintsUsed > 1 ? 'pistas' : 'pista'} y seguiste intentando.`
    : 'Lo pensaste con calma, paso a paso.';

  return (
    <div className="kid-exercise" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado y puntos de progreso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>
          {activeQuiz.title} · Pregunta {safeExIdx + 1} de {exercises.length}
        </div>
        <div aria-label={`Pregunta ${safeExIdx + 1} de ${exercises.length}`} style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {exercises.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: '28px',
                height: '10px',
                borderRadius: '999px',
                background:
                  idx < safeExIdx ? COLORS.ink : idx === safeExIdx ? COLORS.primaryAccent : '#fff',
              }}
            />
          ))}
        </div>
      </div>

      {/* Tarjeta principal del reactivo */}
      <div
        style={{
          background: '#fff',
          borderRadius: '30px',
          padding: narrow ? '20px' : '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          boxShadow: '0 6px 0 oklch(0.85 0.05 225)',
        }}
      >
        {q.passage && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '18px',
              background: COLORS.surfaceSubtle,
              border: `1.5px solid ${COLORS.border}`,
              fontSize: narrow ? '17px' : '18px',
              lineHeight: 1.5,
              color: COLORS.ink,
              textWrap: 'pretty',
            }}
          >
            {q.passage}
          </div>
        )}

        <div className="font-display" style={{ fontWeight: 700, fontSize: narrow ? '24px' : '28px', lineHeight: 1.25, textWrap: 'pretty' }}>
          {q.q}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: '16px', color: COLORS.muted }}>Toca la respuesta que elegiste.</p>
          <button type="button" className="kid-button kid-button-small" disabled={hint >= 3 || fb === 'ok'} onClick={askHint}>{hint >= 3 ? 'Ya viste las 3 pistas' : `Necesito una pista (${hint + 1}/3)`}</button>
        </div>
        {hint > 0 && <div role="status" style={{ background: COLORS.noticeBg, borderRadius: '18px', padding: '16px', fontSize: '18px', lineHeight: 1.5 }}><strong>Pista {hint}: </strong>{ex.h[hint - 1]}</div>}

        {q.bar && (
          <div
            style={{
              display: 'flex',
              height: '70px',
              border: `4px solid ${COLORS.ink}`,
              borderRadius: '16px',
              overflow: 'hidden',
              maxWidth: '440px',
            }}
          >
            {Array.from({ length: q.bar[0] }, (_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  borderLeft: idx ? `4px solid ${COLORS.ink}` : '0',
                  background: idx < q.bar[1] ? 'oklch(0.8 0.11 355)' : '#fff',
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow && hasTextOptions ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: '14px',
          }}
        >
          {q.o.map((optText, m) => {
            const isFrac = /^\d+\/\d+$/.test(optText);
            const [num, den] = isFrac ? optText.split('/') : ['', ''];
            const okSel = fb === 'ok' && m === q.k;
            const isTried = tried.includes(m);

            const bg = okSel ? 'oklch(0.93 0.07 165)' : isTried ? '#EEF1F6' : '#fff';
            const fg = isTried ? COLORS.muted : COLORS.ink;
            const border = okSel ? 'oklch(0.6 0.13 165)' : isTried ? '#D3D9E5' : COLORS.borderInput;

            return (
              <button
                key={optText}
                type="button"
                className="kid-option"
                disabled={fb === 'ok' || isTried}
                aria-label={`${String.fromCharCode(65 + m)}: ${optText}${okSel ? ', respuesta elegida' : isTried ? ', ya intentada' : ''}`}
                onClick={() => pickOption(m)}
                style={{
                  minHeight: isFrac ? '104px' : '74px',
                  borderRadius: '22px',
                  border: `2px solid ${border}`,
                  background: bg,
                  color: fg,
                  boxShadow: `0 4px 0 ${border}`,
                  cursor: fb === 'ok' || isTried ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: isFrac ? '32px 12px 16px' : '36px 18px 18px',
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: isFrac ? 800 : 700,
                  fontSize: isFrac ? '30px' : narrow ? '17px' : '18px',
                  lineHeight: isFrac ? 1.1 : 1.3,
                  textAlign: 'center',
                }}
              >
                <span className="kid-option-letter" aria-hidden="true">{okSel ? '✓' : String.fromCharCode(65 + m)}</span>
                {isFrac ? (
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '34px', lineHeight: 1 }}>
                    <span>{num}</span>
                    <span style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'currentColor' }} />
                    <span>{den}</span>
                  </span>
                ) : (
                  <span>{optText}</span>
                )}
              </button>
            );
          })}
        </div>

        {fb === 'ok' && (
          <div
            role="status"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '20px',
              background: 'oklch(0.93 0.07 165)',
            }}
          >
            <div
              className="font-display"
              style={{ flex: '1 1 200px', fontWeight: 700, fontSize: '22px', lineHeight: 1.2, color: 'oklch(0.35 0.1 165)' }}
            >
              {hint > 0 ? '¡Lo lograste con apoyo!' : '¡Lo pensaste y lo lograste!'}
            </div>
            <button
              type="button"
              onClick={handleNext}
              style={{
                height: '56px',
                padding: '0 26px',
                borderRadius: '18px',
                border: 0,
                background: COLORS.ink,
                color: '#fff',
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: '20px',
                lineHeight: 1,
                cursor: 'pointer',
                boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
              }}
            >
              {safeExIdx < exercises.length - 1 ? 'Siguiente' : 'Terminar'}
            </button>
          </div>
        )}

        {fb === 'casi' && (
          <div
            role="status"
            className="font-display"
            style={{
              padding: '14px 16px',
              borderRadius: '20px',
              background: 'oklch(0.95 0.07 90)',
              fontWeight: 700,
              fontSize: '22px',
              lineHeight: 1.2,
              color: 'oklch(0.38 0.08 75)',
            }}
          >
            {hint >= 3 ? 'Revisa la última pista o pide ayuda a tu docente.' : 'Puedes intentarlo otra vez. Prueba con una pista.'}
          </div>
        )}
      </div>

      {/* Panel de pistas de Axi */}
      <div className="kid-helper-panel" style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
        <Mascot
          size={104}
          mood={axiMood}
          color={axiColor}
          animated={!reducedMotion}
          reactionKey={reactionKey}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: panelTone.bg,
            border: `2px solid ${panelTone.border}`,
            borderRadius: '22px 22px 22px 6px',
            padding: '14px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            transition: reducedMotion ? 'none' : 'background 0.25s ease, border-color 0.25s ease',
          }}
        >
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: panelTone.tagColor }}>{hintTag}</div>
            <div style={{ fontSize: '19px', lineHeight: 1.35, textWrap: 'pretty' }}>{bubble}</div>
          </div>

        </div>
      </div>

      <div style={{ fontSize: '15px', textAlign: 'center', color: '#3A4565' }}>
        Sin prisa: aquí no hay tiempo límite.
      </div>

      {overlay === 'bloque' && (
        <BlockCompleteOverlay
          axiColor={axiColor}
          effortMsg={effortMsg}
          skip={skip}
          onSkip={() => setSkip(true)}
          onContinue={() => {
            setSkip(false);
            setOverlay('nivel');
          }}
        />
      )}

      {overlay === 'nivel' && (
        <LevelUpOverlay
          axiColor={axiColor}
          skip={skip}
          skillName={skillName}
          fromPct={beforeSummary?.currentPct ?? 36}
          toPct={afterSummary?.currentPct ?? 58}
          note="Cada paso forma parte de tu aprendizaje. Puedes seguir explorando con ayuda cuando la necesites."
          onSkip={() => setSkip(true)}
          onContinue={() => {
            setOverlay(null);
            navigate('/alumno/resumen');
          }}
        />
      )}

      {overlay === 'hito' && (
        <MilestoneOverlay
          axiColor={axiColor}
          skip={skip}
          onSkip={() => setSkip(true)}
          onViewBadges={() => {
            setOverlay(null);
            navigate('/alumno/logros');
          }}
        />
      )}
    </div>
  );
}
