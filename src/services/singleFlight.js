export function createSingleFlight(task) {
  if (typeof task !== 'function') {
    throw new TypeError('single-flight task must be a function');
  }

  let inFlight = null;

  const run = (...args) => {
    if (inFlight) return inFlight;

    const taskPromise = Promise.resolve().then(() => task(...args));
    inFlight = taskPromise.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  run.afterCurrent = async (...args) => {
    const active = inFlight;
    if (active) {
      try {
        await active;
      } catch {
        // A failed older load must not prevent the required fresh generation.
      }
    }
    return run(...args);
  };

  run.isRunning = () => inFlight !== null;

  return run;
}
