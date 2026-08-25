import type { DevFault } from "./fault-store";

export const SLOW_REQUEST_MS = 2_000;

export function safeRoute(input: string, base = "http://localhost") {
  try {
    const url = new URL(input, base);
    const queryKeys = [...new Set(url.searchParams.keys())];
    return `${url.pathname}${queryKeys.length ? `?${queryKeys.map((key) => `${encodeURIComponent(key)}=REDACTED`).join("&")}` : ""}`;
  } catch {
    return "[unparseable route]";
  }
}

export function faultPacket(fault: DevFault, recentFaults: DevFault[]) {
  return {
    instruction: "Investigate this development fault. Determine the likely root cause, files to inspect, smallest safe fix, and regression test required.",
    fault: {
      severity: fault.severity,
      source: fault.source,
      title: fault.title,
      message: fault.message,
      file: fault.file,
      line: fault.line,
      requestId: fault.requestId,
      timestamp: new Date(fault.timestamp).toISOString(),
      metadata: fault.metadata,
      stackTrace: fault.stack,
    },
    recentEvents: recentFaults.slice(0, 10).map((item) => ({
      timestamp: new Date(item.timestamp).toISOString(),
      severity: item.severity,
      source: item.source,
      title: item.title,
      message: item.message,
      requestId: item.requestId,
    })),
    privacy: "Request and response bodies, cookies, authorization headers, and query values are intentionally excluded.",
  };
}

