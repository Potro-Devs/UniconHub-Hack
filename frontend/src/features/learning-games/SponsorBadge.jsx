/**
 * "Este juego lo hace posible …": patrocinio educativo discreto (demo, sin convenio real).
 * Sin enlaces y sin llamados a comprar. Si el servidor de la demo configuró una marca con logo
 * (`DEMO_SPONSORS_DIR`), se muestra el logo; si no, un emblema genérico.
 */
export function SponsorBadge({ sponsor, compact = false }) {
  if (!sponsor) return null;
  return <p className={`game-sponsor ${compact ? 'game-sponsor-compact' : ''}`}>
    {sponsor.logoUrl
      // El nombre ya está en el texto: el logo es decorativo para el lector de pantalla.
      ? <img className="game-sponsor-logo" src={sponsor.logoUrl} alt="" loading="lazy" decoding="async" />
      : <svg className="game-sponsor-emblem" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M16 8l2.2 4.8 5.2.6-3.9 3.5 1.1 5.1L16 19.4 11.4 22l1.1-5.1-3.9-3.5 5.2-.6z" fill="currentColor" />
      </svg>}
    <span>
      Este juego lo hace posible <strong>{sponsor.name}</strong>
      {sponsor.demo && <small>Demostración · sin convenio real{sponsor.category ? ` · ${sponsor.category}` : ''}</small>}
    </span>
  </p>;
}
