import { installDevSentinel } from "@/devtools/instrumentation";

try {
  installDevSentinel();
} catch (error) {
  // Development instrumentation must never prevent the application hydrating.
  console.error("Dev Sentinel failed to initialize", error);
}

