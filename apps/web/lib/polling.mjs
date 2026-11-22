/** One scheduled refresh; superseded responses and stopped controllers cannot update UI. */
export function startPolling({
  load,
  onValue,
  onError,
  shouldPoll = () => true,
  delayMs = 15000,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let stopped = false,
    generation = 0,
    timer;
  const refresh = async () => {
    cancel(timer);
    const current = ++generation;
    if (stopped) return;
    if (!shouldPoll()) {
      timer = schedule(refresh, delayMs);
      return;
    }
    try {
      const value = await load();
      if (!stopped && current === generation) onValue(value);
    } catch (error) {
      if (!stopped && current === generation) onError(error);
    } finally {
      if (!stopped && current === generation)
        timer = schedule(refresh, delayMs);
    }
  };
  void refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      generation++;
      cancel(timer);
    },
  };
}
