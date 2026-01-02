"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Archive,
  Trash2,
  ArrowUpCircle,
  HardDrive,
  Clock,
  Package,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Settings2,
  RotateCcw,
} from "lucide-react";

interface UpdateTabProps {
  containerId: string;
  currentImage: string;
  hasVolumes: boolean;
}

interface UpdateCheck {
  has_update: boolean;
  current_image: string;
  local_digest: string;
  remote_digest: string;
}

interface Backup {
  id: string;
  container_id: string;
  container_name: string;
  image: string;
  backup_path: string;
  backup_type: string;
  mounts: Array<{
    source: string;
    target: string;
    backup_path: string;
    type: string;
    size_bytes: number;
  }>;
  size_bytes: number;
  created_at: string;
}

interface UpdateProgress {
  step: string;
  message: string;
  progress?: number;
  error?: boolean;
  complete?: boolean;
  details?: Record<string, unknown>;
}

export function UpdateTab({ containerId, currentImage, hasVolumes }: UpdateTabProps) {
  const { token, user } = useAuth();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);

  // Update state - now inline instead of dialog
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Update options
  const [createBackup, setCreateBackup] = useState(true);
  const [overwriteBackup, setOverwriteBackup] = useState(false);
  const [customBackupPath, setCustomBackupPath] = useState("");
  const [removeOldContainer, setRemoveOldContainer] = useState(false);
  const [newImage, setNewImage] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin" || user?.is_pam_admin;

  // Fetch backups
  const fetchBackups = useCallback(async () => {
    if (!token || !containerId) return;

    setBackupsLoading(true);
    try {
      const response = await fetch(`/api/containers/${containerId}/backups`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBackups(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    } finally {
      setBackupsLoading(false);
    }
  }, [token, containerId]);

  // Check for updates
  const checkForUpdate = async () => {
    if (!token || !containerId) return;

    setCheckingUpdate(true);
    setUpdateCheck(null);

    try {
      const response = await fetch(`/api/containers/${containerId}/check-update`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to check for updates");
      }

      const data = await response.json();
      setUpdateCheck(data);
    } catch (err) {
      console.error("Failed to check for updates:", err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Delete backup
  const deleteBackup = async (backupId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/containers/backups/${backupId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete backup");
      }

      await fetchBackups();
    } catch (err) {
      console.error("Failed to delete backup:", err);
      alert(err instanceof Error ? err.message : "Failed to delete backup");
    }
  };

  // Restore backup state
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);

  // Restore backup
  const restoreBackup = async (backupId: string) => {
    if (!token) return;

    setRestoringBackupId(backupId);
    try {
      const response = await fetch(`/api/containers/backups/${backupId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to restore backup");
      }

      const result = await response.json();
      alert(`Successfully restored backup for ${result.container_name}. You may need to restart the container to see the changes.`);
    } catch (err) {
      console.error("Failed to restore backup:", err);
      alert(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoringBackupId(null);
    }
  };

  // Start update process
  const startUpdate = () => {
    if (!token || !containerId) return;

    setUpdateProgress([]);
    setCurrentProgress(0);
    setUpdateComplete(false);
    setUpdateError(null);
    setUpdating(true);

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/containers/${containerId}/update?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        container_id: containerId,
        new_image: newImage || undefined,
        create_backup: createBackup && hasVolumes,
        backup_path: customBackupPath || undefined,
        overwrite_backup: overwriteBackup,
        remove_old: removeOldContainer,
        stop_timeout: 30,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data: UpdateProgress = JSON.parse(event.data);

        setUpdateProgress(prev => [...prev, data]);

        if (data.progress) {
          setCurrentProgress(data.progress);
        }

        if (data.complete) {
          setUpdateComplete(true);
          setUpdating(false);
          fetchBackups();
        }

        if (data.error) {
          setUpdateError(data.message);
          setUpdating(false);
        }
      } catch (err) {
        console.error("Failed to parse update message:", err);
      }
    };

    ws.onerror = () => {
      setUpdateError("WebSocket connection failed");
      setUpdating(false);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  };

  // Cancel update
  const cancelUpdate = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setUpdating(false);
  };

  // Reset update state
  const resetUpdate = () => {
    setUpdateProgress([]);
    setCurrentProgress(0);
    setUpdateComplete(false);
    setUpdateError(null);
    setShowUpdateOptions(false);
  };

  // Auto-scroll progress
  useEffect(() => {
    if (progressRef.current && updateProgress.length > 0) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [updateProgress]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStepIcon = (step: string, isError?: boolean) => {
    if (isError) return <XCircle className="w-4 h-4 text-destructive" />;

    switch (step) {
      case "config":
        return <Package className="w-4 h-4 text-blue-400" />;
      case "backup":
        return <Archive className="w-4 h-4 text-amber-400" />;
      case "pull":
        return <Download className="w-4 h-4 text-cyan-400" />;
      case "stop":
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case "rename":
        return <RefreshCw className="w-4 h-4 text-purple-400" />;
      case "create":
        return <Package className="w-4 h-4 text-green-400" />;
      case "start":
        return <ArrowUpCircle className="w-4 h-4 text-green-400" />;
      case "cleanup":
        return <Trash2 className="w-4 h-4 text-gray-400" />;
      case "complete":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Image Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" />
            Current Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm">{currentImage}</p>
              {updateCheck && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Digest: {updateCheck.local_digest?.substring(0, 20)}...
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkForUpdate}
              disabled={checkingUpdate || !isAdmin}
            >
              {checkingUpdate ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check for Updates
            </Button>
          </div>

          {/* Update status */}
          {updateCheck && (
            <div className={`p-3 rounded-lg border ${
              updateCheck.has_update
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-green-500/10 border-green-500/30"
            }`}>
              <div className="flex items-center gap-2">
                {updateCheck.has_update ? (
                  <>
                    <ArrowUpCircle className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-amber-500">Update Available</p>
                      <p className="text-xs text-muted-foreground">
                        A newer version of this image is available
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-500">Up to Date</p>
                      <p className="text-xs text-muted-foreground">
                        You are running the latest version
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Container - Inline (no dialog) */}
      {isAdmin && (
        <Card className={updating || updateComplete || updateError ? "border-accent/50" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-accent" />
              Update Container
              {updating && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              {updateComplete && <CheckCircle2 className="w-4 h-4 text-green-500 ml-2" />}
              {updateError && <XCircle className="w-4 h-4 text-destructive ml-2" />}
            </CardTitle>
            <CardDescription>
              Pull the latest image and recreate the container with the same configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show progress when updating */}
            {(updating || updateComplete || updateError) ? (
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono">{currentProgress}%</span>
                  </div>
                  <Progress value={currentProgress} className="h-2" />
                </div>

                {/* Progress log */}
                <div
                  ref={progressRef}
                  className="h-64 rounded-lg border border-border/50 bg-[#0d1117] overflow-y-auto p-3 space-y-2"
                >
                  {updateProgress.map((progress, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-sm ${
                        progress.error ? "text-destructive" : "text-gray-300"
                      }`}
                    >
                      {getStepIcon(progress.step, progress.error)}
                      <span className={progress.details?.output ? "font-mono text-xs text-muted-foreground" : ""}>
                        {progress.message}
                      </span>
                    </div>
                  ))}
                  {updating && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {updateError && (
                  <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">Update Failed</span>
                    </div>
                    <p className="text-sm mt-1">{updateError}</p>
                  </div>
                )}

                {/* Success message */}
                {updateComplete && (
                  <div className="p-3 rounded-lg border border-green-500/50 bg-green-500/10">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Update Complete</span>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Container has been updated successfully.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {updating ? (
                    <Button variant="outline" onClick={cancelUpdate}>
                      Cancel Update
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={resetUpdate}>
                        {updateComplete ? "Done" : "Close"}
                      </Button>
                      {updateComplete && (
                        <Button onClick={() => window.location.reload()}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Page
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Show update options when not updating */
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowUpdateOptions(!showUpdateOptions)}
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Configure Update
                  </span>
                  {showUpdateOptions ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>

                {showUpdateOptions && (
                  <div className="space-y-4 pt-2">
                    {/* New image (optional) */}
                    <div className="space-y-2">
                      <Label>New Image (optional)</Label>
                      <Input
                        placeholder={currentImage}
                        value={newImage}
                        onChange={(e) => setNewImage(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to pull the latest version of the current image
                      </p>
                    </div>

                    {/* Backup options */}
                    {hasVolumes && (
                      <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Create Backup</Label>
                            <p className="text-xs text-muted-foreground">
                              Backup bind mount data before updating
                            </p>
                          </div>
                          <Switch checked={createBackup} onCheckedChange={setCreateBackup} />
                        </div>

                        {createBackup && (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Overwrite Existing Backup</Label>
                                <p className="text-xs text-muted-foreground">
                                  Replace previous backup for this container
                                </p>
                              </div>
                              <Switch checked={overwriteBackup} onCheckedChange={setOverwriteBackup} />
                            </div>

                            <div className="space-y-2">
                              <Label>Custom Backup Path (optional)</Label>
                              <Input
                                placeholder="~/podmangr/backups"
                                value={customBackupPath}
                                onChange={(e) => setCustomBackupPath(e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {!hasVolumes && (
                      <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                        <p className="text-sm text-blue-400">
                          This container has no bind mounts, so no backup will be created.
                        </p>
                      </div>
                    )}

                    {/* Cleanup option */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Remove Old Container</Label>
                        <p className="text-xs text-muted-foreground">
                          Delete the backup container after successful update
                        </p>
                      </div>
                      <Switch checked={removeOldContainer} onCheckedChange={setRemoveOldContainer} />
                    </div>

                    {/* Start button */}
                    <Button onClick={startUpdate} className="w-full">
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Start Update
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-400" />
            Volume Backups
          </CardTitle>
          <CardDescription>
            Backups of bind mount data created before updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No backups found</p>
              <p className="text-xs mt-1">Backups are created when you update a container with volumes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {backup.backup_type}
                        </Badge>
                        <span className="text-sm font-medium">{backup.id}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(backup.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatBytes(backup.size_bytes)}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {/* Restore button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-500 hover:text-amber-400"
                              disabled={restoringBackupId === backup.id}
                            >
                              {restoringBackupId === backup.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restore Backup</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will restore the backup data to the original mount locations.
                                <span className="font-medium text-amber-500"> Warning: This will overwrite the current data in those locations.</span>
                                <br /><br />
                                Make sure the container is stopped before restoring.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => restoreBackup(backup.id)}>
                                Restore
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this backup? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBackup(backup.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  {/* Mounts in backup */}
                  {backup.mounts && backup.mounts.length > 0 && (
                    <div className="pl-2 border-l-2 border-border/50 mt-2">
                      {backup.mounts.map((mount, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <FolderOpen className="w-3 h-3" />
                          <span className="font-mono truncate" title={mount.source}>
                            {mount.target}
                          </span>
                          <span className="text-muted-foreground/60">
                            ({formatBytes(mount.size_bytes)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground font-mono truncate" title={backup.backup_path}>
                    {backup.backup_path}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
