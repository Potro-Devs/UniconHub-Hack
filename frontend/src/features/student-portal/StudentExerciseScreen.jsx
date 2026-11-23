import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { FRACTION_SHEET, STUDENT_EXERCISES } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { BlockCompleteOverlay } from './BlockCompleteOverlay';
import { LevelUpOverlay } from './LevelUpOverlay';
import { MilestoneOverlay } from './MilestoneOverlay';

/**
 * Pantalla 07: Motor de ejercicios del alumno con 3 niveles de pistas de Axi.
 */
export function StudentExerciseScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const {
    axiColor,
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

  const ex = STUDENT_EXERCISES[exIdx];
  const q = FRACTION_SHEET[ex.s];

  const pickOption = (optIdx) => {
    if (fb === 'ok' || tried.includes(optIdx)) return;
    const isCorrect = optIdx === q.k;
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
    if (exIdx < STUDENT_EXERCISES.length - 1) {
      setExIdx((prev) => prev + 1);
      setFb(null);
      setTried([]);
      setHint(0);
      setLastReaction(null);
    } else {
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
      ? exIdx < STUDENT_EXERCISES.length - 1
        ? '¡Muy bien! Vas por buen camino. Sigamos con la siguiente pregunta.'
        : '¡Muy bien! Terminaste esta pregunta.'
      : axiMood === 'pista' && hint > 0
      ? ex.h[hint - 1]
      : axiMood === 'calma'
      ? hint > 0
        ? `¡Casi! Tú puedes. Revisa la pista: ${ex.h[hint - 1]}`
        : '¡Casi! Tú puedes. Tómate un respiro, prueba con una pista e inténtalo de nuevo.'
      : hint > 0
      ? ex.h[hint - 1]
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Encabezado y puntos de progreso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>
          Fracciones · Ejercicio {exIdx + 1} de {STUDENT_EXERCISES.length}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {STUDENT_EXERCISES.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: '28px',
                height: '10px',
                borderRadius: '999px',
                background:
                  idx < exIdx ? COLORS.ink : idx === exIdx ? COLORS.primaryAccent : '#fff',
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
        <div className="font-display" style={{ fontWeight: 700, fontSize: '28px', lineHeight: 1.25, textWrap: 'pretty' }}>
          {q.q}
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
          {q.o.map((optText, m) => {
            const isFrac = /^\d+\/\d+$/.test(optText);
            const [num, den] = isFrac ? optText.split('/') : ['', ''];
            const okSel = fb === 'ok' && m === q.k;
            const isTried = tried.includes(m);

            const bg = okSel ? 'oklch(0.93 0.07 165)' : isTried ? '#EEF1F6' : '#fff';
            const fg = isTried ? COLORS.mutedLight : COLORS.ink;
            const border = okSel ? 'oklch(0.6 0.13 165)' : isTried ? '#D3D9E5' : COLORS.ink;

            return (
              <button
                key={optText}
                type="button"
                onClick={() => pickOption(m)}
                style={{
                  minHeight: '104px',
                  borderRadius: '22px',
                  border: `4px solid ${border}`,
                  background: bg,
                  color: fg,
                  boxShadow: `0 6px 0 ${border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: 800,
                  fontSize: '30px',
                  lineHeight: 1.1,
                }}
              >
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
              Correcto.
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
              {exIdx < STUDENT_EXERCISES.length - 1 ? 'Siguiente' : 'Terminar'}
            </button>
          </div>
        )}

        {fb === 'casi' && (
          <div
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
            Casi. Prueba con una pista.
          </div>
        )}
      </div>

      {/* Panel de pistas de Axi */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
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
          <button
            type="button"
            onClick={askHint}
            style={{
              height: '52px',
              padding: '0 20px',
              borderRadius: '16px',
              border: `3px solid ${COLORS.ink}`,
              background: hint >= 3 ? '#EEF1F6' : 'oklch(0.9 0.11 90)',
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: 1,
              cursor: 'pointer',
              color: COLORS.ink,
            }}
          >
            {hint >= 3 ? 'Ya viste las 3' : 'Pedir pista'}
          </button>
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
            navigate('/alumno/sellos');
          }}
        />
      )}
    </div>
  );
}
