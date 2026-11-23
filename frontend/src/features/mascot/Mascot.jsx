import { useState } from 'react';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import {
  MASCOT_PALETTES,
  SIZE_MAP,
  STATE_TO_MOOD,
  mascotConfig,
} from './mascot.config';

/**
 * Devuelve la configuración de animaciones por estado respetando la geometría de Axi.
 */
function getMoodAnimations(resolvedMood, shouldAnimate) {
  if (!shouldAnimate) {
    return {
      body: 'none',
      bodyOrigin: '100px 180px',
      head: 'none',
      gillLeft: 'none',
      gillRight: 'none',
      blink: 'none',
      eyeLook: 'none',
      armLeftUp: 'none',
      armRightUp: 'none',
      armRightDown: 'none',
      ideaOrb: 'none',
      ideaRing: 'none',
      calmGlow: 'none',
      calmOrb: 'none',
      aciertoHalo: 'none',
      aciertoSpark: (delay) => ({ animation: 'none', opacity: 0.85, delay }),
      celebrateSpark: 'none',
    };
  }

  switch (resolvedMood) {
    case 'pista':
      return {
        body: 'none',
        bodyOrigin: '100px 180px',
        head: 'axiHeadTilt 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards',
        gillLeft: 'none',
        gillRight: 'axiGillCurious 0.7s ease-in-out 0.2s 1',
        blink: 'axiBlink 4.5s 1.1s infinite',
        eyeLook: 'axiLookUpRight 0.6s ease-out 0.15s forwards',
        armLeftUp: 'none',
        armRightUp: 'none',
        armRightDown: 'axiPointUp 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards',
        ideaOrb: 'axiIdeaPop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        ideaRing: 'axiIdeaRing 1.2s ease-out 0.15s forwards',
        calmGlow: 'none',
        calmOrb: 'none',
        aciertoHalo: 'none',
        aciertoSpark: () => ({ animation: 'none', opacity: 0 }),
        celebrateSpark: 'none',
      };
    case 'calma':
      return {
        body: 'axiCalmSway 1.4s ease-in-out forwards',
        bodyOrigin: '100px 180px',
        head: 'none',
        gillLeft: 'axiCalmBreathL 1.4s ease-in-out forwards',
        gillRight: 'axiCalmBreathR 1.4s ease-in-out forwards',
        blink: 'none',
        eyeLook: 'none',
        armLeftUp: 'none',
        armRightUp: 'none',
        armRightDown: 'none',
        ideaOrb: 'none',
        ideaRing: 'none',
        calmGlow: 'axiWarmGlow 1.4s ease-in-out forwards',
        calmOrb: 'axiCalmOrbFloat 1.4s ease-in-out forwards',
        aciertoHalo: 'none',
        aciertoSpark: () => ({ animation: 'none', opacity: 0 }),
        celebrateSpark: 'none',
      };
    case 'acierto':
      return {
        body: 'axiQuickHop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        bodyOrigin: '100px 180px',
        head: 'none',
        gillLeft: 'axiGillPerkL 0.45s ease-out 0.1s 1',
        gillRight: 'axiGillPerkR 0.45s ease-out 0.1s 1',
        blink: 'axiBlink 4.5s 0.9s infinite',
        eyeLook: 'none',
        armLeftUp: 'none',
        armRightUp: 'none',
        armRightDown: 'axiQuickWave 0.55s ease-in-out 0.12s 1',
        ideaOrb: 'none',
        ideaRing: 'none',
        calmGlow: 'none',
        calmOrb: 'none',
        aciertoHalo: 'axiHaloPulse 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        aciertoSpark: (delay) => ({
          animation: `axiSparkPop 0.75s ease-out ${delay} forwards`,
          opacity: 0,
        }),
        celebrateSpark: 'none',
      };
    case 'celebra':
      return {
        body: 'axiCelebrateJump 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
        bodyOrigin: '100px 180px',
        head: 'none',
        gillLeft: 'axiGillDanceL 0.45s ease-in-out 0.25s 3 alternate',
        gillRight: 'axiGillDanceR 0.45s ease-in-out 0.25s 3 alternate',
        blink: 'none',
        eyeLook: 'none',
        armLeftUp: 'axiArmRaiseL 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s 2 alternate',
        armRightUp: 'axiArmRaiseR 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s 2 alternate',
        armRightDown: 'none',
        ideaOrb: 'none',
        ideaRing: 'none',
        calmGlow: 'none',
        calmOrb: 'none',
        aciertoHalo: 'none',
        aciertoSpark: () => ({ animation: 'none', opacity: 0 }),
        celebrateSpark: 'axiCelebrateSpark 0.8s ease-out 0.3s both',
      };
    default:
      return {
        body: 'axiBob 2.4s ease-in-out infinite',
        bodyOrigin: '100px 100px',
        head: 'none',
        gillLeft: 'axiGillL 2.4s ease-in-out infinite',
        gillRight: 'axiGillR 2.4s ease-in-out infinite',
        blink: 'axiBlink 4.5s infinite',
        eyeLook: 'none',
        armLeftUp: 'none',
        armRightUp: 'none',
        armRightDown: 'none',
        ideaOrb: 'none',
        ideaRing: 'none',
        calmGlow: 'none',
        calmOrb: 'none',
        aciertoHalo: 'none',
        aciertoSpark: () => ({ animation: 'none', opacity: 0 }),
        celebrateSpark: 'none',
      };
  }
}

