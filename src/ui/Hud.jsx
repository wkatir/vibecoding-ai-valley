import { FACTIONS } from '../game/constants.js';

const pad2 = (n) => String(n).padStart(2, '0');

function Tooltip({ info, icons }) {
  const owner = info.owner >= 0 ? FACTIONS[info.owner].name : 'Libre';
  return (
    <div className="tip panel notch" style={{ left: info.x + 16, top: info.y + 16 }}>
      <strong>{info.name}</strong>
      <span>
        {owner}, {info.level} {info.level === 1 ? 'casa' : 'casas'}
      </span>
      <span>Tropas {info.troops}</span>
    </div>
  );
}

export default function Hud({ snap, icons, muted, onPct, onUpgrade, onSpeed, onPause, onMute }) {
  const me = snap.player;
  const f = FACTIONS[me];
  const mine = snap.stats[me];
  const sel = snap.selected;
  const showHint = !sel && snap.time < 70;

  return (
    <div className="hud">
      <section className="panel notch player">
        <img className="emblem" src={icons[me]} alt="" />
        <div className="lines">
          <strong>{f.name}</strong>
          <span>
            Pueblos {mine.villages} de {snap.villageCount}
          </span>
          <span>Tropas {mine.troops}</span>
        </div>
      </section>

      <ul className="standings" aria-label="Pueblos por IA">
        {FACTIONS.map((fac) => {
          const st = snap.stats[fac.id];
          const out = !snap.alive[fac.id];
          return (
            <li key={fac.id} className={`chip panel notch${out ? ' out' : ''}${fac.id === me ? ' me' : ''}`} title={fac.name}>
              <img src={icons[fac.id]} alt={fac.name} />
              <b>{st.villages}</b>
            </li>
          );
        })}
      </ul>

      <div className="clock">
        <section className="panel notch time">
          <strong>Día {snap.day}</strong>
          <span>
            {pad2(snap.hour)}:{pad2(snap.minute)}
          </span>
        </section>
        <section className="panel notch speeds" role="group" aria-label="Velocidad">
          <button type="button" className="btn small notch" aria-pressed={snap.paused} onClick={onPause} title="Pausa (Espacio)">
            II
          </button>
          {[1, 2, 3].map((s) => (
            <button key={s} type="button" className="btn small notch" aria-pressed={!snap.paused && snap.speed === s} onClick={() => onSpeed(s)}>
              {s}x
            </button>
          ))}
          <button type="button" className="btn small notch" aria-pressed={muted} onClick={onMute} title="Sonido (M)">
            {muted ? 'Mudo' : 'Voz'}
          </button>
        </section>
      </div>

      {sel && sel.mine && (
        <section className="panel notch command" aria-label="Pueblo seleccionado">
          <div className="who">
            <img className="emblem" src={icons[sel.owner]} alt="" />
            <div className="lines">
              <strong>{sel.name}</strong>
              <span>
                {sel.level} de 3 casas, {sel.troops} de {sel.capacity} tropas
              </span>
            </div>
          </div>
          <div className="send">
            <span>Enviar</span>
            <div role="group" aria-label="Cantidad a enviar">
              {[0.25, 0.5, 1].map((p) => (
                <button key={p} type="button" className="btn small notch" aria-pressed={snap.sendPct === p} onClick={() => onPct(p)}>
                  {p * 100}%
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn notch build" disabled={!sel.canUpgrade} onClick={onUpgrade}>
            {sel.building ? 'Construyendo...' : sel.level >= 3 ? 'Pueblo completo' : `Construir casa (${sel.upgradeCost})`}
          </button>
        </section>
      )}

      {showHint && (
        <section className="panel notch hint">
          {sel ? 'Tocar otro pueblo para enviar tropas.' : 'Tocar un pueblo propio. Después tocar o arrastrar hacia otro pueblo.'}
        </section>
      )}

      <ul className="log" aria-live="polite">
        {snap.log.map((l, i) => (
          <li key={`${l.at}-${i}`} style={{ '--fc': FACTIONS[l.faction].art.roof }} className={l.mine ? 'mine' : ''}>
            {l.text}
          </li>
        ))}
      </ul>

      {snap.hover && <Tooltip info={snap.hover} icons={icons} />}
    </div>
  );
}
