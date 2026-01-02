"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { SystemActionsMenu } from "@/components/system-actions-menu";
import { SystemTray } from "@/components/system-tray";
import { Sidebar } from "@/components/sidebar";
import { useSettings } from "@/lib/settings-context";
import { useAuth } from "@/lib/auth-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  time?: string;
  actions?: React.ReactNode;
}

export function DashboardLayout({ children, title, time, actions }: DashboardLayoutProps) {
  const { settings } = useSettings();
  const { token } = useAuth();

  // Helper to add auth token to API file URLs
  const getAuthenticatedImageUrl = (url: string): string => {
    if (!url || !token) return url;
    // Only add token to our API file endpoints
    if (url.startsWith("/api/files/")) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}token=${encodeURIComponent(token)}`;
    }
    return url;
  };

  // Compute background style based on settings
  const getBackgroundStyle = (): React.CSSProperties => {
    switch (settings.desktop.backgroundType) {
      case "color":
        return { backgroundColor: settings.desktop.backgroundColor };
      case "gradient":
        return { background: settings.desktop.backgroundGradient };
      case "image":
        return settings.desktop.backgroundImage
          ? {
              backgroundImage: `url(${getAuthenticatedImageUrl(settings.desktop.backgroundImage)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {};
      default:
        return {};
    }
  };

  const backgroundStyle = getBackgroundStyle();
  const hasCustomBackground = settings.desktop.backgroundType !== "default";

  return (
    <div
      className={`min-h-screen relative overflow-hidden flex ${!hasCustomBackground ? "bg-background" : ""}`}
      style={hasCustomBackground ? backgroundStyle : undefined}
    >

      {/* Permanent Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 ml-56 flex flex-col">
        {/* Top bar */}
        <header className="relative z-30 h-16 bg-card/60 backdrop-blur-md flex items-center justify-between px-6 shadow-lg border-b border-border/50">
          <div className="flex items-center gap-4">
            {title && (
              <span className="text-lg font-medium text-foreground">
                {title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {actions}
            {actions && <div className="h-6 w-px bg-border/50" />}
            <SystemTray />
            {time && (
              <>
                <div className="h-4 w-px bg-border/50" />
                <span className="text-xs font-mono text-accent px-3 py-1 rounded bg-gray-800 dark:bg-transparent">
                  {time}
                </span>
              </>
            )}
            <div className="h-6 w-px bg-border/50" />
            <ThemeToggle />
            <SystemActionsMenu />
          </div>
        </header>

        {/* Main content */}
        <main className="relative z-10 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
