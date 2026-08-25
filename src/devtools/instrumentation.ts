import { reportFault } from "./fault-store";
import { safeRoute, SLOW_REQUEST_MS } from "./sentinel-core";

declare global {
  interface Window { __kasiDevSentinelInstalled?: boolean }
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "An unhandled non-Error value was thrown";
}

export function installDevSentinel() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined" || window.__kasiDevSentinelInstalled) return;
  window.__kasiDevSentinelInstalled = true;

  window.addEventListener("error", (event) => {
    reportFault({
      severity: "error",
      source: "frontend",
      title: "Unhandled browser error",
      message: event.message || "Unknown browser error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      file: event.filename || undefined,
      line: event.lineno || undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportFault({
      severity: "error",
      source: "frontend",
      title: "Unhandled promise rejection",
      message: errorMessage(event.reason),
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    const rawUrl = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let parsed: URL;
    try { parsed = new URL(rawUrl, window.location.href); } catch { return originalFetch(input, init); }

    // Third-party requests may contain provider tokens or signed URLs. Their SDKs
    // own their telemetry; Sentinel only observes KaSiHub's same-origin boundary.
    if (parsed.origin !== window.location.origin) return originalFetch(input, init);

    const route = safeRoute(parsed.href, window.location.href);
    try {
      const response = await originalFetch(input, init);
      const durationMs = Math.round(performance.now() - startedAt);
      const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-correlation-id") ?? undefined;
      if (!response.ok) {
        reportFault({
          severity: response.status >= 500 ? "error" : "warning",
          source: "api",
          title: `API ${response.status} ${response.statusText || "failure"}`,
          message: `${method} ${route}`,
          requestId,
          metadata: { method, route, status: response.status, durationMs },
        });
      } else if (durationMs >= SLOW_REQUEST_MS) {
        reportFault({
          severity: "warning",
          source: "network",
          title: "Slow API request",
          message: `${method} ${route} took ${durationMs}ms`,
          requestId,
          metadata: { method, route, status: response.status, durationMs, thresholdMs: SLOW_REQUEST_MS },
        });
      }
      return response;
    } catch (reason) {
      reportFault({
        severity: "error",
        source: "network",
        title: "Network request failed",
        message: `${method} ${route}: ${errorMessage(reason)}`,
        stack: reason instanceof Error ? reason.stack : undefined,
        metadata: { method, route, durationMs: Math.round(performance.now() - startedAt) },
      });
      throw reason;
    }
  };
}

