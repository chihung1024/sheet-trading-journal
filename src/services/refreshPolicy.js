export function shouldCompeteForMarketRefreshLeadership({
  enabled,
  paused,
  visible,
  marketHours,
  hasToken,
  tokenExpired,
}) {
  return Boolean(
    enabled
    && !paused
    && visible
    && marketHours
    && hasToken
    && !tokenExpired
  );
}

export function shouldScheduleMarketRefresh({
  enabled,
  paused,
  visible,
  marketHours,
  hasToken,
  tokenExpired,
  hasLeadership,
}) {
  return shouldCompeteForMarketRefreshLeadership({
    enabled,
    paused,
    visible,
    marketHours,
    hasToken,
    tokenExpired,
  }) && hasLeadership === true;
}

export function shouldTriggerMarketRefresh({
  enabled,
  paused,
  visible,
  marketHours,
  hasToken,
  tokenExpired,
  hasLeadership,
  busy,
  running,
}) {
  return shouldScheduleMarketRefresh({
    enabled,
    paused,
    visible,
    marketHours,
    hasToken,
    tokenExpired,
    hasLeadership,
  }) && !busy && !running;
}
