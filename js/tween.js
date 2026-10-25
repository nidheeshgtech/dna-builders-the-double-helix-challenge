// Tiny tween runner. Everything animated in the game goes through here so
// restarting can kill every running animation in one call.

export const ease = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  back: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  },
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

const running = new Set();

export function tween({ duration = 0.5, delay = 0, easing = ease.out, update, done, tag }) {
  let resolve;
  const promise = new Promise(r => (resolve = r));
  const tw = { t: -delay, duration, easing, update, done, resolve, tag, killed: false };
  running.add(tw);
  promise.tween = tw;
  return promise;
}

export function wait(seconds, tag) {
  return tween({ duration: seconds, easing: ease.linear, tag });
}

export function stepTweens(dt) {
  for (const tw of running) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const p = Math.min(tw.t / tw.duration, 1);
    tw.update && tw.update(tw.easing(p), p);
    if (p >= 1) {
      running.delete(tw);
      tw.done && tw.done();
      tw.resolve(true);
    }
  }
}

// Kill tweens. Their promises never resolve, so any async sequence waiting on
// them simply stops — which is exactly what we want on Restart.
export function killTweens(tag) {
  for (const tw of running) {
    if (tag === undefined || tw.tag === tag) running.delete(tw);
  }
}
