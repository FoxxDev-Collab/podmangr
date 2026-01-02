"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Pause,
  PlayCircle,
  Loader2,
  AlertCircle,
  Trash2,
  Layers,
  Info,
  Code,
  Box,
  Network,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PodInspect {
  Id: string;
  Name: string;
  State: string;
  Created: string;
  CreateCommand: string[];
  InfraContainerId: string;
  NumContainers: number;
  Containers: Array<{
    Id: string;
    Name: string;
    State: string;
  }>;
  SharedNamespaces: string[];
  Labels?: Record<string, string>;
  // Network information
  InfraConfig?: {
    PortBindings?: Record<string, Array<{ HostIp: string; HostPort: string }>>;
    Networks?: string[];
    HostNetwork?: boolean;
  };
}

interface Container {
  id: string;
  container_id: string;
  name: string;
  image: string;
  status: string;
  uptime?: string;
}

function PodDetailsContent() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const podId = searchParams.get("id");

  const [podInspect, setPodInspect] = useState<PodInspect | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const isAdmin = user?.role === "admin" || user?.is_pam_admin;

  const fetchPodData = useCallback(async () => {
    if (!token || !podId) return;

    try {
      // Fetch pod inspect data
      const inspectRes = await fetch(`/api/pods/${podId}/inspect`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!inspectRes.ok) {
        throw new Error("Pod not found");
      }

      const inspectData = await inspectRes.json();
      setPodInspect(inspectData);

      // Fetch all containers to filter by pod
      const containersRes = await fetch("/api/containers", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (containersRes.ok) {
        const allContainers = await containersRes.json();
        // Filter containers that belong to this pod
        const podContainerIds = inspectData.Containers?.map((c: { Id: string }) => c.Id) || [];
        const podContainers = (allContainers || []).filter((c: Container) =>
          podContainerIds.some((pid: string) => c.container_id?.startsWith(pid) || pid.startsWith(c.container_id))
        );
        setContainers(podContainers);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pod");
    } finally {
      setLoading(false);
    }
  }, [token, podId]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token && podId) {
      fetchPodData();
      const interval = setInterval(fetchPodData, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, podId, fetchPodData]);

  const handlePodAction = async (action: "start" | "stop" | "restart" | "pause" | "unpause") => {
    if (!token || !podId) return;

    setActionInProgress(true);
    try {
      const response = await fetch(`/api/pods/${podId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} pod`);
      }

      await fetchPodData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} pod`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRemovePod = async () => {
    if (!token || !podId) return;

    setActionInProgress(true);
    try {
      const response = await fetch(`/api/pods/${podId}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove pod");
      }

      router.push("/pods");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove pod");
      setShowRemoveDialog(false);
    } finally {
      setActionInProgress(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("running")) {
      return "bg-green-500/20 text-green-500 border-green-500/40";
    } else if (statusLower.includes("paused")) {
      return "bg-yellow-500/20 text-yellow-500 border-yellow-500/40";
    } else if (statusLower.includes("stopped") || statusLower.includes("exited") || statusLower.includes("dead")) {
      return "bg-red-500/20 text-red-500 border-red-500/40";
    }
    return "bg-muted text-muted-foreground";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!podId) {
    return (
      <DashboardLayout title="ERROR">
        <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Pod Specified</h2>
            <p className="text-muted-foreground mb-4">Please select a pod from the manager.</p>
            <Button onClick={() => router.push("/pods")}>
              Return to Pod Manager
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="LOADING...">
        <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !podInspect) {
    return (
      <DashboardLayout title="ERROR">
        <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Pod Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "The pod could not be found."}</p>
            <Button onClick={() => router.push("/pods")}>
              Return to Pod Manager
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isRunning = podInspect.State?.toLowerCase().includes("running");
  const isPaused = podInspect.State?.toLowerCase().includes("paused");

  return (
    <DashboardLayout title={podInspect.Name?.toUpperCase() || "POD"}>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/pods")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">{podInspect.Name}</h1>
                    <p className="text-sm text-muted-foreground font-mono">
                      {podInspect.NumContainers} container{podInspect.NumContainers !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={getStatusBadge(podInspect.State)}>
                  {podInspect.State}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {isRunning && !isPaused ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePodAction("pause")}
                      disabled={actionInProgress || !isAdmin}
                      title={!isAdmin ? "Admin required" : "Pause pod"}
                    >
                      {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                      <span className="ml-2">Pause</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePodAction("stop")}
                      disabled={actionInProgress || !isAdmin}
                      title={!isAdmin ? "Admin required" : "Stop pod"}
                    >
                      <Square className="w-4 h-4" />
                      <span className="ml-2">Stop</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePodAction("restart")}
                      disabled={actionInProgress || !isAdmin}
                      title={!isAdmin ? "Admin required" : "Restart pod"}
                    >
                      <RotateCw className="w-4 h-4" />
                      <span className="ml-2">Restart</span>
                    </Button>
                  </>
                ) : isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePodAction("unpause")}
                    disabled={actionInProgress || !isAdmin}
                    title={!isAdmin ? "Admin required" : "Unpause pod"}
                  >
                    {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    <span className="ml-2">Unpause</span>
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handlePodAction("start")}
                    disabled={actionInProgress || !isAdmin}
                    title={!isAdmin ? "Admin required" : "Start pod"}
                  >
                    {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span className="ml-2">Start</span>
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowRemoveDialog(true)}
                    disabled={actionInProgress}
                    title="Remove pod"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Tabs Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 px-6 pt-4 border-b border-border/30">
              <TabsList className="bg-background/50">
                <TabsTrigger value="overview" className="gap-2">
                  <Info className="w-4 h-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="containers" className="gap-2">
                  <Box className="w-4 h-4" />
                  Containers ({podInspect.NumContainers})
                </TabsTrigger>
                <TabsTrigger value="inspect" className="gap-2">
                  <Code className="w-4 h-4" />
                  Inspect
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto">
              {/* Overview Tab */}
              <TabsContent value="overview" className="h-full m-0 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pod Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        Pod Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ID</span>
                        <span className="font-mono">{podInspect.Id?.substring(0, 12)}</span>
                        <span className="text-muted-foreground">Name</span>
                        <span>{podInspect.Name}</span>
                        <span className="text-muted-foreground">Status</span>
                        <span className={isRunning ? "text-green-500" : isPaused ? "text-yellow-500" : "text-muted-foreground"}>
                          {podInspect.State}
                        </span>
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(podInspect.Created)}</span>
                        <span className="text-muted-foreground">Containers</span>
                        <span>{podInspect.NumContainers}</span>
                        <span className="text-muted-foreground">Infra Container</span>
                        <span className="font-mono text-xs">{podInspect.InfraContainerId?.substring(0, 12) || "-"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shared Namespaces */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Network className="w-4 h-4 text-blue-400" />
                        Shared Namespaces
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {podInspect.SharedNamespaces && podInspect.SharedNamespaces.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {podInspect.SharedNamespaces.map((ns, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {ns}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No shared namespaces configured</p>
                      )}
                      {podInspect.InfraConfig?.HostNetwork && (
                        <div className="mt-4">
                          <Badge variant="secondary">Host Network Mode</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Port Bindings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Network className="w-4 h-4 text-cyan-400" />
                        Port Mappings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {podInspect.InfraConfig?.PortBindings && Object.keys(podInspect.InfraConfig.PortBindings).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(podInspect.InfraConfig.PortBindings).map(([containerPort, bindings]) => (
                            bindings?.map((binding, i) => (
                              <div key={`${containerPort}-${i}`} className="text-sm font-mono bg-muted/30 px-3 py-2 rounded">
                                {binding.HostIp || "0.0.0.0"}:{binding.HostPort} → {containerPort}
                              </div>
                            ))
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No port mappings configured</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Labels */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-400" />
                        Labels
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {podInspect.Labels && Object.keys(podInspect.Labels).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(podInspect.Labels).map(([key, value]) => (
                            <div key={key} className="text-sm bg-muted/30 px-3 py-2 rounded">
                              <span className="text-muted-foreground">{key}:</span>{" "}
                              <span className="font-mono">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No labels configured</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Create Command */}
                  {podInspect.CreateCommand && podInspect.CreateCommand.length > 0 && (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-green-400" />
                            Create Command
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(podInspect.CreateCommand.join(" "))}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-muted/30 p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                          {podInspect.CreateCommand.join(" ")}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Containers Tab */}
              <TabsContent value="containers" className="h-full m-0 p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Box className="w-4 h-4 text-cyan-400" />
                      Containers in Pod
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {podInspect.Containers && podInspect.Containers.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {podInspect.Containers.map((container) => {
                              const fullContainer = containers.find(
                                (c) => c.container_id?.startsWith(container.Id) || container.Id.startsWith(c.container_id)
                              );
                              return (
                                <TableRow key={container.Id}>
                                  <TableCell className="font-medium">{container.Name}</TableCell>
                                  <TableCell className="font-mono text-xs">{container.Id.substring(0, 12)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={getStatusBadge(container.State)}>
                                      {container.State}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (fullContainer) {
                                          router.push(`/container-details?id=${fullContainer.container_id}`);
                                        }
                                      }}
                                      disabled={!fullContainer}
                                      title="View container details"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No containers in this pod. The infra container is not shown.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Inspect Tab */}
              <TabsContent value="inspect" className="h-full m-0 p-6">
                <div className="max-w-6xl">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Code className="w-4 h-4 text-accent" />
                        Full Pod Inspection (JSON)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2 z-10"
                          onClick={() => copyToClipboard(JSON.stringify(podInspect, null, 2))}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy JSON
                        </Button>
                        <pre className="bg-background/60 border border-border/50 rounded-lg p-4 overflow-auto max-h-[600px] text-xs font-mono">
                          <code>{JSON.stringify(podInspect, null, 2)}</code>
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Remove Pod Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Pod</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove pod <strong>{podInspect.Name}</strong>?
                This will also remove all containers in the pod.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRemoveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemovePod}
                disabled={actionInProgress}
              >
                {actionInProgress ? "Removing..." : "Remove Pod"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default function PodDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    }>
      <PodDetailsContent />
    </Suspense>
  );
}
