/**
 * Partículas animadas compartidas para celebraciones de logro de Axi.
 */
export function CelebrationConfetti({ variant = 'nivel' }) {
  const isHito = variant === 'hito';
  const baseDelay = isHito ? 0.05 : 0;
  const dur = isHito ? '1.3s' : '1.2s';

  const pieces = [
    { anim: 'b0', delay: 0.35 + baseDelay, size: isHito ? 18 : 14, round: true, bg: isHito ? '#fff' : 'oklch(0.82 0.15 85)' },
    { anim: 'b1', delay: 0.4 + baseDelay, size: isHito ? 16 : 12, round: false, bg: isHito ? 'oklch(0.8 0.11 355)' : 'oklch(0.54 0.2 268)' },
    { anim: 'b2', delay: 0.35 + baseDelay, size: isHito ? 18 : 14, round: true, bg: isHito ? 'oklch(0.75 0.14 165)' : 'oklch(0.8 0.11 355)' },
    { anim: 'b3', delay: 0.45 + baseDelay, size: isHito ? 16 : 12, round: false, bg: isHito ? '#fff' : 'oklch(0.68 0.14 165)' },
    { anim: 'b4', delay: 0.4 + baseDelay, size: isHito ? 18 : 14, round: true, bg: isHito ? 'oklch(0.8 0.11 355)' : 'oklch(0.54 0.2 268)' },
    { anim: 'b5', delay: 0.35 + baseDelay, size: isHito ? 16 : 12, round: false, bg: isHito ? 'oklch(0.75 0.14 165)' : 'oklch(0.82 0.15 85)' },
    { anim: 'b6', delay: 0.45 + baseDelay, size: isHito ? 18 : 14, round: true, bg: isHito ? '#fff' : 'oklch(0.68 0.14 165)' },
    { anim: 'b7', delay: 0.4 + baseDelay, size: isHito ? 16 : 12, round: false, bg: 'oklch(0.8 0.11 355)' },
  ];

  return pieces.map((p, idx) => (
    <div
      key={idx}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: `${p.size}px`,
        height: `${p.size}px`,
        margin: `${-p.size / 2}px`,
        borderRadius: p.round ? '50%' : '0',
        background: p.bg,
        animation: `${p.anim} ${dur} ease-out ${p.delay}s both`,
      }}
    />
  ));
}
