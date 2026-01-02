"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Palette,
  RotateCcw,
  Cpu,
  Database,
  HardDrive,
  Wifi,
  Sparkles,
  ScanLine,
  Zap,
  Shield,
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  RefreshCw,
  Upload,
  Check,
  Copy,
  ExternalLink,
  Archive,
  FolderOpen,
  Save,
  Loader2,
} from "lucide-react";
import { ThemeImportDialog } from "@/components/theme-import-dialog";
import { exportThemeToCSS } from "@/lib/theme-parser";

interface Session {
  id: number;
  user_id: number;
  created_at: string;
  expires_at: string;
  ip_address: string;
  user_agent: string;
}

interface BackupSettings {
  default_path: string;
  external_drive_path: string;
  auto_backup_enabled: boolean;
  max_backups_per_container: number;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Backup settings state
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    default_path: "",
    external_drive_path: "",
    auto_backup_enabled: true,
    max_backups_per_container: 3,
  });
  const [isLoadingBackup, setIsLoadingBackup] = useState(false);
  const [isSavingBackup, setIsSavingBackup] = useState(false);
  const [backupSaveSuccess, setBackupSaveSuccess] = useState(false);
  const {
    settings,
    updateTraySettings,
    updateThemeSettings,
    resetSettings,
    customThemes,
    removeCustomTheme,
    applyCustomTheme,
  } = useSettings();

  const fetchSessions = async () => {
    if (!token) return;
    setIsLoadingSessions(true);
    try {
      const response = await fetch("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data || []);
        // Try to identify current session (most recent one from same IP might be current)
        const meResponse = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meResponse.ok) {
          const meData = await meResponse.json();
          setCurrentSessionId(meData.session?.id || null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const revokeSession = async (sessionId: number) => {
    if (!token || !confirm("Are you sure you want to revoke this session?")) return;
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        alert("Failed to revoke session");
      }
    } catch {
      alert("Failed to revoke session");
    }
  };

  // Fetch backup settings
  const fetchBackupSettings = async () => {
    if (!token) return;
    setIsLoadingBackup(true);
    try {
      const response = await fetch("/api/backups/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBackupSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch backup settings:", err);
    } finally {
      setIsLoadingBackup(false);
    }
  };

  // Save backup settings
  const saveBackupSettings = async () => {
    if (!token) return;
    setIsSavingBackup(true);
    setBackupSaveSuccess(false);
    try {
      const response = await fetch("/api/backups/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(backupSettings),
      });
      if (response.ok) {
        const data = await response.json();
        setBackupSettings(data);
        setBackupSaveSuccess(true);
        setTimeout(() => setBackupSaveSuccess(false), 3000);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save backup settings");
      }
    } catch (err) {
      console.error("Failed to save backup settings:", err);
      alert("Failed to save backup settings");
    } finally {
      setIsSavingBackup(false);
    }
  };

  const parseUserAgent = (ua: string) => {
    if (!ua) return { device: "Unknown", browser: "Unknown" };
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const browser = ua.match(/(chrome|firefox|safari|edge|opera)/i)?.[1] || "Unknown";
    return {
      device: isMobile ? "Mobile" : "Desktop",
      browser: browser.charAt(0).toUpperCase() + browser.slice(1).toLowerCase(),
    };
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchSessions();
      fetchBackupSettings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-accent animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const accentColors = [
    { id: "cyan", label: "Cyan", class: "bg-cyan-500" },
    { id: "amber", label: "Amber", class: "bg-amber-500" },
    { id: "green", label: "Green", class: "bg-green-500" },
    { id: "purple", label: "Purple", class: "bg-purple-500" },
    { id: "red", label: "Red", class: "bg-red-500" },
  ] as const;

  return (
    <DashboardLayout title="SETTINGS" time={time}>
      <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Customize your Podmangr experience
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetSettings}
              className="gap-2 border-border/60 hover:border-destructive/50 hover:text-destructive"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </div>

          <Tabs defaultValue="tray" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-card/70 border border-border/50">
              <TabsTrigger value="tray" className="gap-2 data-[state=active]:bg-accent/20">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Tray</span>
              </TabsTrigger>
              <TabsTrigger value="theme" className="gap-2 data-[state=active]:bg-accent/20">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Theme</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="gap-2 data-[state=active]:bg-accent/20">
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Backup</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-accent/20">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            </TabsList>

            {/* System Tray Settings */}
            <TabsContent value="tray" className="mt-6 space-y-4">
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-accent" />
                    System Tray Indicators
                  </CardTitle>
                  <CardDescription>
                    Choose which system metrics to display in the taskbar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-5 h-5 text-chart-3" />
                      <div>
                        <Label htmlFor="show-cpu" className="font-medium">CPU Usage</Label>
                        <p className="text-xs text-muted-foreground">Show processor utilization</p>
                      </div>
                    </div>
                    <Switch
                      id="show-cpu"
                      checked={settings.tray.showCpu}
                      onCheckedChange={(checked) => updateTraySettings({ showCpu: checked })}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-chart-4" />
                      <div>
                        <Label htmlFor="show-memory" className="font-medium">Memory Usage</Label>
                        <p className="text-xs text-muted-foreground">Show RAM utilization</p>
                      </div>
                    </div>
                    <Switch
                      id="show-memory"
                      checked={settings.tray.showMemory}
                      onCheckedChange={(checked) => updateTraySettings({ showMemory: checked })}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-chart-5" />
                      <div>
                        <Label htmlFor="show-disk" className="font-medium">Disk Usage</Label>
                        <p className="text-xs text-muted-foreground">Show storage utilization</p>
                      </div>
                    </div>
                    <Switch
                      id="show-disk"
                      checked={settings.tray.showDisk}
                      onCheckedChange={(checked) => updateTraySettings({ showDisk: checked })}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wifi className="w-5 h-5 text-primary" />
                      <div>
                        <Label htmlFor="show-network" className="font-medium">Network Status</Label>
                        <p className="text-xs text-muted-foreground">Show connection indicator</p>
                      </div>
                    </div>
                    <Switch
                      id="show-network"
                      checked={settings.tray.showNetwork}
                      onCheckedChange={(checked) => updateTraySettings({ showNetwork: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent" />
                    Refresh Rate
                  </CardTitle>
                  <CardDescription>
                    How often to update system metrics (in seconds)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Update every</span>
                      <span className="font-mono text-accent">{settings.tray.refreshInterval}s</span>
                    </div>
                    <Slider
                      value={[settings.tray.refreshInterval]}
                      onValueChange={([value]) => updateTraySettings({ refreshInterval: value })}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1s (Fast)</span>
                      <span>10s (Slow)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Theme Settings */}
            <TabsContent value="theme" className="mt-6 space-y-4">
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-accent" />
                    Accent Color
                  </CardTitle>
                  <CardDescription>
                    Choose the primary accent color for the interface (coming soon)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {accentColors.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateThemeSettings({ accentColor: color.id })}
                        className={`
                          relative w-12 h-12 rounded-lg transition-all duration-200
                          ${settings.theme.accentColor === color.id
                            ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                            : "hover:scale-105"
                          }
                        `}
                        title={color.label}
                      >
                        <div className={`w-full h-full rounded-lg ${color.class}`} />
                        {settings.theme.accentColor === color.id && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Select an accent color to customize the interface theme
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Visual Effects
                  </CardTitle>
                  <CardDescription>
                    Toggle visual effects and animations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ScanLine className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="scanlines" className="font-medium">CRT Scanlines</Label>
                        <p className="text-xs text-muted-foreground">Retro scanline overlay effect</p>
                      </div>
                    </div>
                    <Switch
                      id="scanlines"
                      checked={settings.theme.enableScanlines}
                      onCheckedChange={(checked) => updateThemeSettings({ enableScanlines: checked })}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="glow" className="font-medium">Glow Effects</Label>
                        <p className="text-xs text-muted-foreground">Neon glow on active elements</p>
                      </div>
                    </div>
                    <Switch
                      id="glow"
                      checked={settings.theme.enableGlow}
                      onCheckedChange={(checked) => updateThemeSettings({ enableGlow: checked })}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="animations" className="font-medium">Animations</Label>
                        <p className="text-xs text-muted-foreground">Enable UI animations and transitions</p>
                      </div>
                    </div>
                    <Switch
                      id="animations"
                      checked={settings.theme.enableAnimations}
                      onCheckedChange={(checked) => updateThemeSettings({ enableAnimations: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Custom Themes Card */}
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-accent" />
                        Custom Themes
                      </CardTitle>
                      <CardDescription>
                        Import themes from{" "}
                        <a
                          href="https://tweakcn.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline inline-flex items-center gap-1"
                        >
                          tweakcn.com
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </CardDescription>
                    </div>
                    <ThemeImportDialog>
                      <Button variant="outline" size="sm" className="gap-2 border-border/60">
                        <Upload className="w-4 h-4" />
                        Import
                      </Button>
                    </ThemeImportDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Default Theme Option */}
                  <button
                    onClick={() => applyCustomTheme(null)}
                    className={`
                      w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
                      ${!settings.theme.activeCustomThemeId
                        ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(112,187,179,0.2)]"
                        : "border-border/60 hover:border-accent/50 hover:bg-accent/5"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                          <Palette className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">Default Theme</p>
                          <p className="text-xs text-muted-foreground">
                            Podmangr built-in theme
                          </p>
                        </div>
                      </div>
                      {!settings.theme.activeCustomThemeId && (
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                          <Check className="w-4 h-4 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Custom Themes List */}
                  {customThemes.map((theme) => {
                    const isActive = settings.theme.activeCustomThemeId === theme.id;
                    const previewBg = theme.lightVariables.background || theme.darkVariables.background;
                    const previewPrimary = theme.lightVariables.primary || theme.darkVariables.primary;
                    const previewAccent = theme.lightVariables.accent || theme.darkVariables.accent;

                    return (
                      <div
                        key={theme.id}
                        className={`
                          p-4 rounded-lg border-2 transition-all duration-200
                          ${isActive
                            ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(112,187,179,0.2)]"
                            : "border-border/60 hover:border-accent/50"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <button
                            onClick={() => applyCustomTheme(theme.id)}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            {/* Theme Preview Swatches */}
                            <div className="flex -space-x-1">
                              <div
                                className="w-6 h-6 rounded-full border-2 border-card"
                                style={{ backgroundColor: previewBg || "#1a1a2e" }}
                              />
                              <div
                                className="w-6 h-6 rounded-full border-2 border-card"
                                style={{ backgroundColor: previewPrimary || "#4f46e5" }}
                              />
                              <div
                                className="w-6 h-6 rounded-full border-2 border-card"
                                style={{ backgroundColor: previewAccent || "#06b6d4" }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{theme.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(theme.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {isActive && (
                              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-accent-foreground" />
                              </div>
                            )}
                          </button>

                          {/* Theme Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const css = exportThemeToCSS(theme);
                                navigator.clipboard.writeText(css);
                              }}
                              title="Copy CSS"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete "${theme.name}"?`)) {
                                  removeCustomTheme(theme.id);
                                }
                              }}
                              title="Delete theme"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {customThemes.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Palette className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No custom themes yet</p>
                      <p className="text-xs mt-1">
                        Import a theme from tweakcn.com to get started
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Backup Settings */}
            <TabsContent value="backup" className="mt-6 space-y-4">
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Archive className="w-5 h-5 text-accent" />
                        Backup Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure where container backups are stored
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveBackupSettings}
                      disabled={isSavingBackup}
                      className={`gap-2 ${backupSaveSuccess ? "border-green-500 text-green-500" : ""}`}
                    >
                      {isSavingBackup ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : backupSaveSuccess ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {backupSaveSuccess ? "Saved" : "Save"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingBackup ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Default Backup Path */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
                          <Label htmlFor="default-path">Default Backup Path</Label>
                        </div>
                        <Input
                          id="default-path"
                          placeholder="~/.podmangr/backups"
                          value={backupSettings.default_path}
                          onChange={(e) =>
                            setBackupSettings({ ...backupSettings, default_path: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Location where container backups will be stored by default
                        </p>
                      </div>

                      <Separator className="bg-border/50" />

                      {/* External Drive Path */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-muted-foreground" />
                          <Label htmlFor="external-path">External Drive Path (Optional)</Label>
                        </div>
                        <Input
                          id="external-path"
                          placeholder="/mnt/backup-drive or /media/external"
                          value={backupSettings.external_drive_path}
                          onChange={(e) =>
                            setBackupSettings({ ...backupSettings, external_drive_path: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Map backups to an external drive for larger datasets. Leave empty to use the default path.
                        </p>
                      </div>

                      <Separator className="bg-border/50" />

                      {/* Auto Backup */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Archive className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <Label htmlFor="auto-backup" className="font-medium">Auto-Backup Before Updates</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically create a backup when updating containers
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="auto-backup"
                          checked={backupSettings.auto_backup_enabled}
                          onCheckedChange={(checked) =>
                            setBackupSettings({ ...backupSettings, auto_backup_enabled: checked })
                          }
                        />
                      </div>

                      <Separator className="bg-border/50" />

                      {/* Max Backups */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Max backups per container</span>
                          <span className="font-mono text-accent">
                            {backupSettings.max_backups_per_container === 0
                              ? "Unlimited"
                              : backupSettings.max_backups_per_container}
                          </span>
                        </div>
                        <Slider
                          value={[backupSettings.max_backups_per_container]}
                          onValueChange={([value]) =>
                            setBackupSettings({ ...backupSettings, max_backups_per_container: value })
                          }
                          min={0}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0 (Unlimited)</span>
                          <span>10</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Older backups will be automatically deleted when this limit is reached
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Backup Info Card */}
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-accent" />
                    Backup Information
                  </CardTitle>
                  <CardDescription>
                    How backups work in Podmangr
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 text-sm">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
                      <Archive className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Pre-Update Backups</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Backups are created automatically before container updates, preserving your bind mount data.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
                      <RotateCcw className="w-5 h-5 text-cyan-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Easy Rollback</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Restore any backup with one click from the container&apos;s Update tab.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
                      <HardDrive className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">External Storage</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Map to an external drive for larger datasets. Perfect for homelab setups.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="mt-6 space-y-4">
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-accent" />
                        Active Sessions
                      </CardTitle>
                      <CardDescription>
                        Manage your active login sessions across devices
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchSessions}
                      disabled={isLoadingSessions}
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingSessions ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingSessions ? (
                    <div className="flex items-center justify-center py-8">
                      <Activity className="w-6 h-6 text-accent animate-pulse" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No active sessions found</p>
                    </div>
                  ) : (
                    sessions.map((session) => {
                      const { device, browser } = parseUserAgent(session.user_agent);
                      const isCurrentSession = session.id === currentSessionId;
                      const expiresAt = new Date(session.expires_at);
                      const createdAt = new Date(session.created_at);

                      return (
                        <div
                          key={session.id}
                          className={`
                            p-4 rounded-lg border transition-colors
                            ${isCurrentSession
                              ? "border-accent/50 bg-accent/5"
                              : "border-border/50 bg-background/40 hover:bg-background/60"
                            }
                          `}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`
                                p-2 rounded-lg
                                ${isCurrentSession ? "bg-accent/20 text-accent" : "bg-muted/50 text-muted-foreground"}
                              `}>
                                {device === "Mobile" ? (
                                  <Smartphone className="w-5 h-5" />
                                ) : (
                                  <Laptop className="w-5 h-5" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{browser} on {device}</span>
                                  {isCurrentSession && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {session.ip_address || "Unknown IP"}
                                  </span>
                                  <span>•</span>
                                  <span>Created {createdAt.toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Expires: {expiresAt.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {!isCurrentSession && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeSession(session.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" />
                    Session Security
                  </CardTitle>
                  <CardDescription>
                    Information about your session security settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 text-sm">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30">
                      <span className="text-muted-foreground">Session timeout</span>
                      <span className="font-mono text-accent">24 hours</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30">
                      <span className="text-muted-foreground">Token rotation</span>
                      <span className="text-green-500">Enabled</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30">
                      <span className="text-muted-foreground">IP binding</span>
                      <span className="text-yellow-500">Recommended</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sessions automatically expire after 24 hours of inactivity.
                    You can revoke sessions from other devices at any time.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
