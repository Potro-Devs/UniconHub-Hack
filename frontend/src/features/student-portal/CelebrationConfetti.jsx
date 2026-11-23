/**
 * Partículas animadas compartidas para celebraciones de logro de Axi.
 */
export function CelebrationConfetti({ variant = 'nivel' }) {
  if (variant === 'cuestionario') {
    const confettiPieces = [
      { tx: '-74px', ty: '-64px', rot: '140deg', delay: '0.25s', w: 11, h: 11, radius: 3, bg: '#34D399' },
      { tx: '76px', ty: '-68px', rot: '-120deg', delay: '0.3s', w: 12, h: 12, radius: '50%', bg: '#F472B6' },
      {
        tx: '-82px',
        ty: '22px',
        rot: '90deg',
        delay: '0.35s',
        w: 14,
        h: 13,
        radius: 0,
        bg: '#60A5FA',
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
      },
      { tx: '84px', ty: '18px', rot: '-95deg', delay: '0.32s', w: 12, h: 7, radius: 4, bg: '#FBBF24' },
      { tx: '0px', ty: '-92px', rot: '180deg', delay: '0.22s', w: 11, h: 11, radius: '50%', bg: '#FFFFFF' },
    ];

    return confettiPieces.map((p, idx) => (
      <div
        key={idx}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${p.w}px`,
          height: `${p.h}px`,
          marginLeft: `${-p.w / 2}px`,
          marginTop: `${-p.h / 2}px`,
          borderRadius: p.radius,
          background: p.bg,
          clipPath: p.clipPath,
          opacity: 0,
          pointerEvents: 'none',
          '--tx': p.tx,
          '--ty': p.ty,
          '--rot': p.rot,
          animation: `axiConfettiPop 1.6s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay} forwards`,
        }}
      />
    ));
  }

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
        pointerEvents: 'none',
        animation: `${p.anim} ${dur} ease-out ${p.delay}s both`,
      }}
    />
  ));
}
