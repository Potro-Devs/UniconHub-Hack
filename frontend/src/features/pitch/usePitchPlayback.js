import { useCallback, useEffect, useRef, useState } from 'react';
import { clampTime } from './timeline';

/** One presentation clock: every visual derives from this position. No background catch-up. */
export function usePitchPlayback(duration) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const position = useRef(0);
  const seek = useCallback((value) => {
    position.current = clampTime(value, duration);
    setTime(position.current);
    if (position.current === duration) setPlaying(false);
  }, [duration]);
  const toggle = useCallback(() => {
    if (document.hidden) return;
    setHasPlayed(true);
    if (position.current >= duration) seek(0);
    setPlaying((value) => !value);
  }, [duration, seek]);
  const replay = useCallback(() => { seek(0); setHasPlayed(true); setPlaying(true); }, [seek]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let frame;
    let previous = performance.now();
    const tick = (now) => {
      const delta = Math.max(0, (now - previous) / 1000);
      previous = now;
      position.current = clampTime(position.current + delta, duration);
      setTime(position.current);
      if (position.current >= duration) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  return { time, playing, hasPlayed, seek, toggle, replay, pause: () => setPlaying(false) };
}
