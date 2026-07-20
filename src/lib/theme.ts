// Author: Klaasvaakie ( |╲ )
export type AppTheme = {
  name: string; primary: string; accent: string; background: string; surface: string;
  text: string; mutedText: string; border: string; sidebar: string; sidebarText: string;
  radius: number; fontScale: number; shadow: "none" | "soft" | "medium" | "strong";
  pageBackground: "solid" | "soft" | "grid";
};

export const DEFAULT_THEME: AppTheme = {
  name: "KaSiHUB Classic", primary: "#0569BD", accent: "#F58220", background: "#FFFFFF",
  surface: "#FFFFFF", text: "#17233C", mutedText: "#64748B", border: "#DDE6EE",
  sidebar: "#0569BD", sidebarText: "#FFFFFF", radius: 12, fontScale: 1,
  shadow: "soft", pageBackground: "soft",
};

export function applyTheme(theme: AppTheme, target: HTMLElement = document.documentElement) {
  const values: Record<string, string> = {
    "--primary": theme.primary, "--ring": theme.primary, "--sidebar": theme.sidebar,
    "--sidebar-foreground": theme.sidebarText, "--sidebar-primary": theme.accent,
    "--sidebar-ring": theme.accent, "--accent": theme.accent, "--background": theme.background,
    "--card": theme.surface, "--popover": theme.surface, "--foreground": theme.text,
    "--card-foreground": theme.text, "--popover-foreground": theme.text,
    "--muted-foreground": theme.mutedText, "--border": theme.border, "--input": theme.border,
    "--radius": `${theme.radius}px`, "--font-scale": String(theme.fontScale),
    "--role-page": theme.pageBackground === "solid" ? theme.background : theme.pageBackground === "grid" ? theme.background : `${theme.background}`,
    "--theme-shadow": theme.shadow === "none" ? "none" : theme.shadow === "soft" ? "0 8px 24px rgb(15 23 42 / .06)" : theme.shadow === "medium" ? "0 12px 32px rgb(15 23 42 / .12)" : "0 18px 44px rgb(15 23 42 / .2)",
  };
  Object.entries(values).forEach(([key, value]) => target.style.setProperty(key, value));
  target.dataset.pageBackground = theme.pageBackground;
}
