"use client";

import { useEffect } from "react";

type CobrowseSDK = {
  license: string;
  redactedViews: string[];
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
};

let sdkPromise: Promise<CobrowseSDK> | undefined;
let lifecycle = Promise.resolve();

function loadSDK() {
  if (!sdkPromise) {
    sdkPromise = new Promise<CobrowseSDK>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.cobrowse.io/CobrowseIO.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        const sdk = (window as Window & { CobrowseIO?: CobrowseSDK }).CobrowseIO;
        if (sdk) resolve(sdk);
        else reject(new Error("Cobrowse SDK unavailable"));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Cobrowse SDK failed to load"));
      };
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

/** Mounted only by the public shares routes, never by the app-wide layout. */
export function SharesCobrowse() {
  useEffect(() => {
    let cancelled = false;
    let activeSDK: CobrowseSDK | undefined;
    // Serialize route transitions and React Strict Mode cleanup with async start/stop.
    lifecycle = lifecycle.then(async () => {
      const sdk = await loadSDK();
      if (cancelled) return;
      activeSDK = sdk;
      sdk.license = "Ioykvhhus";
      sdk.redactedViews = ["input", "textarea", "select", "[contenteditable]", "[data-cobrowse-redacted]"];
      await sdk.start();
    }).catch(() => {
      console.warn("Shares support connection unavailable.");
    });

    return () => {
      cancelled = true;
      // Mask the departing document immediately while asynchronous shutdown finishes.
      if (activeSDK) activeSDK.redactedViews = ["body"];
      lifecycle = lifecycle.then(async () => {
        if (activeSDK) await activeSDK.stop();
      }).catch(() => {
        console.warn("Shares support connection could not shut down cleanly.");
      });
    };
  }, []);

  return null;
}
