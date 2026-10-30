/** Bounded, native motion. CSS owns durations; no animation runtime or frame-time React updates. */
export function motionMs(element: Element, token: string, fallback: number) {
  const raw = getComputedStyle(element).getPropertyValue(token).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value * (raw.endsWith('ms') ? 1 : 1000) : fallback;
}
export function animateMotion(element: Element, frames: Keyframe[], duration: number, easing = 'cubic-bezier(0.215, 0.61, 0.355, 1)') {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !element.animate) return null;
  const animation = element.animate(frames, {duration, easing});
  const reduce = () => { if (preference.matches) animation.cancel(); };
  preference.addEventListener('change', reduce);
  const cleanup = () => preference.removeEventListener('change', reduce);
  void animation.finished.then(cleanup, cleanup);
  return animation;
}
export function springFrames({x = 0, y = 0, scaleX = 1, scaleY = 1}: {x?: number; y?: number; scaleX?: number; scaleY?: number}): Keyframe[] {
  // Damped spring, mass 1 / stiffness 600 / damping 40. Pre-sample once, not on every frame.
  const displacement = (t: number) => Math.exp(-20*t) * (Math.cos(Math.sqrt(200)*t) + Math.sqrt(2)*Math.sin(Math.sqrt(200)*t));
  const end = 1-displacement(.3);
  return Array.from({length:31},(_,i)=>{
    const remaining = i === 30 ? 0 : 1-(1-displacement(i/100))/end;
    return {offset:i/30, transform:`translate(${x*remaining}px, ${y*remaining}px) scale(${1+(scaleX-1)*remaining}, ${1+(scaleY-1)*remaining})`};
  });
}
