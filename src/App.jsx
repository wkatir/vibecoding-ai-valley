import { useCallback, useEffect, useRef, useState } from 'react';
import { Session } from './game/session.js';
import { initAudio, isMuted, sfx, startMusic, toggleMute } from './game/audio.js';
import { FACTIONS } from './game/constants.js';
import Hud from './ui/Hud.jsx';
import Screens from './ui/Screens.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [screen, setScreen] = useState('title'); // title | help | play
  const [config, setConfig] = useState({ player: 0, difficulty: 'normal' });
  const [icons, setIcons] = useState(null);
  const [muted, setMuted] = useState(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    const session = new Session(canvasRef.current);
    sessionRef.current = session;
    window.__aiValley = session; // handy for debugging in the console
    setIcons(FACTIONS.map((f) => session.art.emblem(f.id, 4).toDataURL()));
    session.newWorld({ player: -1 });

    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      session.frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const poll = setInterval(() => {
      const s = session.snapshot();
      if (s && s.mode === 'attract' && s.status === 'over') session.newWorld({ player: -1 });
      setSnap(s);
    }, 100);

    const onResize = () => {
      session.resize();
      // A rotated phone needs a new valley that fits the new shape.
      const m = session.measure();
      const portrait = m.h > m.w * 1.05;
      if (session.mode === 'attract' && portrait !== session.portrait) session.newWorld({ player: -1 });
    };
    window.addEventListener('resize', onResize);
    const onHide = () => {
      if (document.hidden && session.mode === 'play' && session.world.status === 'playing') session.world.paused = true;
    };
    document.addEventListener('visibilitychange', onHide);

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const play = session.mode === 'play';
      switch (e.code) {
        case 'Space':
          if (play) {
            e.preventDefault();
            session.togglePause();
          }
          break;
        case 'Digit1':
        case 'KeyQ':
          if (play) session.setPct(0.25);
          break;
        case 'Digit2':
        case 'KeyW':
          if (play) session.setPct(0.5);
          break;
        case 'Digit3':
        case 'KeyE':
          if (play) session.setPct(1);
          break;
        case 'KeyU':
          if (play) session.upgradeSelected();
          break;
        case 'KeyF':
          if (play) session.setSpeed(session.world.speed >= 3 ? 1 : session.world.speed + 1);
          break;
        case 'Escape':
          session.deselect();
          if (screenRef.current === 'help') setScreen('title');
          break;
        case 'KeyM':
          setMuted(toggleMute());
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(poll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const startGame = useCallback((cfg) => {
    initAudio();
    startMusic();
    sessionRef.current.newWorld({ player: cfg.player, difficulty: cfg.difficulty });
    setScreen('play');
  }, []);

  const toTitle = useCallback(() => {
    sessionRef.current.newWorld({ player: -1 });
    setScreen('title');
  }, []);

  const session = sessionRef.current;
  const canvasHandlers = {
    onPointerDown: (e) => {
      initAudio();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      session?.pointerDown(e.nativeEvent);
    },
    onPointerMove: (e) => session?.pointerMove(e.nativeEvent),
    onPointerUp: () => session?.pointerUp(),
    onPointerCancel: () => session?.pointerUp(),
    onPointerLeave: () => session?.pointerLeave(),
  };

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="view" {...canvasHandlers} onContextMenu={(e) => e.preventDefault()} />
      {screen === 'play' && snap && snap.mode === 'play' && icons && (
        <Hud
          snap={snap}
          icons={icons}
          muted={muted}
          onPct={(p) => session.setPct(p)}
          onUpgrade={() => session.upgradeSelected()}
          onSpeed={(s) => session.setSpeed(s)}
          onPause={() => session.togglePause()}
          onMute={() => setMuted(toggleMute())}
        />
      )}
      <Screens
        screen={screen}
        snap={snap}
        icons={icons}
        config={config}
        setConfig={setConfig}
        onPlay={() => {
          sfx.click();
          startGame(config);
        }}
        onHelp={() => {
          sfx.click();
          setScreen('help');
        }}
        onBack={() => setScreen(session?.mode === 'play' ? 'play' : 'title')}
        onResume={() => session.togglePause()}
        onAgain={() => startGame(config)}
        onTitle={toTitle}
      />
    </div>
  );
}
