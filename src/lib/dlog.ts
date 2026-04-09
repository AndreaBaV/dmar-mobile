const _entries: { t: number; h: string; msg: string; data?: unknown }[] = [];
const _listeners: Set<() => void> = new Set();

export function dlog(hypothesisId: string, message: string, data?: unknown) {
  const entry = { t: Date.now(), h: hypothesisId, msg: message, data };
  _entries.push(entry);
  console.log(`[DBG:e0d3cb][${hypothesisId}]`, message, data ?? '');
  _listeners.forEach((fn) => fn());
  // #region agent log
  fetch('http://127.0.0.1:7585/ingest/11f699b0-39ba-488a-9726-38fb92895a41',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e0d3cb'},body:JSON.stringify({sessionId:'e0d3cb',location:'dlog.ts',message,data,timestamp:Date.now(),hypothesisId})}).catch(()=>{});
  // #endregion
}

export function getLogEntries() {
  return _entries;
}

export function subscribeLog(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
