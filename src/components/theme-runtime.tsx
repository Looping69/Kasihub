"use client";

// Author: Klaasvaakie ( |╲ )
import { useEffect } from "react";
import type { AppTheme } from "@/lib/theme";
import { applyTheme } from "@/lib/theme";

export function ThemeRuntime() {
  useEffect(() => {
    let active = true;
    void fetch("/api/theme", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.theme) applyTheme(data.theme as AppTheme); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}
