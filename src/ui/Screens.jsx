import { DIFFICULTY, FACTIONS } from '../game/constants.js';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Title({ icons, config, setConfig, onPlay, onHelp }) {
  return (
    <div className="screen title">
      <div className="sign notch">
        <h1>AI Valley</h1>
        <p>Cada IA tiene su pueblo. Solo una se queda con el valle.</p>
      </div>
      <div className="panel notch menu">
        <h2>Elegir pueblo</h2>
        <ul className="factions">
          {FACTIONS.map((f) => (
            <li key={f.id}>
              <button type="button" className={config.player === f.id ? 'on' : ''} aria-pressed={config.player === f.id} onClick={() => setConfig({ ...config, player: f.id })}>
                {icons && <img src={icons[f.id]} alt="" />}
                <span className="name">
                  <b>{f.name}</b>
                  <small>{f.maker}</small>
                </span>
                <span className="trait">
                  <b>{f.trait}</b>
                  <small>{f.desc}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="diff">
          <span>Rivales</span>
          <div role="group" aria-label="Dificultad">
            {Object.entries(DIFFICULTY).map(([key, d]) => (
              <button key={key} type="button" className="btn small notch" aria-pressed={config.difficulty === key} onClick={() => setConfig({ ...config, difficulty: key })}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn big notch" onClick={onPlay}>
            Jugar
          </button>
          <button type="button" className="btn notch" onClick={onHelp}>
            Cómo jugar
          </button>
        </div>
      </div>
    </div>
  );
}

function Help({ onBack }) {
  return (
    <div className="screen">
      <div className="panel notch dialog">
        <h2>Cómo jugar</h2>
        <ol className="steps">
          <li>
            <b>Elegir.</b> Tocar uno de sus pueblos. Cada pueblo produce tropas solo.
          </li>
          <li>
            <b>Enviar.</b> Tocar otro pueblo, o arrastrar hasta él. Las tropas caminan por el camino y pelean al llegar.
          </li>
          <li>
            <b>Crecer.</b> Con la flecha verde se puede construir una casa: más tropas, más defensa.
          </li>
          <li>
            <b>Ganar.</b> Quitarles todos los pueblos a las otras IAs antes de perder el propio.
          </li>
        </ol>
        <p className="keys">Teclas: Q, W, E cambian la cantidad. U construye. Espacio pausa. F acelera. M silencia.</p>
        <button type="button" className="btn big notch" onClick={onBack}>
          Entendido
        </button>
      </div>
    </div>
  );
}

function Pause({ onResume }) {
  return (
    <div className="screen">
      <div className="panel notch dialog small">
        <h2>Pausa</h2>
        <button type="button" className="btn big notch" onClick={onResume}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function End({ snap, icons, onAgain, onTitle }) {
  const won = snap.status === 'won';
  const me = FACTIONS[snap.player];
  const ranking = FACTIONS.map((f) => ({ f, ...snap.stats[f.id] })).sort((a, b) => b.villages - a.villages || b.troops - a.troops);
  return (
    <div className="screen">
      <div className="panel notch dialog">
        <h2>{won ? `${me.name} se queda con el valle` : `${me.name} perdió su último pueblo`}</h2>
        <p className="lead">{won ? 'Todos los pueblos rivales cayeron.' : 'Las otras IAs se reparten el valle.'}</p>
        <dl className="stats">
          <dt>Duración</dt>
          <dd>{fmtTime(snap.time)}</dd>
          <dt>Días</dt>
          <dd>{snap.day}</dd>
        </dl>
        <ul className="rank">
          {ranking.map(({ f, villages }) => (
            <li key={f.id} className={f.id === snap.player ? 'me' : ''}>
              <img src={icons[f.id]} alt="" />
              <span>{f.name}</span>
              <b>{villages} {villages === 1 ? 'pueblo' : 'pueblos'}</b>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" className="btn big notch" onClick={onAgain}>
            Jugar de nuevo
          </button>
          <button type="button" className="btn notch" onClick={onTitle}>
            Cambiar de IA
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Screens({ screen, snap, icons, config, setConfig, onPlay, onHelp, onBack, onResume, onAgain, onTitle }) {
  if (screen === 'title') return <Title icons={icons} config={config} setConfig={setConfig} onPlay={onPlay} onHelp={onHelp} />;
  if (screen === 'help') return <Help onBack={onBack} />;
  if (screen === 'play' && snap && snap.mode === 'play') {
    if (snap.paused && snap.status === 'playing') return <Pause onResume={onResume} />;
    if (snap.status === 'won' || snap.status === 'lost') return <End snap={snap} icons={icons} onAgain={onAgain} onTitle={onTitle} />;
  }
  return null;
}
