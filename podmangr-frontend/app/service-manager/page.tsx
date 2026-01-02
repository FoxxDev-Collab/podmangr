"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, RefreshCw, Search, X, Play, Square, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface Service {
  name: string;
  description: string;
  load_state: string;
  active_state: string;
  sub_state: string;
}

export default function ServiceManagerPage() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isOperatorOrAdmin = user?.role === "admin" || user?.role === "operator";

  const fetchServices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/services", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setServices(data || []);
        setError(null);
      } else {
        setError("Failed to load services");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const serviceAction = async (serviceName: string, action: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/services/${serviceName}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success(`Service ${action} successful`);
        fetchServices();
      } else {
        const data = await response.json();
        toast.error(data.error || `Failed to ${action} service`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} service`);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetchServices();
    }
  }, [token, fetchServices]);

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="Service Manager">
      <div className="p-6 space-y-6">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-accent" />
                System Services
              </CardTitle>
              <Button onClick={fetchServices} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
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
              <div className="text-destructive text-sm">{error}</div>
            )}

            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading services...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Load</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Sub</TableHead>
                      {isOperatorOrAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.name}>
                        <TableCell className="font-mono text-sm">{service.name}</TableCell>
                        <TableCell className="text-sm">{service.description}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            service.load_state === "loaded" ? "bg-green-500/20 text-green-500" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {service.load_state}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            service.active_state === "active" ? "bg-green-500/20 text-green-500" :
                            service.active_state === "failed" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {service.active_state}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {service.sub_state}
                        </TableCell>
                        {isOperatorOrAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => serviceAction(service.name, "start")}
                                title="Start"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => serviceAction(service.name, "stop")}
                                title="Stop"
                              >
                                <Square className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => serviceAction(service.name, "restart")}
                                title="Restart"
                              >
                                <RotateCw className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filteredServices.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No services found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
