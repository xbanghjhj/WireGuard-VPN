export function calculateBandwidthSample(previous, liveData, now = Date.now()) {
  const totals = (liveData?.peers || []).reduce((sum, peer) => {
    const rx = Number(peer.rxBytes) || 0;
    const tx = Number(peer.txBytes) || 0;
    if (peer.enabled && (peer.online || rx > 0 || tx > 0)) {
      sum.rx += rx;
      sum.tx += tx;
    }
    return sum;
  }, { rx: 0, tx: 0 });

  const snapshot = { ...totals, time: now };
  if (!previous) return { rxSpeed: 0, txSpeed: 0, snapshot };
  const elapsedSeconds = (now - previous.time) / 1000;
  if (elapsedSeconds <= 0) return { rxSpeed: 0, txSpeed: 0, snapshot };
  return {
    rxSpeed: Math.max(0, (totals.rx - previous.rx) / elapsedSeconds),
    txSpeed: Math.max(0, (totals.tx - previous.tx) / elapsedSeconds),
    snapshot
  };
}
