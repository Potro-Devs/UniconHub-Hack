import { useEffect, useState } from 'react';

/**
 * Detecta ancho de ventana actual y si corresponde a diseño estrecho/móvil (< 760px).
 */
export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    width,
    narrow: width < 760,
    wide: width >= 760,
  };
}
