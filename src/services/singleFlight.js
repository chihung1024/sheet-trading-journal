export function createSingleFlight(task) {
  if (typeof task !== 'function') {
    throw new TypeError('single-flight task must be a function');
  }

  let inFlight = null;

  return (...args) => {
    if (inFlight) return inFlight;

    const run = Promise.resolve().then(() => task(...args));
    inFlight = run.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
