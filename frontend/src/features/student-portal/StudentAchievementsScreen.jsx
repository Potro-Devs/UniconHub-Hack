import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS, LEVELS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { MilestoneOverlay } from './MilestoneOverlay';
import { getEarnedAchievements, getQuizItems } from './studentPortalStats';

const AXI_COLORS = [
  ['rosa', 'Rosa'],
  ['azul', 'Azul'],
  ['amarillo', 'Amarillo'],
  ['lila', 'Lila'],
];

function badgeChipColors(categoryTone) {
  if (categoryTone === 'lilac') {
    return { bg: COLORS.lilacSoftBg, fg: COLORS.lilacSoftFg };
  }
  const matched = LEVELS.find((l) => l.code === categoryTone);
  if (matched) {
    return { bg: matched.bg, fg: matched.fg };
  }
  return { bg: COLORS.primarySoftBg, fg: COLORS.primarySoftFg };
}

/**
 * Pantalla "Mis logros" del alumno: sellos de esfuerzo con <Mascot /> y selector de color.
 */
export function StudentAchievementsScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const { axiColor, setAxiColor, completedQuizzes } = useAppUi();
  const [showMilestone, setShowMilestone] = useState(false);
  const [skipAnim, setSkipAnim] = useState(false);

  const earnedAchievements = getEarnedAchievements(completedQuizzes);
  const pendingCount = getQuizItems(completedQuizzes).filter(
    (q) => q.resolvedStatus === 'pending_screen',
  ).length;

  return (
    <div className="kid-page kid-collection" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1
          className="font-display"
          style={{ margin: 0, fontWeight: 800, fontSize: narrow ? '26px' : '32px', lineHeight: 1.12 }}
        >
          Mis logros
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '15px', color: COLORS.muted, lineHeight: 1.45 }}>
          Los sellos de esfuerzo no se pierden. Cada uno celebra lo que ya lograste o trabajaste con calma junto a {APP_NAME}.
        </p>
      </div>

      <section
        aria-label="Resumen de logros"
        style={{
          background: '#fff',
          borderRadius: '24px',
          border: `2px solid ${COLORS.border}`,
          padding: narrow ? '18px 16px' : '22px 24px',
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 260px' }}>
          <Mascot size={narrow ? 76 : 92} mood="celebra" color={axiColor} animate={!reducedMotion} />
          <div>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '999px',
                background: COLORS.celebrationBg,
                color: COLORS.celebrationFg,
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              {earnedAchievements.length} sellos guardados
            </div>
            <h2 className="font-display" style={{ margin: '6px 0 0', fontWeight: 800, fontSize: '22px', lineHeight: 1.2 }}>
              ¡Cada paso cuenta en tu aprendizaje!
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '16px', color: COLORS.muted, lineHeight: 1.45 }}>
              Aquí reconocemos tu constancia, tu avance propio y el uso inteligente de pistas.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/alumno/inicio')}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              color: COLORS.ink,
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Volver a inicio
          </button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px' }}>
          Sellos de esfuerzo obtenidos
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {earnedAchievements.map((badge) => {
            const chip = badgeChipColors(badge.categoryTone);
            return (
              <article
                key={badge.id}
                className="axi-card-hover kid-collection-card"
                style={{
                  background: '#fff',
                  borderRadius: '22px',
                  border: `1px solid ${COLORS.border}`,
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: chip.bg,
                      color: chip.fg,
                      fontSize: '16px',
                      fontWeight: 700,
                    }}
                  >
                    {badge.category}
                  </span>
                  <span style={{ fontSize: '16px', color: COLORS.muted }}>{badge.earnedAt}</span>
                </div>

                <div
                  style={{
                    alignSelf: 'center',
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: COLORS.surfaceSubtle,
                    border: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '4px 0',
                  }}
                >
                  <Mascot
                    size={76}
                    mood={badge.isMilestone ? 'celebra' : 'feliz'}
                    color={badge.mascotColor}
                  />
                </div>

                <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '19px', lineHeight: 1.25 }}>
                  {badge.title}
                </h3>

                <p style={{ margin: 0, fontSize: '16px', color: COLORS.muted, lineHeight: 1.45 }}>
                  {badge.description}
                </p>

                {badge.isMilestone && (
                  <button
                    type="button"
                    onClick={() => {
                      setSkipAnim(false);
                      setShowMilestone(true);
                    }}
                    style={{
                      marginTop: 'auto',
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
                    Celebrar este sello ✨
                  </button>
                )}
              </article>
            );
          })}

          <article
            className="axi-dashed-hover"
            style={{
              background: COLORS.surfaceSubtle,
              borderRadius: '22px',
              border: `2px dashed ${COLORS.borderInput}`,
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mascot size={60} mood="pista" color="linea" />
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: '#fff',
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.muted,
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                Próximo sello
              </span>
            </div>

            <div>
              <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '19px', lineHeight: 1.25 }}>
                {pendingCount > 0 ? 'Completa tu cuestionario pendiente' : 'Constancia del ciclo escolar'}
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: '16px', color: COLORS.muted, lineHeight: 1.45 }}>
                {pendingCount > 0
                  ? `Aún tienes ${pendingCount} ${pendingCount === 1 ? 'cuestionario pendiente' : 'cuestionarios pendientes'}. Termínalo en pantalla para desbloquear otro logro.`
                  : 'Ya completaste todos tus cuestionarios programados. Sigue practicando en tus próximas actividades.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/alumno/inicio')}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.border}`,
                background: '#fff',
                color: COLORS.primaryText,
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              {pendingCount > 0 ? 'Ir a pendientes →' : 'Volver a inicio →'}
            </button>
          </article>
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          borderRadius: '22px',
          border: `1px solid ${COLORS.border}`,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '21px', lineHeight: 1.2 }}>
            Elige el color de {APP_NAME}
          </h2>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'oklch(0.94 0.08 90)',
              color: 'oklch(0.4 0.09 75)',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            Personalización
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '10px',
          }}
        >
          {AXI_COLORS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAxiColor(id)}
              aria-pressed={axiColor === id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                minHeight: '44px',
                padding: '12px 8px',
                borderRadius: '18px',
                border: `3px solid ${axiColor === id ? COLORS.ink : COLORS.border}`,
                background: COLORS.surfaceSubtle,
                cursor: 'pointer',
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: 1,
                color: COLORS.ink,
              }}
            >
              <Mascot size={78} color={id} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {showMilestone && (
        <MilestoneOverlay
          axiColor={axiColor}
          skip={skipAnim}
          onSkip={() => setSkipAnim(true)}
          onViewBadges={() => setShowMilestone(false)}
        />
      )}
    </div>
  );
}
