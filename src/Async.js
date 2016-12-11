export function forIdleTime() {
  return new Promise(function(resolve) {
    let w = window;
    w.requestIdleCallback ? w.requestIdleCallback(resolve) : w.setTimeout(resolve, 16);
  });
};

export function forBeforePaint() {
  return new Promise(function(resolve) {
    window.requestAnimationFrame(resolve);
  });
}
