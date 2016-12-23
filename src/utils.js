export function clamp(value, min, max) {
  return Math.max(min,Math.min(max, value));
}

export function getApproxSize(renderedSize, renderedNumber, totalNumber) {
  return renderedSize + (totalNumber - renderedNumber) * (renderedSize / renderedNumber);
}

export function eventTarget(se) {
  const d = document;
  return se === d.body || se === d.documentElement || !(se instanceof HTMLElement) ? window : se;
}
