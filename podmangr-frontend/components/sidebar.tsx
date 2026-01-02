"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ContextSwitcher } from "@/components/context-switcher";
import {
  Box,
  Layers,
  Image,
  HardDrive,
  Network,
  Terminal,
  Settings,
  Activity,
  ListChecks,
  Cog,
  Users,
  FileCode2,
  Database,
  ArrowRightLeft,
  Server,
  ChevronDown,
  ChevronRight,
  Wrench,
  Key,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

// Core Podman items - always visible
const podmanItems: NavItem[] = [
  { name: "Containers", href: "/container-manager", icon: Box },
  { name: "Images", href: "/images", icon: Image },
  { name: "Pods", href: "/pods", icon: Layers },
  { name: "Volumes", href: "/volumes", icon: HardDrive },
  { name: "Networks", href: "/podman-networks", icon: Network },
  { name: "Stacks", href: "/stacks", icon: Layers },
  { name: "Templates", href: "/templates", icon: FileCode2 },
];

// Tools
const toolItems: NavItem[] = [
  { name: "Translate", href: "/translate", icon: ArrowRightLeft },
  { name: "Databases", href: "/databases", icon: Database },
  { name: "Secrets", href: "/secrets", icon: Key },
  { name: "Terminal", href: "/terminal", icon: Terminal },
];

// Server management items - collapsible
const serverItems: NavItem[] = [
  { name: "System Monitor", href: "/system-monitor", icon: Activity },
  { name: "Processes", href: "/process-manager", icon: ListChecks },
  { name: "Services", href: "/service-manager", icon: Cog },
  { name: "Storage", href: "/storage-manager", icon: HardDrive },
  { name: "Users", href: "/user-manager", icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [serverExpanded, setServerExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  const isAdmin = user?.role === "admin";

  // Check if any server item is active to auto-expand
  const isServerItemActive = serverItems.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  const isToolItemActive = toolItems.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  // Auto-expand if an item in the group is active
  const showServerItems = serverExpanded || isServerItemActive;
  const showToolItems = toolsExpanded || isToolItemActive;

  const filteredServerItems = serverItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

    return (
      <Link key={item.href} href={item.href} scroll={false}>
        <div
          className={`group flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-150 ${
            isActive
              ? "bg-accent/15 border border-accent/30"
              : "hover:bg-accent/10 border border-transparent"
          }`}
        >
          <Icon
            className={`w-4 h-4 transition-colors flex-shrink-0 ${
              isActive ? "text-accent" : "text-muted-foreground group-hover:text-accent"
            }`}
          />
          <span
            className={`text-sm transition-colors ${
              isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"
            }`}
          >
            {item.name}
          </span>
        </div>
      </Link>
    );
  };

  const renderGroupHeader = (
    name: string,
    Icon: React.ElementType,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    hasActiveItem: boolean
  ) => (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-150 hover:bg-accent/10 ${
        hasActiveItem ? "text-accent" : "text-muted-foreground"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
        {name}
      </span>
      {expanded ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronRight className="w-3 h-3" />
      )}
    </button>
  );

  return (
    <div className="fixed left-0 top-0 h-full w-56 bg-card/95 backdrop-blur-md border-r border-border/50 shadow-lg flex flex-col z-40">
      {/* Header */}
      <div className="h-14 border-b border-border/50 flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 bg-accent/20 rounded-md flex items-center justify-center">
              <Box className="w-4 h-4 text-accent" />
            </div>
          </div>
          <span className="text-sm font-semibold tracking-wide text-foreground">
            Podmangr
          </span>
        </div>
      </div>

      {/* User info */}
      <div className="px-3 py-3 border-b border-border/50 bg-background/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-accent/20 border border-accent/40 flex items-center justify-center">
            <span className="text-accent font-semibold text-sm">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {user?.username || "Guest"}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {user?.role || "viewer"}
            </div>
          </div>
        </div>
        {/* Podman Context Switcher */}
        <div className="mt-2">
          <ContextSwitcher />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Podman Section - Core items, always visible */}
        <div className="space-y-0.5">
          {podmanItems.map(renderNavItem)}
        </div>

        {/* Divider */}
        <div className="my-2 border-t border-border/30" />

        {/* Tools Section - Collapsible */}
        <div className="space-y-0.5">
          {renderGroupHeader("Tools", Wrench, showToolItems, setToolsExpanded, isToolItemActive)}
          {showToolItems && (
            <div className="ml-2 space-y-0.5">
              {toolItems.map(renderNavItem)}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-2 border-t border-border/30" />

        {/* Server Section - Collapsible */}
        <div className="space-y-0.5">
          {renderGroupHeader("Server", Server, showServerItems, setServerExpanded, isServerItemActive)}
          {showServerItems && (
            <div className="ml-2 space-y-0.5">
              {filteredServerItems.map(renderNavItem)}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-2 border-t border-border/30" />

        {/* Settings - Always visible at bottom of nav */}
        {renderNavItem({ name: "Settings", href: "/settings", icon: Settings })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 bg-background/40">
        <p className="text-xs text-muted-foreground/60 text-center">
          Podmangr v0.1.0
        </p>
      </div>
    </div>
  );
}
