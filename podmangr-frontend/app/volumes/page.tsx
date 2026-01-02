"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  HardDrive,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  FolderOpen,
  AlertTriangle,
  Database,
} from "lucide-react";

interface Volume {
  name: string;
  driver: string;
  mount_point: string;
  created_at: string;
  labels?: Record<string, string>;
  scope: string;
  options?: Record<string, string>;
}

export default function VolumesPage() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>("");

  // Check if user has permission (operator or admin)
  const hasPermission = user?.role === "admin" || user?.role === "operator" || user?.is_pam_admin;

  // Data states
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [filteredVolumes, setFilteredVolumes] = useState<Volume[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);

  // Form states
  const [volumeName, setVolumeName] = useState("");
  const [volumeDriver, setVolumeDriver] = useState("local");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resultMessage, setResultMessage] = useState({ success: false, message: "" });

  // Check if user can manage volumes (admin only)
  const canManageVolumes = user?.role === "admin";

  // Fetch volumes
  const fetchVolumes = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/volumes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVolumes(data || []);
        setFilteredVolumes(data || []);
      } else {
        setError("Failed to load volumes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch volumes");
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  // Filter volumes based on search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredVolumes(volumes);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVolumes(
        volumes.filter(
          (vol) =>
            vol.name.toLowerCase().includes(query) ||
            vol.driver.toLowerCase().includes(query) ||
            vol.mount_point.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, volumes]);

  // Auth check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !hasPermission) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, hasPermission, router]);

  // Time update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchVolumes();
      const interval = setInterval(fetchVolumes, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, fetchVolumes]);

  // Create volume
  const createVolume = async () => {
    if (!volumeName.trim() || !token) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/volumes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: volumeName,
          driver: volumeDriver || "local",
        }),
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok ? `Successfully created volume ${volumeName}` : result.error || "Failed to create volume",
      });
      setResultDialog(true);
      setCreateDialog(false);
      setVolumeName("");
      setVolumeDriver("local");
      if (res.ok) fetchVolumes();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to create volume",
      });
      setResultDialog(true);
    } finally {
      setIsCreating(false);
    }
  };

  // Delete volume
  const deleteVolume = async () => {
    if (!selectedVolume || !token) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/volumes/${selectedVolume.name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok
          ? `Successfully removed volume ${selectedVolume.name}`
          : result.error || "Failed to remove volume",
      });
      setResultDialog(true);
      setDeleteDialog(false);
      setSelectedVolume(null);
      if (res.ok) fetchVolumes();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to remove volume",
      });
      setResultDialog(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  if (isLoading || !isAuthenticated || !hasPermission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <HardDrive className="w-12 h-12 text-accent animate-pulse" />
      </div>
    );
  }

  return (
    <DashboardLayout title="VOLUMES" time={time}>
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Volumes</CardTitle>
              <HardDrive className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{volumes.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{filteredVolumes.length} shown</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Local Volumes</CardTitle>
              <Database className="w-4 h-4 text-chart-3" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {volumes.filter((vol) => vol.driver === "local").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">using local driver</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drivers</CardTitle>
              <FolderOpen className="w-4 h-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Set(volumes.map((vol) => vol.driver)).size}
              </div>
              <p className="text-xs text-muted-foreground mt-1">unique drivers</p>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Main Content */}
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-accent" />
                Persistent Volumes
              </CardTitle>
              <div className="flex items-center gap-2">
                {canManageVolumes && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVolumeName("");
                      setVolumeDriver("local");
                      setCreateDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Volume
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={fetchVolumes} disabled={isRefreshing}>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search volumes by name, driver, or mount point..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredVolumes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {volumes.length === 0 ? (
                  <div>
                    <HardDrive className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No volumes found</p>
                    <p className="text-sm mt-2">Create a volume to persist container data</p>
                  </div>
                ) : (
                  <div>
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No volumes match your search</p>
                    <p className="text-sm mt-2">Try a different search term</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVolumes.map((volume) => (
                  <div
                    key={volume.name}
                    className="p-4 rounded-lg border border-border/50 bg-background/40 hover:bg-background/60 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive className="w-4 h-4 text-accent" />
                          <h3 className="font-semibold font-mono text-lg">{volume.name}</h3>
                          <Badge variant="outline">{volume.driver}</Badge>
                          {volume.scope && <Badge variant="secondary">{volume.scope}</Badge>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Mount Point:</span>
                            <span className="ml-2 font-mono text-xs">{volume.mount_point}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">{formatDate(volume.created_at)}</span>
                          </div>
                        </div>
                        {volume.labels && Object.keys(volume.labels).length > 0 && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Labels:</span>
                            {Object.entries(volume.labels).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}={value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {canManageVolumes && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedVolume(volume);
                              setDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Volume Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" />
              Create New Volume
            </DialogTitle>
            <DialogDescription>
              Create a persistent volume for storing container data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Volume Name</Label>
              <Input
                placeholder="e.g., postgres-data"
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    createVolume();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be unique and alphanumeric (hyphens and underscores allowed)
              </p>
            </div>
            <div>
              <Label>Driver (optional)</Label>
              <Input
                placeholder="local"
                value={volumeDriver}
                onChange={(e) => setVolumeDriver(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Defaults to &quot;local&quot; if not specified
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={createVolume} disabled={!volumeName.trim() || isCreating}>
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Volume
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Volume
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete volume{" "}
              <span className="font-mono font-semibold">{selectedVolume?.name}</span>? All data in this
              volume will be permanently lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteVolume}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Dialog */}
      <Dialog open={resultDialog} onOpenChange={setResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={resultMessage.success ? "text-green-500" : "text-destructive"}>
              {resultMessage.success ? "Success" : "Error"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{resultMessage.message}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setResultDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
