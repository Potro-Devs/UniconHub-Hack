import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mascot } from '@/features/mascot';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { errorMessageOf } from '@/shared/api/client';
import { gamesApi } from './games.api';
import { useGamesResource } from './useGamesResource';
import './games.css';

const placeLabels = { hundreds: 'Centenas', tens: 'Decenas', units: 'Unidades' };
const placeSingular = { hundreds: 'centena', tens: 'decena', units: 'unidad' };
const fractionColumns = (denominator) => Math.min(5, Math.ceil(Math.sqrt(denominator)));

function initialAnswer(code, material) {
  if (code === 'fractions') return Array(material.denominator).fill(false);
  if (code === 'multiplication') return Array(material.groups).fill(0);
  return Object.fromEntries(material.places.map((place) => [place, 0]));
}

function Counter({ value, increase, decrease, label, canIncrease, disabled }) {
  return <div className="game-counter"><button type="button" aria-label={`Quitar ${label}`} onClick={decrease} disabled={disabled || value === 0}>−</button><output aria-label={`Cantidad de ${label}`}>{value}</output><button type="button" aria-label={`Agregar ${label}`} onClick={increase} disabled={disabled || !canIncrease}>+</button></div>;
}

function FractionMaterial({ material, answer, setAnswer, disabled }) {
  const selected = answer.filter(Boolean).length;
  return <div className="game-fraction-material"><div className="game-target-fraction" aria-label={`Representa ${material.targetNumerator} de ${material.denominator} partes`}><span>{material.targetNumerator}</span><span>{material.denominator}</span></div><div className="game-equal-whole" role="group" aria-label={`Entero dividido en ${material.denominator} partes iguales`} style={{ gridTemplateColumns: `repeat(${fractionColumns(material.denominator)}, minmax(0, 1fr))` }}>{answer.map((painted, index) => <button key={index} type="button" aria-label={`Parte ${index + 1} de ${material.denominator}${painted ? ', pintada' : ', sin pintar'}`} aria-pressed={painted} disabled={disabled} onClick={() => setAnswer(answer.map((value, position) => position === index ? !value : value))}><span aria-hidden="true">{painted ? '✓' : '+'}</span><small>Parte {index + 1}</small></button>)}</div><p className="game-material-caption" aria-live="polite">{selected} de {material.denominator} partes pintadas · toca una parte para cambiarla</p></div>;
}

function GroupMaterial({ material, answer, setAnswer, disabled }) {
  const used = answer.reduce((total, value) => total + value, 0);
  const change = (group, delta) => setAnswer(answer.map((value, index) => index === group ? value + delta : value));
  return <div className="game-group-material"><div className="game-counter-bank"><span aria-hidden="true">●</span><div><strong>{material.totalCounters - used} objetos por repartir</strong><p>Agrega o quita objetos con los botones.</p></div></div><div className="game-group-grid">{answer.map((count, group) => <section className="game-basket" key={group} aria-label={`Grupo ${group + 1}`}><h3>Grupo {group + 1}</h3><div className="game-basket-objects" aria-hidden="true">{Array.from({ length: count }, (_, item) => <span key={item} />)}{count === 0 && <small>Aquí van los objetos</small>}</div><Counter value={count} label={`objeto al grupo ${group + 1}`} increase={() => change(group, 1)} decrease={() => change(group, -1)} disabled={disabled} canIncrease={used < material.totalCounters} /></section>)}</div><p className="game-material-caption" aria-live="polite">{used} de {material.totalCounters} objetos colocados</p></div>;
}

