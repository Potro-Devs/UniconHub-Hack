import { useEffect, useState } from 'react';

/** Session-only preference, shared by every screen and all CSS animations. */
export function MotionToggle() {
  const [paused, setPaused] = useState(() => {
    try { return sessionStorage.getItem('axi-motion-paused') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('axi-motion-off', paused);
    try { sessionStorage.setItem('axi-motion-paused', String(paused)); } catch { /* Optional storage. */ }
    window.dispatchEvent(new Event('axi-motion-change'));
  }, [paused]);
  return <button type="button" className="motion-toggle" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
    <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span> {paused ? 'Activar animaciones' : 'Saltar animaciones'}
  </button>;
}
