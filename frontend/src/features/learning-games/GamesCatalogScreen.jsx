import { useNavigate } from 'react-router-dom';
import { Mascot } from '@/features/mascot';
import { useAppUi } from '@/shared/state/AppUiContext';
import { errorMessageOf } from '@/shared/api/client';
import { useGamesResource } from './useGamesResource';
import { GameArtwork } from './GameArtwork';
import './games.css';

const gameVerbs = { fractions: 'Pinta y descubre', multiplication: 'Forma y reparte', place_value: 'Construye y explora' };

export function GamesCatalogScreen() {
  const navigate = useNavigate();
  const request = useGamesResource();
  const { axiColor } = useAppUi();
  return <div className="learning-games">
    <header className="games-hero"><div><span className="games-eyebrow">APRENDER CON LAS MANOS</span><h1>Juega y practica</h1><p>Pinta, reparte y construye. Aquí puedes probar tus ideas.</p><span className="games-practice-note">Práctica libre · no cambia tus resultados</span></div><div className="games-hero-mascot" aria-hidden="true"><Mascot size={132} color={axiColor} /></div></header>
    {request.status === 'loading' ? <p role="status" className="games-status">Preparando tus juegos…</p> : request.status === 'error' ? <div className="games-status games-error" role="alert"><p>{errorMessageOf(request.error)}</p><button className="game-button" type="button" onClick={request.retry}>Volver a intentar</button></div> : <>
      <div className="games-catalog-heading"><h2>Elige qué quieres explorar</h2><span>Para tu grupo de {request.data.grade}.º grado</span></div>
      <div className="games-catalog-grid">{request.data.games.map((game) => <article className={`game-catalog-card game-theme-${game.code}`} key={game.code}><GameArtwork code={game.code} /><div className="game-catalog-copy"><span className="games-eyebrow">{gameVerbs[game.code] || 'Explora y aprende'}</span><h3>{game.title}</h3><p>{game.description}</p><div className="game-catalog-meta"><span>3 retos</span><span>Con pistas</span><span>A tu ritmo</span></div><button className="game-button game-button-primary" type="button" onClick={() => navigate(`/alumno/juegos/${game.code}`)}>¡Quiero jugar!</button></div></article>)}</div>
      {!request.data.games.length && <div className="games-status">Aún no hay juegos disponibles para este grupo.</div>}
      <aside className="games-friendly-note"><span aria-hidden="true">✦</span><p><strong>Elige, prueba y vuelve a intentar.</strong> Puedes pedir una pista cuando lo necesites.</p></aside>
      <p className="games-content-note">Ejemplos de práctica por validar con docente. Los juegos no son una evaluación.</p>
    </>}
  </div>;
}