function PlaceMaterial({ material, answer, setAnswer, disabled }) {
  return <div className="game-place-material"><div className="game-number-target"><span>El número que vas a construir</span><strong>{material.targetNumber}</strong></div><div className="game-place-grid" style={{ gridTemplateColumns: `repeat(${material.places.length}, minmax(0, 1fr))` }}>{material.places.map((place) => <section className={`game-place-column game-place-${place}`} key={place} aria-labelledby={`place-${place}`}><h3 id={`place-${place}`}>{placeLabels[place]}</h3><div className="game-place-blocks" aria-hidden="true">{Array.from({ length: answer[place] }, (_, index) => <span key={index} />)}{answer[place] === 0 && <small>Sin fichas</small>}</div><Counter value={answer[place]} label={placeSingular[place]} increase={() => setAnswer({ ...answer, [place]: answer[place] + 1 })} decrease={() => setAnswer({ ...answer, [place]: answer[place] - 1 })} disabled={disabled} canIncrease={answer[place] < 9} /><span className="game-place-value">{place === 'hundreds' ? 'Cada ficha vale 100' : place === 'tens' ? 'Cada barra vale 10' : 'Cada pieza vale 1'}</span></section>)}</div><p className="game-material-caption">Construye con las fichas. Puedes cambiar tu idea antes de comprobar.</p></div>;
}

function RoundBoard({ game, round, index, total, axiColor, onNext }) {
  const [answer, setAnswer] = useState(() => initialAnswer(game.code, round.material));
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef(null);
  const heading = useRef(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => { heading.current?.focus(); return () => controller.current?.abort(); }, []);
  const change = (next) => { setAnswer(next); setFeedback(null); setError(null); };
  const check = async () => {
    if (pending || feedback?.correct) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setPending(true); setError(null);
    const payload = game.code === 'fractions' ? answer.filter(Boolean).length : answer;
    try {
      const result = await gamesApi.check(game.code, round.id, payload, { signal: request.signal });
      if (!request.signal.aborted) setFeedback(result);
    } catch (failure) { if (!request.signal.aborted) setError(errorMessageOf(failure)); }
    finally { if (!request.signal.aborted) setPending(false); }
  };
  const reset = () => { change(initialAnswer(game.code, round.material)); setHintLevel(0); };
  const locked = pending || feedback?.correct;
  return <section className={`game-board game-theme-${game.code}`} aria-busy={pending}>
    <div className="game-round-heading"><span className="games-eyebrow">RETO {index + 1} DE {total}</span><ol className="game-round-progress" aria-label="Tu recorrido">{Array.from({ length: total }, (_, position) => <li key={position} aria-current={position === index ? 'step' : undefined} className={position < index ? 'complete' : ''}><span aria-hidden="true">{position < index ? '✓' : position + 1}</span><span className="axi-sr-only">Reto {position + 1}{position < index ? ', completado' : position === index ? ', actual' : ', por explorar'}</span></li>)}</ol></div>
    <h2 tabIndex={-1} ref={heading}>{round.prompt}</h2><p className="game-instruction">{round.instruction}</p>
    <div className="game-manipulative">{game.code === 'fractions' ? <FractionMaterial material={round.material} answer={answer} setAnswer={change} disabled={locked} /> : game.code === 'multiplication' ? <GroupMaterial material={round.material} answer={answer} setAnswer={change} disabled={locked} /> : <PlaceMaterial material={round.material} answer={answer} setAnswer={change} disabled={locked} />}</div>
    <div className="game-help"><div className="game-help-controls"><button className="game-button game-button-help" type="button" disabled={pending || feedback?.correct || hintLevel >= round.hints.length} onClick={() => setHintLevel((value) => value + 1)}>{hintLevel >= round.hints.length ? `Ya viste las ${round.hints.length} pistas` : 'Pedir una pista'}<span>{Math.min(hintLevel, round.hints.length)}/{round.hints.length}</span></button><button type="button" className="game-text-button" disabled={pending || feedback?.correct} onClick={reset}>Reiniciar este reto</button></div>{hintLevel > 0 && <p className="game-hint" role="status"><strong>Pista {hintLevel}:</strong> {round.hints[hintLevel - 1]}</p>}</div>
    {feedback && <div role="status" className={`game-feedback ${feedback.correct ? 'game-feedback-correct' : ''}`}><Mascot size={62} color={axiColor} mood={feedback.correct ? 'acierto' : 'calma'} animated={!reducedMotion} /><div><strong>{feedback.feedback}</strong>{feedback.explanation && <p>{feedback.explanation}</p>}{!feedback.correct && hintLevel >= round.hints.length && <p>Puedes revisar la última pista o pedir ayuda a tu docente.</p>}</div></div>}
    {error && <p role="alert" className="game-error-message">{error}</p>}
    <div className="game-board-action">{feedback?.correct ? <button className="game-button game-button-primary" type="button" onClick={onNext}>{index + 1 === total ? 'Ver mi recorrido' : 'Siguiente reto'}</button> : <button className="game-button game-button-primary" type="button" disabled={pending} onClick={check}>{pending ? 'Revisando tu construcción…' : 'Comprobar mi idea'}</button>}<span>Sin prisa. Puedes probar y ajustar.</span></div>
  </section>;
}

