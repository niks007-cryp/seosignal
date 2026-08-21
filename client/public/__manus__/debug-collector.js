(() => {
  const endpoint = "/__manus__/logs";

  const report = (consoleLogs) => {
    const body = JSON.stringify({ consoleLogs, networkRequests: [], sessionEvents: [] });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // Diagnostics must not affect application behavior.
    }
  };

  window.addEventListener(
    "error",
    (event) => {
      const resource = event.target instanceof HTMLElement ? event.target : null;
      const message = resource
        ? `Resource failed to load: ${resource.tagName.toLowerCase()} ${resource.getAttribute("src") || resource.getAttribute("href") || ""}`
        : event.message || "Uncaught browser error";

      report([
        {
          level: "error",
          message,
          source: event.filename || resource?.baseURI || window.location.href,
          line: event.lineno || null,
          column: event.colno || null,
          stack: event.error?.stack || null,
        },
      ]);
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report([
      {
        level: "error",
        message: reason instanceof Error ? reason.message : String(reason),
        source: window.location.href,
        stack: reason instanceof Error ? reason.stack || null : null,
      },
    ]);
  });
})();
