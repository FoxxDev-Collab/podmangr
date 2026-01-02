"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Layers,
  RefreshCw,
  Search,
  X,
  Plus,
  Play,
  Square,
  RotateCw,
  Trash2,
  Pause,
  PlayCircle,
  AlertCircle,
  Eye,
} from "lucide-react";

interface Pod {
  id: string;
  name: string;
  status: string;
  created: string;
  infra_id: string;
  containers: string[];
  num_containers: number;
}

interface CreatePodRequest {
  name: string;
  port_mappings: string[];
  labels: Record<string, string>;
}

interface LabelEntry {
  key: string;
  value: string;
}

export default function PodsPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create pod form state
  const [podName, setPodName] = useState("");
  const [portMappings, setPortMappings] = useState<string[]>([]);
  const [newPortMapping, setNewPortMapping] = useState("");
  const [labels, setLabels] = useState<LabelEntry[]>([]);
  const [newLabelKey, setNewLabelKey] = useState("");
  const [newLabelValue, setNewLabelValue] = useState("");

  const fetchPods = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/pods", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPods(data || []);
        setError(null);
      } else {
        setError("Failed to load pods");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pods");
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
      fetchPods();
      const interval = setInterval(fetchPods, 5000);
      return () => clearInterval(interval);
    }
  }, [token, fetchPods]);

  const handlePodAction = async (podId: string, action: string) => {
    if (!token) return;
    setActionLoading(podId);
    try {
      const response = await fetch(`/api/pods/${podId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await fetchPods();
      } else {
        const data = await response.json();
        setError(data.error || `Failed to ${action} pod`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} pod`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePod = async () => {
    if (!token || !podName) return;
    setActionLoading("create");
    try {
      // Convert labels array to object
      const labelsObj: Record<string, string> = {};
      labels.forEach(({ key, value }) => {
        if (key.trim()) {
          labelsObj[key.trim()] = value.trim();
        }
      });

      const requestBody: CreatePodRequest = {
        name: podName,
        port_mappings: portMappings.filter(p => p.trim() !== ""),
        labels: labelsObj,
      };

      const response = await fetch("/api/pods", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setShowCreateDialog(false);
        setPodName("");
        setPortMappings([]);
        setNewPortMapping("");
        setLabels([]);
        setNewLabelKey("");
        setNewLabelValue("");
        await fetchPods();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create pod");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pod");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePod = async () => {
    if (!token || !selectedPod) return;
    setActionLoading(selectedPod.id);
    try {
      const response = await fetch(`/api/pods/${selectedPod.id}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setShowRemoveDialog(false);
        setSelectedPod(null);
        await fetchPods();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to remove pod");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove pod");
    } finally {
      setActionLoading(null);
    }
  };

  const addPortMapping = () => {
    if (newPortMapping.trim()) {
      setPortMappings([...portMappings, newPortMapping.trim()]);
      setNewPortMapping("");
    }
  };

  const removePortMapping = (index: number) => {
    setPortMappings(portMappings.filter((_, i) => i !== index));
  };

  const addLabel = () => {
    if (newLabelKey.trim()) {
      setLabels([...labels, { key: newLabelKey.trim(), value: newLabelValue.trim() }]);
      setNewLabelKey("");
      setNewLabelValue("");
    }
  };

  const removeLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  const filteredPods = pods.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("running")) {
      return "bg-green-500/20 text-green-500";
    } else if (statusLower.includes("paused")) {
      return "bg-yellow-500/20 text-yellow-500";
    } else if (statusLower.includes("stopped") || statusLower.includes("exited")) {
      return "bg-red-500/20 text-red-500";
    }
    return "bg-muted text-muted-foreground";
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="Pods">
      <div className="p-6 space-y-6">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-accent" />
                Pod Management
              </CardTitle>
              <div className="flex gap-2">
                <Button onClick={fetchPods} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={() => setShowCreateDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Pod
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              {searchTerm && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading pods...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Containers</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPods.map((pod) => (
                      <TableRow key={pod.id}>
                        <TableCell className="font-medium">{pod.name}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(pod.status)}`}>
                            {pod.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {pod.num_containers || 0} container{pod.num_containers !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(pod.created).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/pod-details?id=${pod.id}`)}
                              disabled={actionLoading === pod.id}
                              title="View pod details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {pod.status.toLowerCase().includes("running") ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePodAction(pod.id, "pause")}
                                  disabled={actionLoading === pod.id}
                                  title="Pause pod"
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePodAction(pod.id, "stop")}
                                  disabled={actionLoading === pod.id}
                                  title="Stop pod"
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              </>
                            ) : pod.status.toLowerCase().includes("paused") ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePodAction(pod.id, "unpause")}
                                disabled={actionLoading === pod.id}
                                title="Unpause pod"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePodAction(pod.id, "start")}
                                disabled={actionLoading === pod.id}
                                title="Start pod"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePodAction(pod.id, "restart")}
                              disabled={actionLoading === pod.id}
                              title="Restart pod"
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedPod(pod);
                                setShowRemoveDialog(true);
                              }}
                              disabled={actionLoading === pod.id}
                              title="Remove pod"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filteredPods.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {searchTerm ? "No pods found matching your search" : "No pods found. Create one to get started."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Pod Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Pod</DialogTitle>
              <DialogDescription>
                Create a new pod to group containers that share networking and storage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pod-name">Pod Name *</Label>
                <Input
                  id="pod-name"
                  placeholder="my-pod"
                  value={podName}
                  onChange={(e) => setPodName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Port Mappings</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="8080:80 or 127.0.0.1:8080:80"
                    value={newPortMapping}
                    onChange={(e) => setNewPortMapping(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addPortMapping()}
                  />
                  <Button type="button" onClick={addPortMapping} size="sm">
                    Add
                  </Button>
                </div>
                {portMappings.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {portMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                        <span className="text-sm font-mono">{mapping}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePortMapping(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Labels</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="key"
                    value={newLabelKey}
                    onChange={(e) => setNewLabelKey(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="value"
                    value={newLabelValue}
                    onChange={(e) => setNewLabelValue(e.target.value)}
                    className="flex-1"
                    onKeyPress={(e) => e.key === "Enter" && addLabel()}
                  />
                  <Button type="button" onClick={addLabel} size="sm">
                    Add
                  </Button>
                </div>
                {labels.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {labels.map((label, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                        <span className="text-sm">
                          <span className="text-muted-foreground">{label.key}:</span>{" "}
                          <span className="font-mono">{label.value}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLabel(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setPodName("");
                  setPortMappings([]);
                  setNewPortMapping("");
                  setLabels([]);
                  setNewLabelKey("");
                  setNewLabelValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePod}
                disabled={!podName || actionLoading === "create"}
              >
                {actionLoading === "create" ? "Creating..." : "Create Pod"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Pod Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Pod</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove pod <strong>{selectedPod?.name}</strong>?
                This will also remove all containers in the pod.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRemoveDialog(false);
                  setSelectedPod(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemovePod}
                disabled={actionLoading === selectedPod?.id}
              >
                {actionLoading === selectedPod?.id ? "Removing..." : "Remove Pod"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
