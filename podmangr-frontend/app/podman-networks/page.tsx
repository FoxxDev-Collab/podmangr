"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Network,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Globe,
  AlertTriangle,
  Shield,
  GitBranch,
} from "lucide-react";

interface PodmanNetwork {
  id: string;
  name: string;
  driver: string;
  subnet: string;
  gateway: string;
  internal: boolean;
  ipv6: boolean;
  labels?: Record<string, string>;
  created_at: string;
}

export default function PodmanNetworksPage() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>("");

  // Check if user has permission (operator or admin)
  const hasPermission = user?.role === "admin" || user?.role === "operator" || user?.is_pam_admin;

  // Data states
  const [networks, setNetworks] = useState<PodmanNetwork[]>([]);
  const [filteredNetworks, setFilteredNetworks] = useState<PodmanNetwork[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<PodmanNetwork | null>(null);

  // Form states
  const [networkName, setNetworkName] = useState("");
  const [networkDriver, setNetworkDriver] = useState("bridge");
  const [subnet, setSubnet] = useState("");
  const [gateway, setGateway] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [enableIPv6, setEnableIPv6] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resultMessage, setResultMessage] = useState({ success: false, message: "" });

  // Check if user can manage networks (admin only)
  const canManageNetworks = user?.role === "admin";

  // Fetch networks
  const fetchNetworks = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/podman-networks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNetworks(data || []);
        setFilteredNetworks(data || []);
      } else {
        setError("Failed to load networks");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch networks");
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  // Filter networks based on search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredNetworks(networks);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredNetworks(
        networks.filter(
          (net) =>
            net.name.toLowerCase().includes(query) ||
            net.driver.toLowerCase().includes(query) ||
            net.subnet.toLowerCase().includes(query) ||
            net.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, networks]);

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
      fetchNetworks();
      const interval = setInterval(fetchNetworks, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, fetchNetworks]);

  // Create network
  const createNetwork = async () => {
    if (!networkName.trim() || !token) return;

    setIsCreating(true);
    try {
      const body: {
        name: string;
        driver?: string;
        subnet?: string;
        gateway?: string;
        internal: boolean;
        ipv6: boolean;
      } = {
        name: networkName,
        internal: isInternal,
        ipv6: enableIPv6,
      };

      if (networkDriver && networkDriver !== "bridge") {
        body.driver = networkDriver;
      }
      if (subnet.trim()) {
        body.subnet = subnet;
      }
      if (gateway.trim()) {
        body.gateway = gateway;
      }

      const res = await fetch("/api/podman-networks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok
          ? `Successfully created network ${networkName}`
          : result.error || "Failed to create network",
      });
      setResultDialog(true);
      setCreateDialog(false);
      resetForm();
      if (res.ok) fetchNetworks();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to create network",
      });
      setResultDialog(true);
    } finally {
      setIsCreating(false);
    }
  };

  // Delete network
  const deleteNetwork = async () => {
    if (!selectedNetwork || !token) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/podman-networks/${selectedNetwork.name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      setResultMessage({
        success: res.ok,
        message: res.ok
          ? `Successfully removed network ${selectedNetwork.name}`
          : result.error || "Failed to remove network",
      });
      setResultDialog(true);
      setDeleteDialog(false);
      setSelectedNetwork(null);
      if (res.ok) fetchNetworks();
    } catch (err) {
      setResultMessage({
        success: false,
        message: err instanceof Error ? err.message : "Failed to remove network",
      });
      setResultDialog(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setNetworkName("");
    setNetworkDriver("bridge");
    setSubnet("");
    setGateway("");
    setIsInternal(false);
    setEnableIPv6(false);
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
        <Network className="w-12 h-12 text-accent animate-pulse" />
      </div>
    );
  }

  return (
    <DashboardLayout title="PODMAN NETWORKS" time={time}>
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Networks</CardTitle>
              <Network className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{networks.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{filteredNetworks.length} shown</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bridge Networks</CardTitle>
              <GitBranch className="w-4 h-4 text-chart-3" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {networks.filter((net) => net.driver === "bridge").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">using bridge driver</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Internal</CardTitle>
              <Shield className="w-4 h-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{networks.filter((net) => net.internal).length}</div>
              <p className="text-xs text-muted-foreground mt-1">isolated networks</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">IPv6 Enabled</CardTitle>
              <Globe className="w-4 h-4 text-chart-5" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{networks.filter((net) => net.ipv6).length}</div>
              <p className="text-xs text-muted-foreground mt-1">with IPv6 support</p>
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
                <Network className="w-5 h-5 text-accent" />
                Container Networks
              </CardTitle>
              <div className="flex items-center gap-2">
                {canManageNetworks && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      setCreateDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Network
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={fetchNetworks} disabled={isRefreshing}>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search networks by name, driver, or subnet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredNetworks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {networks.length === 0 ? (
                  <div>
                    <Network className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No networks found</p>
                    <p className="text-sm mt-2">Create a network to connect containers</p>
                  </div>
                ) : (
                  <div>
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No networks match your search</p>
                    <p className="text-sm mt-2">Try a different search term</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNetworks.map((network) => (
                  <div
                    key={network.id}
                    className="p-4 rounded-lg border border-border/50 bg-background/40 hover:bg-background/60 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="w-4 h-4 text-accent" />
                          <h3 className="font-semibold font-mono text-lg">{network.name}</h3>
                          <Badge variant="outline">{network.driver}</Badge>
                          {network.internal && (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="w-3 h-3" />
                              Internal
                            </Badge>
                          )}
                          {network.ipv6 && (
                            <Badge variant="default" className="gap-1">
                              <Globe className="w-3 h-3" />
                              IPv6
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">ID:</span>
                            <span className="ml-2 font-mono text-xs">{network.id.substring(0, 12)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Subnet:</span>
                            <span className="ml-2 font-mono text-xs">
                              {network.subnet || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Gateway:</span>
                            <span className="ml-2 font-mono text-xs">
                              {network.gateway || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">{formatDate(network.created_at)}</span>
                          </div>
                        </div>
                        {network.labels && Object.keys(network.labels).length > 0 && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Labels:</span>
                            {Object.entries(network.labels).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}={value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {canManageNetworks && network.name !== "podman" && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedNetwork(network);
                              setDeleteDialog(true);
                            }}
                            title="Delete network"
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

      {/* Create Network Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" />
              Create Podman Network
            </DialogTitle>
            <DialogDescription>
              Create a new network for container communication and isolation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Network Name</Label>
              <Input
                placeholder="e.g., my-network"
                value={networkName}
                onChange={(e) => setNetworkName(e.target.value)}
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    createNetwork();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be unique and alphanumeric (hyphens and underscores allowed)
              </p>
            </div>
            <div>
              <Label>Driver</Label>
              <Input
                placeholder="bridge"
                value={networkDriver}
                onChange={(e) => setNetworkDriver(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Defaults to &quot;bridge&quot; if not specified
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subnet (optional)</Label>
                <Input
                  placeholder="e.g., 10.88.0.0/16"
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">CIDR notation</p>
              </div>
              <div>
                <Label>Gateway (optional)</Label>
                <Input
                  placeholder="e.g., 10.88.0.1"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Gateway IP address</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Internal Network</Label>
                  <p className="text-xs text-muted-foreground">
                    Restrict external access (no internet connectivity)
                  </p>
                </div>
                <Switch checked={isInternal} onCheckedChange={setIsInternal} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Enable IPv6</Label>
                  <p className="text-xs text-muted-foreground">Enable IPv6 networking support</p>
                </div>
                <Switch checked={enableIPv6} onCheckedChange={setEnableIPv6} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createNetwork} disabled={!networkName.trim() || isCreating}>
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Network
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
              Delete Network
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete network{" "}
              <span className="font-mono font-semibold">{selectedNetwork?.name}</span>? This will
              disconnect all containers using this network. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteNetwork}
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
