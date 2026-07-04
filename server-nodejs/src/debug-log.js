/** Logs debug session (NDJSON ingest) — ne pas logger de PII/secrets. */
export function debugLog(location, message, data = {}, hypothesisId = "") {
  // #region agent log
  fetch("http://127.0.0.1:7808/ingest/05265c3c-c3a2-4d90-9489-ec835e91f73e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e9d124" },
    body: JSON.stringify({
      sessionId: "e9d124",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}