/**
 * Componente único y desacoplado de la mascota guía.
 * Soporta reemplazo futuro por archivos en ./assets/ vía mascot.config.js.
 */
export function Mascot({
  size = 120,
  mood,
  state = 'default',
  color = 'rosa',
  animate = false,
  animated,
  message,
  reactionKey,
}) {
  const reducedMotion = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);

  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 120;
  const resolvedMood = mood || STATE_TO_MOOD[state] || 'feliz';
  const palette = MASCOT_PALETTES[color] || MASCOT_PALETTES.rosa;
  const wantsAnimate = Boolean(animated ?? animate);
  const shouldAnimate = wantsAnimate && !reducedMotion;
  const isLine = color === 'linea';

  const customSrc = mascotConfig.states[state] || mascotConfig.states.default;
  if (customSrc && !imgFailed) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <img
          src={customSrc}
          alt={mascotConfig.altText}
          onError={() => setImgFailed(true)}
          style={{
            width: px,
            height: px,
            objectFit: 'contain',
            flex: 'none',
          }}
        />
        {message && (
          <div
            style={{
              background: '#fff',
              borderRadius: '18px 18px 18px 6px',
              padding: '10px 14px',
              fontSize: 15,
              lineHeight: 1.35,
            }}
          >
            {message}
          </div>
        )}
      </div>
    );
  }

  const k = px / 200;
  const open = resolvedMood === 'feliz' || resolvedMood === 'pista' || resolvedMood === 'acierto';
  const happy = resolvedMood === 'celebra';
  const calm = resolvedMood === 'calma';
  const smile = resolvedMood === 'feliz' || resolvedMood === 'acierto';
  const grin = resolvedMood === 'celebra';
  const oMouth = resolvedMood === 'pista';
  const soft = resolvedMood === 'calma';
  const idea = resolvedMood === 'pista';
  const sparkles = resolvedMood === 'celebra';
  const armsUp = resolvedMood === 'celebra';
  const armsDown = !armsUp;
  const hlx = resolvedMood === 'pista' ? 11 : 4;
  const hly = resolvedMood === 'pista' ? 2 : 4;

  const anim = getMoodAnimations(resolvedMood, shouldAnimate);
  const staticHintPose = resolvedMood === 'pista' && wantsAnimate && reducedMotion;
  const stageKey = shouldAnimate ? `${resolvedMood}-${reactionKey ?? 0}` : 'static';

  return (
    <div
      style={{
        width: `${px}px`,
        height: `${px}px`,
        position: 'relative',
        flex: 'none',
      }}
      aria-label={mascotConfig.altText}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 200,
          height: 200,
          transform: `scale(${k})`,
          transformOrigin: '0 0',
        }}
      >
        <div key={stageKey} style={{ position: 'absolute', inset: 0 }}>
          {/* Halo de motivación al fallar (calma) */}
          {calm && wantsAnimate && !isLine && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 24,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(254, 243, 199, 0.72) 0%, rgba(254, 243, 199, 0) 72%)',
                  transformOrigin: '100px 104px',
                  animation: anim.calmGlow,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 158,
                  top: 22,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'rgba(253, 230, 138, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: anim.calmOrb,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#FBBF24',
                  }}
                />
              </div>
            </>
          )}

          {/* Halo y destellos sutiles de acierto */}
          {resolvedMood === 'acierto' && wantsAnimate && !isLine && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 24,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(209, 250, 229, 0.78) 0%, rgba(209, 250, 229, 0) 72%)',
                  transformOrigin: '100px 104px',
                  animation: anim.aciertoHalo,
                  pointerEvents: 'none',
                }}
              />
              {[
                { left: 14, top: 22, size: 18, bg: '#10B981', delay: '0.08s', star: true },
                { left: 168, top: 28, size: 16, bg: '#F59E0B', delay: '0.18s', star: true },
                { left: 154, top: 14, size: 8, bg: '#34D399', delay: '0.14s', star: false },
              ].map((sp, idx) => {
                const st = anim.aciertoSpark(sp.delay);
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: sp.left,
                      top: sp.top,
                      width: sp.size,
                      height: sp.size,
                      borderRadius: sp.star ? 0 : '50%',
                      clipPath: sp.star
                        ? 'polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)'
                        : undefined,
                      background: sp.bg,
                      opacity: st.opacity,
                      animation: st.animation,
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}
            </>
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: anim.bodyOrigin,
              animation: anim.body,
            }}
          >
            {idea && (
              <>
                {wantsAnimate && !isLine && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 155,
                      top: 3,
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      border: '3px solid #FBBF24',
                      opacity: 0,
                      animation: anim.ideaRing,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: '177px 25px',
                    animation: anim.ideaOrb,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 146,
                      top: 62,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'oklch(0.88 0.14 95)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 154,
                      top: 44,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'oklch(0.88 0.14 95)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 162,
                      top: 10,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'oklch(0.9 0.15 95)',
                      boxShadow: '0 0 0 7px oklch(0.95 0.08 95)',
                    }}
                  />
                </div>
              </>
            )}

            {sparkles && (
              <div style={{ position: 'absolute', inset: 0, animation: anim.celebrateSpark }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: 20,
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    transform: 'rotate(45deg)',
                    background: 'oklch(0.85 0.15 90)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 176,
                    top: 28,
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    transform: 'rotate(45deg)',
                    background: 'oklch(0.6 0.19 268)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 96,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: 'oklch(0.7 0.14 165)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 184,
                    top: 104,
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    transform: 'rotate(45deg)',
                    background: 'oklch(0.85 0.15 90)',
                  }}
                />
              </div>
            )}

            {/* Cola */}
            <div
              style={{
                position: 'absolute',
                left: 120,
                top: 150,
                width: 62,
                height: 24,
                borderRadius: '40% 70% 70% 40% / 50%',
                transform: 'rotate(-22deg)',
                background: palette.body,
                border: palette.line,
              }}
            />
            {/* Patas */}
            <div
              style={{
                position: 'absolute',
                left: 66,
                top: 176,
                width: 24,
                height: 14,
                borderRadius: '50%',
                background: palette.body,
                border: palette.line,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 110,
                top: 176,
                width: 24,
                height: 14,
                borderRadius: '50%',
                background: palette.body,
                border: palette.line,
              }}
            />
            {/* Cuerpo y panza */}
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 128,
                width: 80,
                height: 58,
                borderRadius: '50%',
                background: palette.body,
                border: palette.line,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 76,
                top: 144,
                width: 48,
                height: 36,
                borderRadius: '50%',
                background: palette.belly,
              }}
            />

            {armsDown && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: 48,
                    top: 146,
                    width: 26,
                    height: 16,
                    borderRadius: '50%',
                    transform: 'rotate(35deg)',
                    background: palette.body,
                    border: palette.line,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: '132px 154px',
                    transform: staticHintPose ? 'rotate(-30deg) translateY(-2px)' : undefined,
                    animation: anim.armRightDown,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 126,
                      top: 146,
                      width: 26,
                      height: 16,
                      borderRadius: '50%',
                      transform: 'rotate(-35deg)',
                      background: palette.body,
                      border: palette.line,
                    }}
                  />
                </div>
              </>
            )}

            {/* Grupo cabeza + branquias (inclina en Pista) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transformOrigin: '100px 128px',
                animation: anim.head,
              }}
            >
              {/* Branquias izquierdas */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 40,
                  width: 62,
                  height: 96,
                  transformOrigin: '100% 50%',
                  animation: anim.gillLeft,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 6,
                    width: 56,
                    height: 18,
                    borderRadius: 999,
                    transform: 'rotate(28deg)',
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 39,
                    width: 58,
                    height: 18,
                    borderRadius: 999,
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 72,
                    width: 56,
                    height: 18,
                    borderRadius: 999,
                    transform: 'rotate(-28deg)',
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
              </div>

              {/* Branquias derechas */}
              <div
                style={{
                  position: 'absolute',
                  left: 138,
                  top: 40,
                  width: 62,
                  height: 96,
                  transformOrigin: '0 50%',
                  animation: anim.gillRight,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: 6,
                    width: 56,
                    height: 18,
                    borderRadius: 999,
                    transform: 'rotate(-28deg)',
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 39,
                    width: 58,
                    height: 18,
                    borderRadius: 999,
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: 72,
                    width: 56,
                    height: 18,
                    borderRadius: 999,
                    transform: 'rotate(28deg)',
                    background: palette.gill,
                    border: palette.line,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: 18,
                      height: '100%',
                      borderRadius: '50%',
                      background: palette.tip,
                    }}
                  />
                </div>
              </div>

              {/* Cabeza */}
              <div
                style={{
                  position: 'absolute',
                  left: 34,
                  top: 40,
                  width: 132,
                  height: 110,
                  borderRadius: '50% 50% 46% 46% / 56% 56% 44% 44%',
                  background: palette.body,
                  border: palette.line,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 56,
                  top: 58,
                  width: 26,
                  height: 13,
                  borderRadius: '50%',
                  transform: 'rotate(-24deg)',
                  background: palette.hl,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 89,
                  top: 50,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: palette.spot,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 101,
                  top: 45,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: palette.spot,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 111,
                  top: 51,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: palette.spot,
                }}
              />

              {open && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: staticHintPose ? 'translate(3px, -2.5px)' : undefined,
                    animation: anim.eyeLook,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 69,
                      top: 80,
                      width: 22,
                      height: 25,
                      borderRadius: '50%',
                      background: '#18203A',
                      animation: anim.blink,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: hlx,
                        top: hly,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 13,
                        top: 15,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: 109,
                      top: 80,
                      width: 22,
                      height: 25,
                      borderRadius: '50%',
                      background: '#18203A',
                      animation: anim.blink,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: hlx,
                        top: hly,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 13,
                        top: 15,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                  </div>
                </div>
              )}

              {happy && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: 67,
                      top: 86,
                      width: 26,
                      height: 14,
                      border: '5px solid #18203A',
                      borderBottom: 0,
                      borderRadius: '26px 26px 0 0',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 107,
                      top: 86,
                      width: 26,
                      height: 14,
                      border: '5px solid #18203A',
                      borderBottom: 0,
                      borderRadius: '26px 26px 0 0',
                    }}
                  />
                </>
              )}

              {calm && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: 69,
                      top: 90,
                      width: 22,
                      height: 12,
                      borderRadius: '0 0 12px 12px',
                      background: '#18203A',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 109,
                      top: 90,
                      width: 22,
                      height: 12,
                      borderRadius: '0 0 12px 12px',
                      background: '#18203A',
                    }}
                  />
                </>
              )}

              {/* Mejillas */}
              <div
                style={{
                  position: 'absolute',
                  left: 50,
                  top: 110,
                  width: 24,
                  height: 13,
                  borderRadius: '50%',
                  background: palette.blush,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 126,
                  top: 110,
                  width: 24,
                  height: 13,
                  borderRadius: '50%',
                  background: palette.blush,
                }}
              />

              {/* Boca */}
              {smile && (
                <div
                  style={{
                    position: 'absolute',
                    left: 88,
                    top: 106,
                    width: 24,
                    height: 13,
                    border: '4px solid #18203A',
                    borderTop: 0,
                    borderRadius: '0 0 14px 14px',
                  }}
                />
              )}
              {grin && (
                <div
                  style={{
                    position: 'absolute',
                    left: 85,
                    top: 105,
                    width: 30,
                    height: 20,
                    borderRadius: '4px 4px 16px 16px',
                    background: '#18203A',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 7,
                      top: 10,
                      width: 16,
                      height: 12,
                      borderRadius: '50%',
                      background: 'oklch(0.7 0.16 15)',
                    }}
                  />
                </div>
              )}
              {oMouth && (
                <div
                  style={{
                    position: 'absolute',
                    left: 94,
                    top: 109,
                    width: 12,
                    height: 12,
                    border: '4px solid #18203A',
                    borderRadius: '50%',
                  }}
                />
              )}
              {soft && (
                <div
                  style={{
                    position: 'absolute',
                    left: 91,
                    top: 109,
                    width: 18,
                    height: 9,
                    border: '3.5px solid #18203A',
                    borderTop: 0,
                    borderRadius: '0 0 10px 10px',
                  }}
                />
              )}
            </div>

            {armsUp && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: '52px 132px',
                    animation: anim.armLeftUp,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 20,
                      top: 122,
                      width: 32,
                      height: 17,
                      borderRadius: '50%',
                      transform: 'rotate(-40deg)',
                      background: palette.body,
                      border: palette.line,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: '148px 132px',
                    animation: anim.armRightUp,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 148,
                      top: 122,
                      width: 32,
                      height: 17,
                      borderRadius: '50%',
                      transform: 'rotate(40deg)',
                      background: palette.body,
                      border: palette.line,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
