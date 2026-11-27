/** Saludo de presentación. Los resultados y el dominio se calculan en el servidor. */
export function pickFirstName(displayName, fallback = 'amiga o amigo') {
  const clean = String(displayName ?? '').trim();
  return clean ? clean.split(/\s+/)[0] : fallback;
}
