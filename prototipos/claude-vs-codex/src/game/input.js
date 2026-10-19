import { game, input } from './engine.js';
import { toggleMute } from './audio.js';

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

export function bindKeyboard(onStart) {
  const down = new Set();
  const held = (codes) => codes.some((c) => down.has(c));

  const sync = () => {
    input.x = Number(held(KEYS.right)) - Number(held(KEYS.left));
    input.z = Number(held(KEYS.down)) - Number(held(KEYS.up));
    // Keyboard takes over from the pointer until the pointer moves again.
    if (input.x || input.z) {
      input.targetX = null;
      input.targetZ = null;
    }
  };

  const onKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) game.useClear();
    } else if (e.code === 'Enter') {
      e.preventDefault();
      if (game.status !== 'playing') onStart();
    } else if (e.code === 'KeyP') {
      game.togglePause();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (e.code.startsWith('Arrow')) {
      e.preventDefault();
    }
    down.add(e.code);
    sync();
  };
  const onKeyUp = (e) => {
    down.delete(e.code);
    sync();
  };
  const onBlur = () => {
    down.clear();
    sync();
  };
  const onVisibility = () => {
    if (document.hidden) game.pause();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
