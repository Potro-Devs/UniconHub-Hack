import { useCallback, useEffect, useRef, useState } from 'react';

/** Mejor voz disponible para español de México (si no hay, cualquier voz en español). */
export function pickSpanishVoice(voices) {
  const list = voices ?? [];
  return list.find((v) => /^es[-_]MX/i.test(v.lang))
    ?? list.find((v) => /^es[-_](US|419)/i.test(v.lang))
    ?? list.find((v) => /^es\b/i.test(v.lang))
    ?? null;
}

/** Texto legible en voz alta: fracciones "3/4" → "3 de 4", símbolos que suenan raro. */
export function speakableText(text) {
  return String(text ?? '')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 de $2')
    .replace(/×/g, ' por ')
    .replace(/÷/g, ' entre ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lectura en voz alta con la voz del navegador (Web Speech API). Todo ocurre en el dispositivo:
 * solo se lee el texto del ejercicio, nunca datos del alumno. Si el navegador no la soporta,
 * `supported` es `false` y la interfaz oculta las bocinas.
 */
export function useSpeech() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const supported = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');
  const [speakingId, setSpeakingId] = useState(null);
  const voiceRef = useRef(null);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => { voiceRef.current = pickSpanishVoice(synth.getVoices()); };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      synth.cancel();
    };
  }, [supported, synth]);

  const stop = useCallback(() => {
    if (!supported) return;
    synth.cancel();
    setSpeakingId(null);
  }, [supported, synth]);

  /** Lee `text`; `id` identifica qué botón está sonando. Tocar el mismo botón lo detiene. */
  const speak = useCallback((text, id = 'default') => {
    if (!supported || !text) return;
    if (speakingId === id) { stop(); return; }
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(speakableText(text));
    utterance.lang = voiceRef.current?.lang ?? 'es-MX';
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = 0.9; // un poco más lento para niñas y niños
    utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
    utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
    setSpeakingId(id);
    synth.speak(utterance);
  }, [supported, synth, speakingId, stop]);

  return { supported, speak, stop, speakingId };
}
