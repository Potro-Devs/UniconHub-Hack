import { useEffect, useState } from 'react';

/**
 * Detecta ancho de ventana actual y el breakpoint móvil estándar de 768 px.
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
    narrow: width < 768,
    wide: width >= 768,
  };
}