function GameSession({ data, axiColor }) {
  const navigate = useNavigate();
  const [roundIndex, setRoundIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [skip, setSkip] = useState(false);
  const reducedMotion = useReducedMotion();
  const complete = roundIndex >= data.rounds.length;
  const animated = !reducedMotion && !skip;
  if (!data.rounds.length) return <div className="games-status"><p>Aún no hay retos disponibles para este juego.</p><button type="button" className="game-button" onClick={() => navigate('/alumno/juegos')}>Elegir otro juego</button></div>;
  return <>
    <div className="game-session-heading"><div><span className="games-eyebrow">JUEGA Y PRACTICA</span><h1>{data.game.title}</h1><p>Práctica para tu grupo de {data.grade}.º · no cambia tus resultados.</p></div><button type="button" className="game-button game-button-small" onClick={() => navigate('/alumno/juegos')}>Volver a juegos</button></div>
    {complete ? <section className={`game-complete ${animated ? 'game-complete-animated' : ''}`}><div className="game-complete-picture" aria-hidden="true"><span>✦</span><Mascot size={160} color={axiColor} mood="celebra" animated={animated} /><span>✧</span></div><h2>¡Exploraste {data.rounds.length} retos!</h2><p>Probaste tus ideas y seguiste aprendiendo. Puedes volver a jugar cuando quieras.</p>{animated && <button type="button" className="game-text-button" onClick={() => setSkip(true)}>Saltar animación</button>}<div className="game-complete-actions"><button type="button" className="game-button game-button-primary" onClick={() => navigate('/alumno/juegos')}>Elegir otro juego</button><button type="button" className="game-button" onClick={() => { setRoundIndex(0); setAttempt((value) => value + 1); setSkip(false); }}>Volver a explorar</button></div></section> : <RoundBoard key={`${attempt}-${data.rounds[roundIndex].id}`} game={data.game} round={data.rounds[roundIndex]} index={roundIndex} total={data.rounds.length} axiColor={axiColor} onNext={() => setRoundIndex((value) => value + 1)} />}
    <p className="games-content-note">Ejemplos de práctica por validar con docente. Los juegos no son una evaluación.</p>
  </>;
}

export function LearningGameScreen() {
  const params = useParams();
  const code = params.gameCode ?? params.code;
  const request = useGamesResource(code);
  const navigate = useNavigate();
  const { axiColor } = useAppUi();
  if (request.status === 'loading') return <p className="games-status" role="status">Preparando el material de tu juego…</p>;
  if (request.status === 'error') return <div className="learning-games games-status games-error" role="alert"><h1>No pudimos abrir este juego</h1><p>{errorMessageOf(request.error)}</p><div className="game-complete-actions"><button className="game-button" type="button" onClick={request.retry}>Volver a intentar</button><button className="game-button" type="button" onClick={() => navigate('/alumno/juegos')}>Elegir otro juego</button></div></div>;
  return <div className="learning-games"><GameSession key={code} data={request.data} axiColor={axiColor} /></div>;
}
