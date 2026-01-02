"use client";

import { useEffect, useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Key,
  Plus,
  Search,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Database,
  Link,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Secret {
  id: string;
  container_id?: string;
  container_name?: string;
  name: string;
  secret_type: string;
  category?: string;
  description?: string;
  created_at: string;
}

interface SecretWithValue extends Secret {
  value: string;
  metadata?: string;
}

interface SecretsTabProps {
  token: string;
  isAdmin: boolean;
}

export function SecretsTab({ token, isAdmin }: SecretsTabProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Reveal dialog state
  const [revealedSecret, setRevealedSecret] = useState<SecretWithValue | null>(null);
  const [showRevealDialog, setShowRevealDialog] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newSecret, setNewSecret] = useState({
    name: "",
    value: "",
    secret_type: "password",
    category: "",
    description: "",
    container_name: "",
  });

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);

  const fetchSecrets = useCallback(async () => {
    try {
      const response = await fetch("/api/secrets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSecrets(data || []);
      }
    } catch {
      toast.error("Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const handleReveal = async (secret: Secret) => {
    setSelectedSecret(secret);
    setRevealLoading(true);
    setShowRevealDialog(true);
    setShowValue(false);

    try {
      const response = await fetch(`/api/secrets/${secret.id}/reveal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRevealedSecret(data);
      } else {
        toast.error("Failed to reveal secret");
        setShowRevealDialog(false);
      }
    } catch {
      toast.error("Failed to reveal secret");
      setShowRevealDialog(false);
    } finally {
      setRevealLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newSecret.name || !newSecret.value) {
      toast.error("Name and value are required");
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSecret.name,
          value: newSecret.value,
          secret_type: newSecret.secret_type,
          category: newSecret.category || undefined,
          description: newSecret.description || undefined,
          container_name: newSecret.container_name || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Secret created");
        setShowCreateDialog(false);
        setNewSecret({
          name: "",
          value: "",
          secret_type: "password",
          category: "",
          description: "",
          container_name: "",
        });
        fetchSecrets();
      } else {
        const error = await response.json();
        toast.error("Failed to create secret", { description: error.error });
      }
    } catch {
      toast.error("Failed to create secret");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSecret) return;

    try {
      const response = await fetch(`/api/secrets/${selectedSecret.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Secret deleted");
        setShowDeleteDialog(false);
        setSelectedSecret(null);
        fetchSecrets();
      } else {
        toast.error("Failed to delete secret");
      }
    } catch {
      toast.error("Failed to delete secret");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied to clipboard");
  };

  const getSecretTypeIcon = (type: string) => {
    switch (type) {
      case "password":
        return <Lock className="w-4 h-4" />;
      case "connection_string":
        return <Link className="w-4 h-4" />;
      case "api_key":
        return <Key className="w-4 h-4" />;
      default:
        return <Key className="w-4 h-4" />;
    }
  };

  const getSecretTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      password: "bg-red-500/10 text-red-400",
      connection_string: "bg-blue-500/10 text-blue-400",
      api_key: "bg-amber-500/10 text-amber-400",
      env_var: "bg-green-500/10 text-green-400",
      certificate: "bg-purple-500/10 text-purple-400",
    };
    return variants[type] || "bg-gray-500/10 text-gray-400";
  };

  // Get unique categories
  const categories = Array.from(new Set(secrets.map(s => s.category).filter(Boolean)));

  // Filter secrets
  const filteredSecrets = secrets.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.container_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group secrets by container
  const groupedSecrets = filteredSecrets.reduce((acc, secret) => {
    const key = secret.container_name || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(secret);
    return acc;
  }, {} as Record<string, Secret[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6 text-amber-400" />
            Secrets Store
          </h2>
          <p className="text-muted-foreground">
            Securely stored credentials and secrets for your containers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchSecrets}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Secret
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search secrets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {categories.length > 0 && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Secrets List */}
      {filteredSecrets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-1">No secrets found</h3>
            <p className="text-muted-foreground">
              {secrets.length === 0
                ? "Create database servers to automatically store credentials"
                : "No secrets match your search criteria"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSecrets).map(([containerName, containerSecrets]) => (
            <Card key={containerName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  {containerName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {containerSecrets.map(secret => (
                    <div
                      key={secret.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getSecretTypeBadge(secret.secret_type)}`}>
                          {getSecretTypeIcon(secret.secret_type)}
                        </div>
                        <div>
                          <div className="font-medium">{secret.name}</div>
                          {secret.description && (
                            <div className="text-sm text-muted-foreground">{secret.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getSecretTypeBadge(secret.secret_type)}>
                          {secret.secret_type.replace("_", " ")}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleReveal(secret)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Reveal
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedSecret(secret);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reveal Dialog */}
      <Dialog open={showRevealDialog} onOpenChange={setShowRevealDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              {selectedSecret?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedSecret?.description || "Secret value"}
            </DialogDescription>
          </DialogHeader>

          {revealLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : revealedSecret ? (
            <div className="space-y-4">
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-amber-400">
                  Handle this secret carefully. Do not share or expose it.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Value</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showValue ? "text" : "password"}
                      value={revealedSecret.value}
                      readOnly
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowValue(!showValue)}
                    >
                      {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(revealedSecret.value, "value")}
                  >
                    {copied === "value" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {revealedSecret.metadata && (() => {
                try {
                  const meta = JSON.parse(revealedSecret.metadata);
                  if (meta.connection_string) {
                    return (
                      <div className="space-y-2">
                        <Label>Connection String</Label>
                        <div className="flex gap-2">
                          <Input
                            type={showValue ? "text" : "password"}
                            value={meta.connection_string}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(meta.connection_string, "conn")}
                          >
                            {copied === "conn" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                } catch {
                  return null;
                }
              })()}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setShowRevealDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Secret</DialogTitle>
            <DialogDescription>
              Store a new secret securely
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., API Key"
                value={newSecret.name}
                onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="password"
                placeholder="Secret value"
                value={newSecret.value}
                onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newSecret.secret_type}
                onValueChange={(v) => setNewSecret({ ...newSecret, secret_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="connection_string">Connection String</SelectItem>
                  <SelectItem value="env_var">Environment Variable</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Container (optional)</Label>
              <Input
                placeholder="Container name"
                value={newSecret.container_name}
                onChange={(e) => setNewSecret({ ...newSecret, container_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Brief description"
                value={newSecret.description}
                onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedSecret?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
