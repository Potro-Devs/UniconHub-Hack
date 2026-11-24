import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { PROMO_GROUPS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 15 (Roadmap): Promoción masiva de grupos conservando el historial diagnóstico.
 */
export function PromoteGroupsScreen() {
  const navigate = useNavigate();
  const { promoSel, setPromoSel, promoted, setPromoted, say } = useAppUi();

  const selectedList = PROMO_GROUPS.filter((p) => promoSel[p.id]);
  const promoG = selectedList.length;
  const promoN = selectedList.reduce((acc, p) => acc + p.n, 0);

  return (
    <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
          Promover grupos
        </h1>
        <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
          Fin de ciclo 2026–2027. El diagnóstico y el historial pasan con cada alumno.
        </div>
      </div>

      {!promoted ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PROMO_GROUPS.map((p) => {
              const sel = !!promoSel[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPromoSel((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    border: `2px solid ${sel ? COLORS.primaryAccent : COLORS.border}`,
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      flex: 'none',
                      borderRadius: '8px',
                      border: `2px solid ${sel ? COLORS.primary : '#B9C2D4'}`,
                      background: sel ? COLORS.primary : '#fff',
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {sel ? '✓' : ''}
                  </span>
                  <span className="font-display" style={{ flex: 1, fontWeight: 700, fontSize: '20px', lineHeight: 1.2 }}>
                    {p.from} → {p.to}
                  </span>
                  <span style={{ fontSize: '14px', color: COLORS.muted }}>{p.n} alumnos</span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '14px',
              padding: '18px 20px',
              borderRadius: '20px',
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ flex: '1 1 240px', fontSize: '15px' }}>
              <b>
                {promoG} grupos · {promoN} alumnos
              </b>
              <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '2px' }}>
                Cada docente nuevo verá el perfil e historial desde el primer día.
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                promoG ? setPromoted(true) : say('Elige al menos un grupo.')
              }
              style={{
                height: '50px',
                padding: '0 22px',
                borderRadius: '14px',
                border: 0,
                background: COLORS.primary,
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Promover
            </button>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '20px',
            padding: '24px',
            borderRadius: '24px',
            background: 'oklch(0.95 0.05 165)',
            border: '1px solid oklch(0.85 0.08 165)',
          }}
        >
          <Mascot size={120} mood="celebra" />
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="font-display" style={{ fontWeight: 700, fontSize: '26px', lineHeight: 1.15 }}>
              Así se vería: {promoN} alumnos pasarían de grado
            </div>
            <div style={{ fontSize: '15px', lineHeight: 1.45 }}>
              El docente nuevo abriría el perfil y vería diagnóstico e historial. Vista de ejemplo: no se guardó ningún cambio.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => navigate('/docente/perfil/0')}
                style={{
                  border: 0,
                  background: COLORS.ink,
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver un perfil como docente de 4.º
              </button>
              <button
                type="button"
                onClick={() => setPromoted(false)}
                style={{
                  border: `1px solid ${COLORS.borderInput}`,
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
