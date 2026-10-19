import { game } from '../game/engine.js';

const pad = (n) => String(n).padStart(6, '0');
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Screens({ hud, onStart }) {
  if (hud.status === 'menu') {
    return (
      <div className="screen">
        <div className="panel">
          <h1>Claude vs Codex</h1>
          <p className="lede">Codex quiere refactorizar todo el repositorio. Solo una nave puede detenerlo.</p>
          <dl className="rows">
            <dt>Mover</dt>
            <dd>WASD, flechas o mouse. En el celular, arrastrar.</dd>
            <dt>Disparo</dt>
            <dd>Automático.</dd>
            <dt>/clear</dt>
            <dd>Espacio o botón. Borra todas las balas y daña al jefe.</dd>
            <dt>Pausa</dt>
            <dd>P. Sonido: M.</dd>
          </dl>
          <button type="button" className="btn" onClick={onStart}>
            Iniciar
          </button>
          {hud.best > 0 && <p className="note">Mejor puntaje {pad(hud.best)}</p>}
        </div>
      </div>
    );
  }

  if (hud.paused) {
    return (
      <div className="screen">
        <div className="panel">
          <h2>Pausa</h2>
          <button type="button" className="btn" onClick={() => game.togglePause()}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  if (hud.endVisible) {
    const won = hud.status === 'won';
    return (
      <div className="screen">
        <div className="panel">
          <h2>{won ? 'Día salvado.' : 'Codex ganó esta ronda.'}</h2>
          <dl className="rows">
            <dt>Tiempo</dt>
            <dd>{fmtTime(hud.time)}</dd>
            <dt>Puntos</dt>
            <dd>{pad(hud.score)}</dd>
            <dt>Golpes recibidos</dt>
            <dd>{hud.hits}</dd>
            {!won && (
              <>
                <dt>Vida de Codex</dt>
                <dd>{Math.round(hud.boss * 100)}%</dd>
              </>
            )}
          </dl>
          <button type="button" className="btn" onClick={onStart}>
            {won ? 'Jugar de nuevo' : 'Reintentar'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
