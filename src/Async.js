import { GLOBAL } from './constants';

export function forNextTick() {
  return Promise.resolve();
}

export function forIdleTime() {
  return new Promise(function(resolve) {
    GLOBAL.requestIdleCallback
      ? GLOBAL.requestIdleCallback(resolve)
      : GLOBAL.setTimeout(
          resolve.bind(null, {
            timeRemaining() {
              return 50;
            }
          }),
          16
        );
  });
}

export function forBeforePaint() {
  return new Promise(function(resolve) {
    GLOBAL.requestAnimationFrame(resolve);
  });
}

export function forNextAnimationFrame() {
  return new Promise(function(resolve) {
    setTimeout(function() {
      GLOBAL.requestAnimationFrame(resolve);
    });
  });
}
