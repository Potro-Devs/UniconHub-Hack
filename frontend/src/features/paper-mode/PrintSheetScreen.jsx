import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { FRACTION_SHEET } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { CartaPreviewFrame } from './CartaPreviewFrame';

const HATCH = 'repeating-linear-gradient(45deg,#000 0 2px,#fff 2px 6px)';

/**
 * Pantalla 06: Vista previa de hoja de diagnóstico imprimible Carta B/N.
 */
export function PrintSheetScreen() {
  const navigate = useNavigate();
  const { say } = useAppUi();
  const { session } = useSession();
  const canCapture = session?.role === 'teacher';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Tabs Hoja / Tarjeta de pistas */}
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
            background: '#fff',
            color: COLORS.ink,
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
            background: 'transparent',
            color: COLORS.muted,
          }}
        >
          Tarjeta de pistas
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
            Hoja de diagnóstico
          </h1>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
            Fracciones · prueba 1 · Carta · blanco y negro, lista para fotocopiar
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={() => say('Se enviarían 45 hojas a la impresora (Carta, B/N).')}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              borderRadius: '12px',
              padding: '11px 14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Imprimir 45 hojas
          </button>
          {canCapture && (
            <button
              type="button"
              onClick={() => navigate('/docente/captura')}
              style={{
                border: 0,
                background: COLORS.primary,
                color: '#fff',
                borderRadius: '12px',
                padding: '11px 14px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ya la apliqué: capturar →
            </button>
          )}
        </div>
      </div>

      <CartaPreviewFrame>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '2px solid #000',
            paddingBottom: '12px',
          }}
        >
          <Mascot size={56} color="linea" />
          <div style={{ flex: 1 }}>
            <div className="font-display" style={{ fontWeight: 800, fontSize: '22px', lineHeight: 1 }}>
              {APP_NAME} · Diagnóstico de matemáticas
            </div>
            <div style={{ fontSize: '13px', marginTop: '3px' }}>Fracciones · prueba 1 · 3.º A</div>
          </div>
          <div style={{ fontSize: '12px', textAlign: 'right' }}>
            Folio ____________
            <br />
            (lo llena el docente)
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px', fontSize: '14px' }}>
          <div>Nombre: ______________________________________</div>
          <div>Fecha: ______________</div>
        </div>

        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.4,
            padding: '10px 14px',
            border: '1.5px dashed #000',
            borderRadius: '10px',
          }}
        >
          Rellena el círculo de tu respuesta. Piensa con calma: no hay tiempo límite. Si te atoras, pide la tarjeta de pistas.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 22px', flex: 1 }}>
          {FRACTION_SHEET.map((q, j) => (
            <div
              key={q.q}
              style={{
                border: '1.5px solid #000',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', fontSize: '14px', lineHeight: 1.3 }}>
                <b style={{ fontSize: '15px' }}>{j + 1}.</b>
                <span>{q.q}</span>
              </div>

              {q.bar && (
                <div
                  style={{
                    display: 'flex',
                    height: '22px',
                    border: '1.5px solid #000',
                    marginLeft: '20px',
                    width: '200px',
                  }}
                >
                  {Array.from({ length: q.bar[0] }, (_, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        borderLeft: idx ? '1.5px solid #000' : '0',
                        background: idx < q.bar[1] ? HATCH : '#fff',
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginLeft: '20px' }}>
                {q.o.map((opt, m) => (
                  <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '1.5px solid #000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {'ABCD'[m]}
                    </span>
                    {opt}
                  </div>
                ))}
              </div>
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
          <span>Saberes y pensamiento científico · Estudio de los números: fracciones</span>
          <span>Hoja 1 de 1</span>
        </div>
      </CartaPreviewFrame>
    </div>
  );
}
