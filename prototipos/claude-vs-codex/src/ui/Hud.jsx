import { useEffect, useState } from 'react';
import { game } from '../game/engine.js';
import { PLAYER } from '../game/constants.js';

// The engine lives outside React, so the HUD samples it a few times per second.
export function useHud() {
  const [hud, setHud] = useState(() => game.hud());
  useEffect(() => {
    const id = setInterval(() => setHud(game.hud()), 80);
    return () => clearInterval(id);
  }, []);
  return hud;
}

export default function Hud({ hud }) {
  if (hud.status === 'menu') return null;
  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-top">
        <div className="bar-head">
          <b>codex</b>
          <span>fase {hud.phase} de 3</span>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${hud.boss * 100}%` }} />
          <i style={{ left: '33%' }} />
          <i style={{ left: '66%' }} />
        </div>
        <div className="log">
          {hud.log.map((line, i) => (
            <div key={`${line.at}-${i}`} className={line.who}>
              {line.who}&gt; {line.text}
            </div>
          ))}
        </div>
      </div>
      <div className="hud-bottom">
        <div className="hp">
          <span>claude</span>
          <div className="cells">
            {Array.from({ length: PLAYER.hp }, (_, i) => (
              <b key={i} className={i < hud.hp ? 'on' : ''} />
            ))}
          </div>
        </div>
        <div className="score">{String(hud.score).padStart(6, '0')}</div>
        <button
          type="button"
          tabIndex={-1}
          className="clear"
          disabled={hud.clears === 0}
          onPointerDown={(e) => {
            e.preventDefault();
            game.useClear();
          }}
        >
          /clear x{hud.clears}
        </button>
      </div>
    </div>
  );
}
