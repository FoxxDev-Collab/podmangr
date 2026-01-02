"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Database,
  Plus,
  Search,
  Trash2,
  Loader2,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  Server,
  AlertCircle,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { DatabaseServerCard, DatabaseServer } from "./database-server-card";
import { CreateDatabaseServerDialog } from "./database-server-create-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DatabaseListItem {
  id: string;
  server_id: string;
  name: string;
  username: string;
  created_at: string;
  server_name?: string;
  engine?: string;
}

interface ConnectionString {
  connection_string: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface DatabasesTabProps {
  token: string;
  isAdmin: boolean;
}

export function DatabasesTab({ token, isAdmin }: DatabasesTabProps) {
  // View state
  const [view, setView] = useState<'servers' | 'databases'>('servers');
  const [selectedServer, setSelectedServer] = useState<DatabaseServer | null>(null);

  // Data state
  const [servers, setServers] = useState<DatabaseServer[]>([]);
  const [databases, setDatabases] = useState<DatabaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog state
  const [showCreateServerDialog, setShowCreateServerDialog] = useState(false);
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false);
  const [showDeleteServerDialog, setShowDeleteServerDialog] = useState(false);
  const [showDeleteDbDialog, setShowDeleteDbDialog] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseListItem | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionString | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);

  // Create database form
  const [newDbName, setNewDbName] = useState("");
  const [createDbLoading, setCreateDbLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  // Fetch servers
  const fetchServers = useCallback(async () => {
    try {
      const response = await fetch("/api/database-servers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setServers(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch database servers:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch databases for a server
  const fetchDatabases = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`/api/database-servers/${serverId}/databases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDatabases(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch databases:", error);
    }
  }, [token]);

  // Initial load and polling
  useEffect(() => {
    if (view === 'servers') {
      fetchServers();
      const interval = setInterval(fetchServers, 5000);
      return () => clearInterval(interval);
    } else if (selectedServer) {
      fetchDatabases(selectedServer.id);
      const interval = setInterval(() => fetchDatabases(selectedServer.id), 5000);
      return () => clearInterval(interval);
    }
  }, [view, selectedServer, fetchServers, fetchDatabases]);

  // Server actions
  const handleStartServer = async (server: DatabaseServer) => {
    setActionLoading(server.id);
    try {
      const response = await fetch(`/api/database-servers/${server.id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Server starting", { description: `${server.name} is starting...` });
        fetchServers();
      } else {
        const error = await response.json();
        toast.error("Failed to start server", { description: error.error });
      }
    } catch {
      toast.error("Failed to start server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopServer = async (server: DatabaseServer) => {
    setActionLoading(server.id);
    try {
      const response = await fetch(`/api/database-servers/${server.id}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Server stopping", { description: `${server.name} is stopping...` });
        fetchServers();
      } else {
        const error = await response.json();
        toast.error("Failed to stop server", { description: error.error });
      }
    } catch {
      toast.error("Failed to stop server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteServer = async () => {
    if (!selectedServer) return;
    setActionLoading(selectedServer.id);
    try {
      const response = await fetch(`/api/database-servers/${selectedServer.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Server deleted", { description: `${selectedServer.name} has been deleted` });
        setShowDeleteServerDialog(false);
        setSelectedServer(null);
        fetchServers();
      } else {
        const error = await response.json();
        toast.error("Failed to delete server", { description: error.error });
      }
    } catch {
      toast.error("Failed to delete server");
    } finally {
      setActionLoading(null);
    }
  };

  // Database actions
  const handleCreateDatabase = async () => {
    if (!selectedServer || !newDbName) return;
    setCreateDbLoading(true);
    try {
      const response = await fetch(`/api/database-servers/${selectedServer.id}/databases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newDbName }),
      });
      const data = await response.json();
      if (response.ok) {
        setCreatedPassword(data.password);
        fetchDatabases(selectedServer.id);
        // Update server database count
        fetchServers();
      } else {
        toast.error("Failed to create database", { description: data.error });
        setShowCreateDbDialog(false);
      }
    } catch {
      toast.error("Failed to create database");
    } finally {
      setCreateDbLoading(false);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!selectedServer || !selectedDatabase) return;
    try {
      const response = await fetch(
        `/api/database-servers/${selectedServer.id}/databases/${selectedDatabase.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        toast.success("Database deleted", { description: `${selectedDatabase.name} has been deleted` });
        setShowDeleteDbDialog(false);
        setSelectedDatabase(null);
        fetchDatabases(selectedServer.id);
        fetchServers();
      } else {
        const error = await response.json();
        toast.error("Failed to delete database", { description: error.error });
      }
    } catch {
      toast.error("Failed to delete database");
    }
  };

  const handleGetConnection = async (db: DatabaseListItem) => {
    setSelectedDatabase(db);
    setConnectionLoading(true);
    setShowConnectionDialog(true);
    try {
      const response = await fetch(
        `/api/database-servers/${db.server_id}/databases/${db.id}/connection`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setConnectionInfo(data);
      } else {
        const error = await response.json();
        toast.error("Failed to get connection info", { description: error.error });
        setShowConnectionDialog(false);
      }
    } catch {
      toast.error("Failed to get connection info");
      setShowConnectionDialog(false);
    } finally {
      setConnectionLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied", { description: `${label} copied to clipboard` });
  };

  // View handlers
  const handleViewDatabases = (server: DatabaseServer) => {
    setSelectedServer(server);
    setView('databases');
    setDatabases([]);
    setLoading(true);
    fetchDatabases(server.id).finally(() => setLoading(false));
  };

  const handleBackToServers = () => {
    setView('servers');
    setSelectedServer(null);
    setDatabases([]);
  };

  // Filtering
  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.engine.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDatabases = databases.filter((db) =>
    db.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToServers}
          className={view === 'servers' ? 'text-cyan-400' : 'text-muted-foreground hover:text-foreground'}
          disabled={view === 'servers'}
        >
          <Server className="w-4 h-4 mr-1" />
          Database Servers
        </Button>
        {view === 'databases' && selectedServer && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-cyan-400 flex items-center gap-1">
              <Database className="w-4 h-4" />
              {selectedServer.name}
            </span>
          </>
        )}
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={view === 'servers' ? "Search servers..." : "Search databases..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card/70 border-border/50"
          />
        </div>
        {isAdmin && (
          <Button
            onClick={() => view === 'servers' ? setShowCreateServerDialog(true) : setShowCreateDbDialog(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {view === 'servers' ? 'New Server' : 'New Database'}
          </Button>
        )}
      </div>

      {/* Back button for databases view */}
      {view === 'databases' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToServers}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Servers
        </Button>
      )}

      {/* Content */}
      {loading ? (
        <Card className="bg-card/70 border-border/50">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-cyan-400" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : view === 'servers' ? (
        // Servers Grid
        filteredServers.length === 0 ? (
          <Card className="bg-card/70 border-border/50">
            <CardContent className="py-12 text-center">
              <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Database Servers</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "No servers match your search"
                  : "Create your first database server to get started"}
              </p>
              {isAdmin && !searchTerm && (
                <Button onClick={() => setShowCreateServerDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> New Server
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServers.map((server) => (
              <DatabaseServerCard
                key={server.id}
                server={server}
                isAdmin={isAdmin}
                isLoading={actionLoading === server.id}
                onViewDatabases={() => handleViewDatabases(server)}
                onStart={() => handleStartServer(server)}
                onStop={() => handleStopServer(server)}
                onDelete={() => {
                  setSelectedServer(server);
                  setShowDeleteServerDialog(true);
                }}
              />
            ))}
          </div>
        )
      ) : (
        // Databases Grid
        filteredDatabases.length === 0 ? (
          <Card className="bg-card/70 border-border/50">
            <CardContent className="py-12 text-center">
              <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Databases</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "No databases match your search"
                  : `Create your first database in ${selectedServer?.name}`}
              </p>
              {isAdmin && !searchTerm && selectedServer?.status === 'running' && (
                <Button onClick={() => setShowCreateDbDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> New Database
                </Button>
              )}
              {selectedServer?.status !== 'running' && (
                <p className="text-sm text-amber-400 mt-2">
                  Server must be running to create databases
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDatabases.map((db) => (
              <Card key={db.id} className="relative border-border/50 bg-card/70 hover:border-cyan-500/50 transition-colors group">
                {/* Corner accents */}
                <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
                <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
                <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
                <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Database className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-medium group-hover:text-cyan-400 transition-colors">{db.name}</h3>
                        <p className="text-xs text-muted-foreground">User: {db.username}</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border/50" />

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGetConnection(db)}
                      className="flex-1 h-8 text-xs gap-1.5 hover:bg-cyan-500/10 hover:text-cyan-400"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Connection String
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDatabase(db);
                          setShowDeleteDbDialog(true);
                        }}
                        className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Create Server Dialog */}
      <CreateDatabaseServerDialog
        open={showCreateServerDialog}
        onOpenChange={setShowCreateServerDialog}
        token={token}
        onServerCreated={() => {
          fetchServers();
          setShowCreateServerDialog(false);
        }}
      />

      {/* Delete Server Dialog */}
      <Dialog open={showDeleteServerDialog} onOpenChange={setShowDeleteServerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Delete Server
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedServer?.name}&quot;? This will permanently
              remove the server, all databases within it, and all data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteServerDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteServer}
              disabled={actionLoading === selectedServer?.id}
            >
              {actionLoading === selectedServer?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Database Dialog */}
      <Dialog open={showCreateDbDialog} onOpenChange={(open) => {
        setShowCreateDbDialog(open);
        if (!open) {
          setNewDbName("");
          setCreatedPassword(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              {createdPassword ? 'Database Created' : 'Create Database'}
            </DialogTitle>
            <DialogDescription>
              {createdPassword
                ? 'Your database has been created successfully'
                : `Create a new database in ${selectedServer?.name}`}
            </DialogDescription>
          </DialogHeader>

          {createdPassword ? (
            <div className="space-y-4">
              <Alert className="border-green-500/50 bg-green-500/10">
                <Check className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  Database &quot;{newDbName}&quot; created successfully!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Database Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={createdPassword}
                      readOnly
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyPassword(createdPassword)}
                    className={passwordCopied ? 'text-green-400' : ''}
                  >
                    {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Save this password securely! It will not be shown again.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-name">Database Name</Label>
                <Input
                  id="db-name"
                  placeholder="my_database"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Alphanumeric characters and underscores only
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdPassword ? (
              <Button onClick={() => {
                setShowCreateDbDialog(false);
                setNewDbName("");
                setCreatedPassword(null);
              }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowCreateDbDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDatabase} disabled={createDbLoading || !newDbName}>
                  {createDbLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Database'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Database Dialog */}
      <Dialog open={showDeleteDbDialog} onOpenChange={setShowDeleteDbDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Delete Database
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedDatabase?.name}&quot;? This will permanently
              remove the database and all its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDbDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDatabase}>
              Delete Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection String Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              Connection Details: {selectedDatabase?.name}
            </DialogTitle>
          </DialogHeader>

          {connectionLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-cyan-400" />
            </div>
          ) : connectionInfo ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Connection String</Label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted/50 rounded text-sm font-mono break-all">
                    {connectionInfo.connection_string}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(connectionInfo.connection_string, "Connection string")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Host</Label>
                  <p className="font-mono text-sm">{connectionInfo.host}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Port</Label>
                  <p className="font-mono text-sm">{connectionInfo.port}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Database</Label>
                  <p className="font-mono text-sm">{connectionInfo.database}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Username</Label>
                  <p className="font-mono text-sm">{connectionInfo.username}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={connectionInfo.password}
                      readOnly
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(connectionInfo.password, "Password")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
