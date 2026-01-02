"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_pam_user: boolean;
  created_at: string;
}

export default function UserManagerPage() {
  const { isAuthenticated, isLoading, token, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === "admin";

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data || []);
        setError(null);
      } else {
        setError("Failed to load users");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && currentUser?.role !== "admin") {
      router.push("/container-manager");
    }
  }, [isAuthenticated, isLoading, currentUser, router]);

  useEffect(() => {
    if (token && isAdmin) {
      fetchUsers();
    }
  }, [token, isAdmin, fetchUsers]);

  if (isLoading || !isAuthenticated || !isAdmin) return null;

  return (
    <DashboardLayout title="User Manager">
      <div className="p-6 space-y-6">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                System Users
              </CardTitle>
              <Button onClick={fetchUsers} size="sm" variant="outline">
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
                Loading users...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono">{user.id}</TableCell>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.display_name}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "operator" ? "secondary" :
                            "outline"
                          }>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.is_pam_user ? (
                            <Badge variant="outline">PAM</Badge>
                          ) : (
                            <Badge variant="outline">Local</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && users.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No users found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
