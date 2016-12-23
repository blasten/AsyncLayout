export function forNextTick() {
  return Promise.resolve();
}

export function forIdleTime() {
  return new Promise(function(resolve) {
    const w = window;
    w.requestIdleCallback ? w.requestIdleCallback(resolve) :
        w.setTimeout(resolve.bind(null, {
          timeRemaining() {
            return 50;
          }
        }), 16);
  });
};

export function forBeforePaint() {
  return new Promise(function(resolve) {
    window.requestAnimationFrame(resolve);
  });
}
