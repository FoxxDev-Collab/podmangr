"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  Search,
  Play,
  Square,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Box,
  Eye,
  Lightbulb,
  FileCode2,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Stack {
  id: string;
  name: string;
  description: string;
  status: "active" | "partial" | "stopped" | "error" | "deploying";
  container_count: number;
  running_count: number;
  created_at: string;
  updated_at: string;
}

interface StackDetail extends Stack {
  compose_content: string;
  env_content: string;
  path: string;
}

interface StackContainer {
  name: string;
  service: string;
  status: string;
  image: string;
  ports: { host_port: number; container_port: number; protocol: string }[];
}

interface StacksTabProps {
  token: string;
  isAdmin: boolean;
  composeAvailable: boolean;
}

export function StacksTab({ token, isAdmin, composeAvailable }: StacksTabProps) {
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStack, setSelectedStack] = useState<StackDetail | null>(null);
  const [stackContainers, setStackContainers] = useState<StackContainer[]>([]);

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showContainersDialog, setShowContainersDialog] = useState(false);

  // Form state
  const [newStackName, setNewStackName] = useState("");
  const [newStackDescription, setNewStackDescription] = useState("");
  const [newStackCompose, setNewStackCompose] = useState(`version: "3.8"
services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`);
  const [newStackEnv, setNewStackEnv] = useState("");

  // Deploy state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deploySuccess, setDeploySuccess] = useState<boolean | null>(null);
  const deployLogsRef = useRef<HTMLDivElement>(null);

  const fetchStacks = useCallback(async () => {
    try {
      const response = await fetch("/api/stacks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStacks(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch stacks:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStacks();
  }, [fetchStacks]);

  // Auto-scroll deploy logs
  useEffect(() => {
    if (deployLogsRef.current) {
      deployLogsRef.current.scrollTop = deployLogsRef.current.scrollHeight;
    }
  }, [deployLogs]);

  const fetchStackDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/stacks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedStack(data);
        return data;
      }
    } catch (error) {
      console.error("Failed to fetch stack details:", error);
    }
    return null;
  };

  const fetchStackContainers = async (id: string) => {
    try {
      const response = await fetch(`/api/stacks/${id}/containers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStackContainers(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch stack containers:", error);
    }
  };

  const createStack = async () => {
    try {
      const response = await fetch("/api/stacks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStackName,
          description: newStackDescription,
          compose_content: newStackCompose,
          env_content: newStackEnv,
        }),
      });

      if (response.ok) {
        toast.success("Stack created", {
          description: `Stack "${newStackName}" created successfully`,
        });
        setShowCreateDialog(false);
        resetForm();
        fetchStacks();
      } else {
        const error = await response.json();
        toast.error("Failed to create stack", {
          description: error.error || "Unknown error",
        });
      }
    } catch (error) {
      toast.error("Failed to create stack", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const updateStack = async () => {
    if (!selectedStack) return;

    try {
      const response = await fetch(`/api/stacks/${selectedStack.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStackName || selectedStack.name,
          description: newStackDescription,
          compose_content: newStackCompose,
          env_content: newStackEnv,
        }),
      });

      if (response.ok) {
        toast.success("Stack updated", {
          description: `Stack "${selectedStack.name}" updated successfully`,
        });
        setShowEditDialog(false);
        fetchStacks();
      } else {
        const error = await response.json();
        toast.error("Failed to update stack", {
          description: error.error || "Unknown error",
        });
      }
    } catch (error) {
      toast.error("Failed to update stack", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const deleteStack = async (removeVolumes: boolean = false) => {
    if (!selectedStack) return;

    try {
      const response = await fetch(
        `/api/stacks/${selectedStack.id}?volumes=${removeVolumes}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Stack deleted", {
          description: `Stack "${selectedStack.name}" deleted successfully`,
        });
        setShowDeleteDialog(false);
        setSelectedStack(null);
        fetchStacks();
      } else {
        const error = await response.json();
        toast.error("Failed to delete stack", {
          description: error.error || "Unknown error",
        });
      }
    } catch (error) {
      toast.error("Failed to delete stack", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const deployStack = async () => {
    if (!selectedStack) return;

    setIsDeploying(true);
    setDeployLogs([]);
    setDeployProgress(0);
    setDeploySuccess(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/stacks/${selectedStack.id}/deploy?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.output) {
        setDeployLogs((prev) => [...prev, data.output]);
        setDeployProgress((prev) => Math.min(prev + 2, 90));
      }

      if (data.message) {
        setDeployLogs((prev) => [...prev, `[INFO] ${data.message}`]);
      }

      if (data.complete) {
        setIsDeploying(false);
        setDeployProgress(100);
        setDeploySuccess(data.success);
        if (data.success) {
          toast.success("Stack deployed", {
            description: `Stack "${selectedStack.name}" is now running`,
          });
          fetchStacks();
        } else {
          toast.error("Deployment failed", {
            description: data.error || "Unknown error",
          });
        }
      }
    };

    ws.onerror = () => {
      setIsDeploying(false);
      setDeploySuccess(false);
      toast.error("Connection error", {
        description: "Failed to connect to deployment service",
      });
    };
  };

  const stackAction = async (action: "start" | "stop" | "restart") => {
    if (!selectedStack) return;

    try {
      const response = await fetch(`/api/stacks/${selectedStack.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success(`Stack ${action}ed`, {
          description: `Stack "${selectedStack.name}" ${action}ed successfully`,
        });
        fetchStacks();
      } else {
        const error = await response.json();
        toast.error(`Failed to ${action} stack`, {
          description: error.error || "Unknown error",
        });
      }
    } catch (error) {
      toast.error(`Failed to ${action} stack`, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const resetForm = () => {
    setNewStackName("");
    setNewStackDescription("");
    setNewStackCompose(`version: "3.8"
services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`);
    setNewStackEnv("");
  };

  const openEditDialog = async (stack: Stack) => {
    const details = await fetchStackDetails(stack.id);
    if (details) {
      setNewStackName(details.name);
      setNewStackDescription(details.description);
      setNewStackCompose(details.compose_content);
      setNewStackEnv(details.env_content);
      setShowEditDialog(true);
    }
  };

  const openDeployDialog = async (stack: Stack) => {
    await fetchStackDetails(stack.id);
    setDeployLogs([]);
    setDeployProgress(0);
    setDeploySuccess(null);
    setShowDeployDialog(true);
  };

  const openContainersDialog = async (stack: Stack) => {
    await fetchStackDetails(stack.id);
    await fetchStackContainers(stack.id);
    setShowContainersDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-accent";
      case "partial":
        return "text-primary";
      case "stopped":
        return "text-muted-foreground";
      case "error":
        return "text-destructive";
      case "deploying":
        return "text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4 text-accent" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-primary" />;
      case "stopped":
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      case "error":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "deploying":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const filteredStacks = stacks.filter(
    (stack) =>
      stack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stack.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!composeAvailable) {
    return (
      <Card className="bg-card/70 border-border/50">
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h3 className="text-lg font-medium mb-2">podman-compose Not Installed</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            podman-compose is required to deploy and manage multi-container stacks.
            You can install it using the Podman installer or manually via your package manager.
          </p>

          <div className="bg-background/50 rounded-lg p-4 text-left max-w-md mx-auto mb-4">
            <h4 className="text-sm font-semibold mb-2">Manual Installation:</h4>
            <div className="space-y-2 text-xs font-mono text-muted-foreground">
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-accent"># RHEL/CentOS/Rocky/Alma</span><br />
                sudo dnf install -y epel-release<br />
                sudo dnf install -y podman-compose
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-accent"># Fedora</span><br />
                sudo dnf install -y podman-compose
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-accent"># Debian/Ubuntu</span><br />
                sudo apt install -y podman-compose
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            After installation, refresh the page to continue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Section */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Lightbulb className="w-5 h-5 text-accent" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="font-medium text-sm flex items-center gap-2">
                What are Stacks?
              </h3>
              <p className="text-sm text-muted-foreground">
                Stacks are deployed multi-container applications managed via docker-compose. Each stack runs as an independent project with its own containers, networks, and volumes.
              </p>
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileCode2 className="w-3 h-3 text-accent" />
                  Compose-based orchestration
                </span>
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3 text-accent" />
                  Start, stop, restart containers
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-accent" />
                  Independent lifecycle management
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stacks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card/70 border-border/50"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Stack
          </Button>
        )}
      </div>

      {/* Stacks Grid */}
      {loading ? (
        <Card className="bg-card/70 border-border/50">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-accent" />
            <p className="text-muted-foreground">Loading stacks...</p>
          </CardContent>
        </Card>
      ) : filteredStacks.length === 0 ? (
        <Card className="bg-card/70 border-border/50">
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Stacks Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? "No stacks match your search"
                : "Create your first stack to get started"}
            </p>
            {isAdmin && !searchTerm && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create Stack
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStacks.map((stack) => (
            <Card
              key={stack.id}
              className="bg-card/70 border-border/50 hover:border-accent/50 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-accent" />
                    <CardTitle className="text-base">{stack.name}</CardTitle>
                  </div>
                  {getStatusIcon(stack.status)}
                </div>
                {stack.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {stack.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Containers</span>
                  <span className={getStatusColor(stack.status)}>
                    {stack.running_count}/{stack.container_count} running
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(stack.status)} border-current`}
                  >
                    {stack.status.toUpperCase()}
                  </Badge>
                </div>

                <Separator />

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openContainersDialog(stack)}
                    className="gap-1 flex-1"
                  >
                    <Eye className="w-3 h-3" /> View
                  </Button>
                  {isAdmin && (
                    <>
                      {stack.status === "stopped" || stack.status === "error" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDeployDialog(stack)}
                          className="gap-1 flex-1 text-accent hover:text-accent"
                        >
                          <Play className="w-3 h-3" /> Deploy
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedStack(stack as StackDetail);
                            stackAction("stop");
                          }}
                          className="gap-1 flex-1 text-destructive hover:text-destructive"
                        >
                          <Square className="w-3 h-3" /> Stop
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(stack)}
                        className="gap-1"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedStack(stack as StackDetail);
                          setShowDeleteDialog(true);
                        }}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Stack Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Create New Stack
            </DialogTitle>
            <DialogDescription>
              Define a new multi-container application using Docker Compose
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Quick tip */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <HelpCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Stacks are deployed using <code className="px-1 py-0.5 bg-muted rounded">podman-compose</code>. After creating a stack, use the <strong>Deploy</strong> button to start the containers.
                For reusable configurations, consider creating a <strong>Template</strong> instead.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Stack Name *</Label>
                <Input
                  id="name"
                  value={newStackName}
                  onChange={(e) => setNewStackName(e.target.value)}
                  placeholder="my-stack"
                />
                <p className="text-xs text-muted-foreground">Used as the compose project name</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newStackDescription}
                  onChange={(e) => setNewStackDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose">Docker Compose (YAML) *</Label>
              <textarea
                id="compose"
                value={newStackCompose}
                onChange={(e) => setNewStackCompose(e.target.value)}
                className="w-full h-64 px-3 py-2 font-mono text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="version: '3.8'..."
              />
              <p className="text-xs text-muted-foreground">
                Standard docker-compose.yml format. Define services, networks, and volumes for your application.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="env">Environment Variables (.env)</Label>
              <textarea
                id="env"
                value={newStackEnv}
                onChange={(e) => setNewStackEnv(e.target.value)}
                className="w-full h-24 px-3 py-2 font-mono text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="KEY=value"
              />
              <p className="text-xs text-muted-foreground">
                KEY=value format, one per line. These are passed to compose as environment variables.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createStack} disabled={!newStackName || !newStackCompose}>
              Create Stack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stack Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Stack: {selectedStack?.name}
            </DialogTitle>
            <DialogDescription>
              Modify the stack configuration
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Warning about redeployment */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary">
                Changes to the compose file or environment variables require <strong>redeployment</strong> to take effect. Running containers will be recreated.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Stack Name</Label>
                <Input
                  id="edit-name"
                  value={newStackName}
                  onChange={(e) => setNewStackName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={newStackDescription}
                  onChange={(e) => setNewStackDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-compose">Docker Compose (YAML)</Label>
              <textarea
                id="edit-compose"
                value={newStackCompose}
                onChange={(e) => setNewStackCompose(e.target.value)}
                className="w-full h-64 px-3 py-2 font-mono text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-env">Environment Variables (.env)</Label>
              <textarea
                id="edit-env"
                value={newStackEnv}
                onChange={(e) => setNewStackEnv(e.target.value)}
                className="w-full h-24 px-3 py-2 font-mono text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateStack}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Stack Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={(open) => !isDeploying && setShowDeployDialog(open)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deploySuccess === true ? (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              ) : deploySuccess === false ? (
                <XCircle className="w-5 h-5 text-destructive" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {deploySuccess === true
                ? `Stack Deployed: ${selectedStack?.name}`
                : deploySuccess === false
                ? `Deployment Failed: ${selectedStack?.name}`
                : `Deploy Stack: ${selectedStack?.name}`}
            </DialogTitle>
            <DialogDescription>
              {deploySuccess === true
                ? "Stack is now running"
                : deploySuccess === false
                ? "Check the logs below for details"
                : "Deploy the stack to start all containers"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isDeploying && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deploying...</span>
                  <span className="text-accent">{deployProgress}%</span>
                </div>
                <Progress value={deployProgress} className="h-2" />
              </div>
            )}
            {deploySuccess === true && (
              <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-sm text-accent">Stack deployed successfully and is now running</span>
              </div>
            )}
            {deploySuccess === false && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="text-sm text-destructive">Deployment failed - see logs below</span>
              </div>
            )}
            <div
              ref={deployLogsRef}
              className="bg-muted/50 border border-border rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs"
            >
              {deployLogs.length === 0 ? (
                <span className="text-muted-foreground">
                  {isDeploying ? "Starting deployment..." : "Ready to deploy"}
                </span>
              ) : (
                deployLogs.map((log, i) => (
                  <div key={i} className="text-foreground/80 whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            {!isDeploying && deploySuccess === null && (
              <>
                <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={deployStack} className="gap-2">
                  <Play className="w-4 h-4" /> Deploy
                </Button>
              </>
            )}
            {!isDeploying && deploySuccess === true && (
              <Button onClick={() => setShowDeployDialog(false)} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Done
              </Button>
            )}
            {!isDeploying && deploySuccess === false && (
              <>
                <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
                  Close
                </Button>
                <Button onClick={deployStack} className="gap-2">
                  <Play className="w-4 h-4" /> Retry
                </Button>
              </>
            )}
            {isDeploying && (
              <Button disabled className="gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stack Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Stack
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedStack?.name}&quot;? This will stop
              and remove all containers in the stack.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteStack(false)}>
              Delete
            </Button>
            <Button variant="destructive" onClick={() => deleteStack(true)}>
              Delete + Volumes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Containers Dialog */}
      <Dialog open={showContainersDialog} onOpenChange={setShowContainersDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="w-5 h-5" />
              Stack Containers: {selectedStack?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {stackContainers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No containers running in this stack
              </div>
            ) : (
              stackContainers.map((container) => (
                <div
                  key={container.name}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {container.status === "running" ? (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{container.service}</div>
                      <div className="text-xs text-muted-foreground">{container.image}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {container.ports.map((p) => `${p.host_port}:${p.container_port}`).join(", ")}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContainersDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
