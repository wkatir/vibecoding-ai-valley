// Canvas factory. In the browser it makes DOM canvases; tests can inject another one.
let factory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const setCanvasFactory = (fn) => {
  factory = fn;
};

export const makeCanvas = (w, h) => factory(w, h);
