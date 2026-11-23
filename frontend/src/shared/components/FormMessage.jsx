/**
 * Mensaje de error de formulario, anunciado a lectores de pantalla.
 * Tono neutro: explica qué pasó y qué hacer, sin términos punitivos.
 */
export function FormMessage({ message, id }) {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      style={{
        padding: '12px 14px',
        borderRadius: '14px',
        background: 'oklch(0.95 0.04 25)',
        color: 'oklch(0.4 0.13 25)',
        fontSize: '15px',
        lineHeight: 1.4,
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}
