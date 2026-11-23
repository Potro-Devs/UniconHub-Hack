import { useEffect, useRef, useState } from 'react';

/**
 * Escala una hoja tamaño Carta (816x1056 px) proporcionalmente al ancho disponible sin desbordamiento.
 */
export function CartaPreviewFrame({ children, padding = '48px 52px', gap = '18px' }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(816);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width;
      if (next && Math.abs(next - width) > 2) setWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const scale = Math.min(1, width / 816);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${Math.round(1056 * scale)}px`,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '816px',
          height: '1056px',
          flex: 'none',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          background: '#fff',
          boxShadow: '0 2px 14px rgba(24,32,58,.14)',
          padding,
          color: '#000',
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          gap,
        }}
      >
        {children}
      </div>
    </div>
  );
}
