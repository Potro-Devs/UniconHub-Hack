/** Decorative previews show the same materials children manipulate in each game. */
export function GameArtwork({ code }) {
  return <div className={`game-art game-art-${code}`} aria-hidden="true">
    {code === 'fractions' ? <div className="game-preview-whole">{Array.from({ length: 4 }, (_, index) => <span className={index < 3 ? 'painted' : ''} key={index} />)}</div>
      : code === 'multiplication' ? <div className="game-preview-groups">{[0, 1, 2].map((group) => <span key={group}>{[0, 1, 2].map((dot) => <i key={dot} />)}</span>)}</div>
        : code === 'grammar_fix' ? <div className="game-preview-notebook"><span>Mi gato <s>dorme</s></span><span className="fix">duerme ✓</span></div>
        : code === 'mental_math' ? <div className="game-preview-cards"><span>40</span><span className="on">60</span><span>35</span></div>
        : code === 'symmetry' ? <div className="game-preview-symmetry">{[1, 0, 0, 1, 1, 1, 1, 1].map((on, index) => <span key={index} className={on ? 'painted' : ''} />)}</div>
        : <div className="game-preview-number"><span className="game-preview-hundred" /><span className="game-preview-ten" /><span className="game-preview-ten" /><span className="game-preview-unit" /><span className="game-preview-unit" /><span className="game-preview-unit" /></div>}
    <span className="game-art-spark">✦</span>
  </div>;
}
