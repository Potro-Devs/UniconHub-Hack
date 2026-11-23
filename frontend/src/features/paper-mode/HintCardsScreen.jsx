import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { FRACTION_SHEET, SHEET_HINTS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';
import { CartaPreviewFrame } from './CartaPreviewFrame';

const HINT_TAGS = ['Orienta', 'Acerca un paso', 'Ejemplo parecido'];

/**
 * Pantalla 12: Tarjetas de pistas imprimibles Carta B/N para recortar.
 */
export function HintCardsScreen() {
  const navigate = useNavigate();
  const { say } = useAppUi();
  const [pistasPage, setPistasPage] = useState(0);

  const cards = FRACTION_SHEET.slice(pistasPage * 6, pistasPage * 6 + 6).map((q, jj) => {
    const j = pistasPage * 6 + jj;
    return {
      n: j + 1,
      q: q.q,
      hints: SHEET_HINTS[j].map((t, l) => ({
        l: l + 1,
        t,
        tag: HINT_TAGS[l],
      })),
    };
  });

  const pageTxt = `Hoja ${pistasPage + 1} de 2`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div
        style={{
          display: 'flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '12px',
          background: '#E6EBF3',
          alignSelf: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/docente/hoja')}
          style={{
            border: 0,
            borderRadius: '9px',
            padding: '8px 14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'transparent',
            color: COLORS.muted,
          }}
        >
          Hoja de diagnóstico
        </button>
        <button
          type="button"
          onClick={() => navigate('/docente/pistas')}
          style={{
            border: 0,
            borderRadius: '9px',
            padding: '8px 14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: '#fff',
            color: COLORS.ink,
          }}
        >
          Tarjeta de pistas
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
            Tarjetas de pistas
          </h1>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
            Fracciones · prueba 1 · 3 pistas por ejercicio · Carta B/N, para recortar
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '12px', background: '#E6EBF3' }}>
            {[0, 1].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPistasPage(p)}
                style={{
                  border: 0,
                  borderRadius: '9px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: pistasPage === p ? '#fff' : 'transparent',
                  color: pistasPage === p ? COLORS.ink : COLORS.muted,
                }}
              >
                Hoja {p + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => say('Se enviarían las tarjetas de pistas a la impresora (Carta, B/N).')}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Imprimir tarjetas
          </button>
        </div>
      </div>

      <CartaPreviewFrame padding="44px 48px" gap="16px">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '2px solid #000',
            paddingBottom: '12px',
          }}
        >
          <Mascot size={56} mood="pista" color="linea" />
          <div style={{ flex: 1 }}>
            <div className="font-display" style={{ fontWeight: 800, fontSize: '22px', lineHeight: 1 }}>
              Pistas de {APP_NAME}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              Lee una pista a la vez, empezando por la 1. Ninguna pista te da el resultado.
            </div>
          </div>
          <div style={{ fontSize: '12px', textAlign: 'right' }}>
            Fracciones · prueba 1
            <br />
            {pageTxt}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gridAutoRows: '1fr',
            gap: '14px',
            flex: 1,
          }}
        >
          {cards.map((c) => (
            <div
              key={c.n}
              style={{
                border: '2px dashed #000',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="font-display" style={{ fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>
                  Ejercicio {c.n}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.q}
                </span>
              </div>

              {c.hints.map((p) => (
                <div
                  key={p.l}
                  style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', lineHeight: 1.35 }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      flex: 'none',
                      borderRadius: '50%',
                      border: '2px solid #000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {p.l}
                  </span>
                  <span>
                    <b>{p.tag}.</b> {p.t}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            borderTop: '1px solid #000',
            paddingTop: '8px',
          }}
        >
          <span>Recorta por la línea punteada. Entrega la tarjeta solo si el alumno la pide.</span>
          <span>{pageTxt}</span>
        </div>
      </CartaPreviewFrame>
    </div>
  );
}
