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
  Image as ImageIcon,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Layers,
  Package,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface ContainerImage {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: string;
  containers: number;
}

export default function ImagesPage() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>("");

  // Check if user has permission (operator or admin)
  const hasPermission = user?.role === "admin" || user?.role === "operator" || user?.is_pam_admin;

  // Data states
  const [images, setImages] = useState<ContainerImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<ContainerImage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [pullDialog, setPullDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ContainerImage | null>(null);

  // Form states
  const [pullImageName, setPullImageName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resultMessage, setResultMessage] = useState({ success: false, message: "" });

  // Check if user can manage images (admin only)
  const canManageImages = user?.role === "admin";

  // Fetch images
  const fetchImages = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/images", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data || []);
        setFilteredImages(data || []);
      } else {
        setError("Failed to load images");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch images");
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  // Filter images based on search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredImages(images);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredImages(
        images.filter(
          (img) =>
            img.repository.toLowerCase().includes(query) ||
            img.tag.toLowerCase().includes(query) ||
            img.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, images]);

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
      fetchImages();
      const interval = setInterval(fetchImages, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, fetchImages]);

  // Pull image
  const pullImage = async () => {
    if (!pullImageName.trim() || !token) return;

    setIsPulling(true);
    try {
      const res = await fetch("/api/images/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: pullImageName }),
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok ? `Successfully pulled ${pullImageName}` : result.error || "Failed to pull image",
      });
      setResultDialog(true);
      setPullDialog(false);
      setPullImageName("");
      if (res.ok) fetchImages();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to pull image",
      });
      setResultDialog(true);
    } finally {
      setIsPulling(false);
    }
  };

  // Delete image
  const deleteImage = async () => {
    if (!selectedImage || !token) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/images/${selectedImage.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok
          ? `Successfully removed ${selectedImage.repository}:${selectedImage.tag}`
          : result.error || "Failed to remove image",
      });
      setResultDialog(true);
      setDeleteDialog(false);
      setSelectedImage(null);
      if (res.ok) fetchImages();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to remove image",
      });
      setResultDialog(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
        <ImageIcon className="w-12 h-12 text-accent animate-pulse" />
      </div>
    );
  }

  return (
    <DashboardLayout title="IMAGES" time={time}>
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Images</CardTitle>
              <ImageIcon className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{images.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{filteredImages.length} shown</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Size</CardTitle>
              <Package className="w-4 h-4 text-chart-3" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatBytes(images.reduce((acc, img) => acc + img.size, 0))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">disk usage</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Use</CardTitle>
              <Layers className="w-4 h-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {images.filter((img) => img.containers > 0).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {images.reduce((acc, img) => acc + img.containers, 0)} containers
              </p>
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
                <ImageIcon className="w-5 h-5 text-accent" />
                Container Images
              </CardTitle>
              <div className="flex items-center gap-2">
                {canManageImages && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPullImageName("");
                      setPullDialog(true);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Pull Image
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={fetchImages} disabled={isRefreshing}>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search images by name, tag, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredImages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {images.length === 0 ? (
                  <div>
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No images found</p>
                    <p className="text-sm mt-2">
                      Pull an image to get started
                    </p>
                  </div>
                ) : (
                  <div>
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No images match your search</p>
                    <p className="text-sm mt-2">Try a different search term</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredImages.map((image) => (
                  <div
                    key={image.id}
                    className="p-4 rounded-lg border border-border/50 bg-background/40 hover:bg-background/60 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="w-4 h-4 text-accent" />
                          <h3 className="font-semibold font-mono text-lg">
                            {image.repository}
                            <span className="text-muted-foreground">:</span>
                            <span className="text-accent">{image.tag}</span>
                          </h3>
                          {image.containers > 0 && (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {image.containers} container{image.containers > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">ID:</span>
                            <span className="ml-2 font-mono text-xs">{image.id.substring(0, 12)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <span className="ml-2">{formatBytes(image.size)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">{formatDate(image.created)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">In Use:</span>
                            <span className="ml-2">
                              {image.containers > 0 ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {canManageImages && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedImage(image);
                              setDeleteDialog(true);
                            }}
                            disabled={image.containers > 0}
                            title={
                              image.containers > 0
                                ? "Cannot delete image in use"
                                : "Delete image"
                            }
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

      {/* Pull Image Dialog */}
      <Dialog open={pullDialog} onOpenChange={setPullDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-accent" />
              Pull Container Image
            </DialogTitle>
            <DialogDescription>
              Pull an image from a registry. Use format: repository:tag or full URL.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Image Name</Label>
            <Input
              placeholder="e.g., docker.io/library/nginx:latest"
              value={pullImageName}
              onChange={(e) => setPullImageName(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPulling) {
                  pullImage();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Examples: nginx:latest, postgres:15, ghcr.io/user/repo:tag
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPullDialog(false)} disabled={isPulling}>
              Cancel
            </Button>
            <Button onClick={pullImage} disabled={!pullImageName.trim() || isPulling}>
              {isPulling ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Pulling...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Pull Image
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
              Delete Image
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold">
                {selectedImage?.repository}:{selectedImage?.tag}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteImage}
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
