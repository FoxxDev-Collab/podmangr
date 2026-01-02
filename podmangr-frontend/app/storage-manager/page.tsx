"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardDrive, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Disk {
  name: string;
  size: number;
  model: string;
  type: string;
}

interface Mount {
  device: string;
  mountpoint: string;
  fstype: string;
  size: number;
  used: number;
  available: number;
  use_percent: number;
}

export default function StorageManagerPage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [disks, setDisks] = useState<Disk[]>([]);
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const fetchStorage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [disksRes, mountsRes] = await Promise.all([
        fetch("/api/storage/disks", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/storage/mounts", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (disksRes.ok && mountsRes.ok) {
        setDisks(await disksRes.json() || []);
        setMounts(await mountsRes.json() || []);
        setError(null);
      } else {
        setError("Failed to load storage information");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load storage");
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
      fetchStorage();
    }
  }, [token, fetchStorage]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="Storage Manager">
      <div className="p-6 space-y-6">
        {/* Disks */}
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-accent" />
                Physical Disks
              </CardTitle>
              <Button onClick={fetchStorage} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-destructive text-sm mb-4">{error}</div>
            )}

            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading disks...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disks.map((disk) => (
                      <TableRow key={disk.name}>
                        <TableCell className="font-mono">{disk.name}</TableCell>
                        <TableCell>{disk.model || "N/A"}</TableCell>
                        <TableCell>{disk.type}</TableCell>
                        <TableCell>{formatBytes(disk.size)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && disks.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No disks found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mounts */}
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-accent" />
              Mounted Filesystems
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading mounts...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Mount Point</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mounts.map((mount, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{mount.device}</TableCell>
                        <TableCell className="font-medium">{mount.mountpoint}</TableCell>
                        <TableCell className="text-sm">{mount.fstype}</TableCell>
                        <TableCell>{formatBytes(mount.size)}</TableCell>
                        <TableCell>{formatBytes(mount.used)}</TableCell>
                        <TableCell>{formatBytes(mount.available)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={mount.use_percent} className="w-20" />
                            <span className="text-sm text-muted-foreground">{mount.use_percent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && mounts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No mounts found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
