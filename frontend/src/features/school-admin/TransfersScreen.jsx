import { COLORS } from '@/config/brand';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 16 (Roadmap): Vinculación de traslados entre escuelas por código o QR.
 */
export function TransfersScreen() {
  const { trCode, setTrCode, trFound, setTrFound, trDest, setTrDest, say } = useAppUi();

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <span
        style={{
          alignSelf: 'flex-start',
          padding: '5px 11px',
          borderRadius: '999px',
          background: 'oklch(0.94 0.08 90)',
          color: 'oklch(0.4 0.09 75)',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '.04em',
        }}
      >
        ROADMAP · DATOS DE EJEMPLO
      </span>

      <div>
        <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
          Traslados
        </h1>
        <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
          Vincula a un alumno que llega de otra escuela para recibir su historial.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div
          style={{
            flex: '1.3 1 300px',
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Con código de traslado</div>
          <div style={{ fontSize: '14px', color: COLORS.muted }}>
            Viene en la constancia que entrega la escuela de origen.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              value={trCode}
              onChange={(e) => setTrCode(e.target.value.toUpperCase())}
              placeholder="TR-4821-QX"
              style={{
                flex: '1 1 160px',
                height: '50px',
                borderRadius: '14px',
                border: `1px solid ${COLORS.borderInput}`,
                padding: '0 14px',
                fontSize: '17px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setTrFound(true)}
              style={{
                height: '50px',
                padding: '0 18px',
                borderRadius: '14px',
                border: 0,
                background: COLORS.ink,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Buscar
            </button>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 220px',
            background: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Con QR</div>
          <button
            type="button"
            onClick={() => setTrFound(true)}
            style={{
              flex: 1,
              minHeight: '120px',
              borderRadius: '14px',
              border: '1px dashed #B9C2D4',
              background: 'repeating-linear-gradient(45deg,#F3F6FB 0 8px,#FAFBFD 8px 16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '12px ui-monospace, Menlo, monospace',
              color: COLORS.muted,
              cursor: 'pointer',
            }}
          >
            cámara · escanear QR
          </button>
        </div>
      </div>

      {trFound && (
        <div
          style={{
            background: '#fff',
            border: `2px solid ${COLORS.primaryAccent}`,
            borderRadius: '22px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'baseline' }}>
            <div className="font-display" style={{ fontWeight: 700, fontSize: '22px', lineHeight: 1.2 }}>
              Alumno encontrado
            </div>
            <div style={{ fontSize: '14px', color: COLORS.muted }}>Folio {trCode || 'TR-4821-QX'}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px',
              fontSize: '14px',
            }}
          >
            <div>
              <div style={{ color: COLORS.muted }}>Viene de</div>
              <b>Esc. Prim. Emiliano Zapata</b>
            </div>
            <div>
              <div style={{ color: COLORS.muted }}>Grado</div>
              <b>3.º · ciclo 2026–2027</b>
            </div>
            <div>
              <div style={{ color: COLORS.muted }}>Historial</div>
              <b>2 ciclos · 5 aplicaciones</b>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: COLORS.muted }}>
            El nombre aparece cuando la escuela de origen confirma el traslado.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Grupo destino</span>
            <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '12px', background: '#E6EBF3' }}>
              {['3.º A', '3.º B'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTrDest(g)}
                  style={{
                    border: 0,
                    borderRadius: '9px',
                    padding: '8px 14px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: trDest === g ? '#fff' : 'transparent',
                    color: trDest === g ? COLORS.ink : COLORS.muted,
                  }}
                >
                  {g}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setTrFound(false);
                setTrCode('');
                say(`Alumno vinculado a ${trDest}. Su historial ya está disponible para su docente.`);
              }}
              style={{
                marginLeft: 'auto',
                height: '48px',
                padding: '0 20px',
                borderRadius: '14px',
                border: 0,
                background: COLORS.primary,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Vincular a {trDest}
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '22px',
          padding: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Mover alumno entre grupos</div>
          <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '2px' }}>
            Dentro de esta escuela. Su historial se mueve con él.
          </div>
        </div>
        <button
          type="button"
          onClick={() => say('Elegir alumno y grupo destino: siguiente iteración.')}
          style={{
            height: '46px',
            padding: '0 16px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.borderInput}`,
            background: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Elegir alumno
        </button>
      </div>
    </div>
  );
}
