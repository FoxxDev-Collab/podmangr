"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, RefreshCw, Search, X } from "lucide-react";

interface Process {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  state: string;
  started: string;
}

export default function ProcessManagerPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchProcesses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/processes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProcesses(data || []);
        setError(null);
      } else {
        setError("Failed to load processes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load processes");
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
      fetchProcesses();
      const interval = setInterval(fetchProcesses, 5000);
      return () => clearInterval(interval);
    }
  }, [token, fetchProcesses]);

  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pid.toString().includes(searchTerm)
  );

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="Process Manager">
      <div className="p-6 space-y-6">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Running Processes
              </CardTitle>
              <Button onClick={fetchProcesses} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search processes..."
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
                Loading processes...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>CPU %</TableHead>
                      <TableHead>Memory %</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcesses.map((process) => (
                      <TableRow key={process.pid}>
                        <TableCell className="font-mono">{process.pid}</TableCell>
                        <TableCell className="font-medium">{process.name}</TableCell>
                        <TableCell>{process.user}</TableCell>
                        <TableCell>{process.cpu?.toFixed(1) ?? 'N/A'}</TableCell>
                        <TableCell>{process.memory?.toFixed(1) ?? 'N/A'}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            process.state === "R" ? "bg-green-500/20 text-green-500" :
                            process.state === "S" ? "bg-blue-500/20 text-blue-500" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {process.state}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filteredProcesses.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No processes found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
