import { useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene, { FOV } from './scene/Scene.jsx';
import Hud, { useHud } from './ui/Hud.jsx';
import Screens from './ui/Screens.jsx';
import { game } from './game/engine.js';
import { bindKeyboard } from './game/input.js';
import { initAudio, sfx } from './game/audio.js';
import { COLORS } from './game/constants.js';

export default function App() {
  const hud = useHud();

  const start = useCallback(() => {
    initAudio();
    game.start();
  }, []);

  useEffect(() => bindKeyboard(start), [start]);
  useEffect(() => game.on((type) => sfx[type]?.()), []);

  return (
    <div className="stage">
      <Canvas flat dpr={[1, 2]} camera={{ fov: FOV, near: 0.1, far: 300 }}>
        <color attach="background" args={[COLORS.ground]} />
        <Scene />
      </Canvas>
      <Hud hud={hud} />
      <Screens hud={hud} onStart={start} />
    </div>
  );
}
