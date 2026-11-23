import { useState } from 'react';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import {
  MASCOT_PALETTES,
  SIZE_MAP,
  STATE_TO_MOOD,
  mascotConfig,
} from './mascot.config';

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
}) {
  const reducedMotion = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);

  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 120;
  const resolvedMood = mood || STATE_TO_MOOD[state] || 'feliz';
  const palette = MASCOT_PALETTES[color] || MASCOT_PALETTES.rosa;
  const shouldAnimate = Boolean(animated ?? animate) && !reducedMotion;

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
  const open = resolvedMood === 'feliz' || resolvedMood === 'pista';
  const happy = resolvedMood === 'celebra';
  const calm = resolvedMood === 'calma';
  const smile = resolvedMood === 'feliz';
  const grin = resolvedMood === 'celebra';
  const oMouth = resolvedMood === 'pista';
  const soft = resolvedMood === 'calma';
  const idea = resolvedMood === 'pista';
  const sparkles = resolvedMood === 'celebra';
  const armsUp = resolvedMood === 'celebra';
  const armsDown = !armsUp;
  const hlx = resolvedMood === 'pista' ? 11 : 4;
  const hly = resolvedMood === 'pista' ? 2 : 4;

  const bob = shouldAnimate ? 'axiBob 2.4s ease-in-out infinite' : 'none';
  const gl = shouldAnimate ? 'axiGillL 2.4s ease-in-out infinite' : 'none';
  const gr = shouldAnimate ? 'axiGillR 2.4s ease-in-out infinite' : 'none';
  const blink = shouldAnimate ? 'axiBlink 4.5s infinite' : 'none';

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
        <div style={{ position: 'absolute', inset: 0, animation: bob }}>
          {idea && (
            <>
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
            </>
          )}

          {sparkles && (
            <>
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
            </>
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
            </>
          )}

          {/* Branquias izquierdas */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 40,
              width: 62,
              height: 96,
              transformOrigin: '100% 50%',
              animation: gl,
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
              animation: gr,
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
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 69,
                  top: 80,
                  width: 22,
                  height: 25,
                  borderRadius: '50%',
                  background: '#18203A',
                  animation: blink,
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
                  animation: blink,
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
            </>
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

          {armsUp && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
