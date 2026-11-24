import { useEffect, useState } from 'react';

/**
 * Escucha la preferencia del sistema prefers-reduced-motion.
 */
export function useReducedMotion() {
  const read = () => {
    try { if (sessionStorage.getItem('axi-motion-paused') === 'true') return true; } catch { /* Optional storage. */ }
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  const [reduced, setReduced] = useState(read);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(read());
    mq?.addEventListener('change', onChange);
    window.addEventListener('axi-motion-change', onChange);
    onChange();
    return () => { mq?.removeEventListener('change', onChange); window.removeEventListener('axi-motion-change', onChange); };
  }, []);

  return reduced;
}
