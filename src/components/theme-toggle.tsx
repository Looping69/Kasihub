"use client";

// Author: Klaasvaakie ( |╲ )
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Author: Klaasvaakie ( |╲ )
  // Keep the server snapshot stable without scheduling a mount-only state update.
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={resolvedTheme === "dark" ? "Use light mode" : "Use dark mode"}
      title={resolvedTheme === "dark" ? "Use light mode" : "Use dark mode"}
      disabled={!mounted}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={className}
    >
      {mounted && resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
