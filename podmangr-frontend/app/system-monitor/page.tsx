"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Cpu, MemoryStick, HardDrive, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SystemResources {
  cpu: {
    usage_percent: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    cached: number;
    buffers: number;
  };
  swap: {
    total: number;
    used: number;
    free: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  load_avg: number[];
}

interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  architecture: string;
  uptime: number;
}

export default function SystemMonitorPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const fetchSystemData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [resourcesRes, infoRes] = await Promise.all([
        fetch("/api/system/resources", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/system/info", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resourcesRes.ok && infoRes.ok) {
        setResources(await resourcesRes.json());
        setInfo(await infoRes.json());
        setError(null);
      } else {
        setError("Failed to load system information");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetchSystemData();
      const interval = setInterval(fetchSystemData, 3000);
      return () => clearInterval(interval);
    }
  }, [token, fetchSystemData]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="System Monitor">
      <div className="p-6 space-y-6">
        {/* System Info */}
        {info && (
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  System Information
                </CardTitle>
                <Button onClick={fetchSystemData} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Hostname</div>
                  <div className="font-medium">{info.hostname}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">OS</div>
                  <div className="font-medium">{info.os}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Kernel</div>
                  <div className="font-medium">{info.kernel}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                  <div className="font-medium">{formatUptime(info.uptime)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="text-destructive text-sm">{error}</div>
        )}

        {/* Resource Usage */}
        {resources && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU */}
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-accent" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Overall</span>
                    <span className="text-sm font-mono">{resources.cpu?.usage_percent?.toFixed(1) ?? 'N/A'}%</span>
                  </div>
                  <Progress value={resources.cpu?.usage_percent ?? 0} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Cores: {resources.cpu?.cores ?? 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Load Average: {Array.isArray(resources.load_avg) ? resources.load_avg.map(l => l?.toFixed(2) ?? '0.00').join(", ") : 'N/A'}
                </div>
              </CardContent>
            </Card>

            {/* Memory */}
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-accent" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const memPercent = resources.memory?.total ? (resources.memory.used / resources.memory.total) * 100 : 0;
                  const swapPercent = resources.swap?.total ? (resources.swap.used / resources.swap.total) * 100 : 0;
                  return (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">RAM</span>
                          <span className="text-sm font-mono">{memPercent.toFixed(1)}%</span>
                        </div>
                        <Progress value={memPercent} />
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatBytes(resources.memory?.used ?? 0)} / {formatBytes(resources.memory?.total ?? 0)}
                        </div>
                      </div>
                      {resources.swap?.total > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Swap</span>
                            <span className="text-sm font-mono">{swapPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={swapPercent} />
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatBytes(resources.swap?.used ?? 0)} / {formatBytes(resources.swap?.total ?? 0)}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Disk */}
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-accent" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const diskPercent = resources.disk?.total ? (resources.disk.used / resources.disk.total) * 100 : 0;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Root Filesystem</span>
                        <span className="text-sm font-mono">{diskPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={diskPercent} />
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatBytes(resources.disk?.used ?? 0)} / {formatBytes(resources.disk?.total ?? 0)}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {loading && (
          <div className="text-center text-muted-foreground py-8">
            Loading system data...
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
