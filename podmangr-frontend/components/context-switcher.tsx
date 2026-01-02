"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Server, User, ChevronDown, RefreshCw, Check } from "lucide-react";

interface PodmanSocket {
  id: string;
  path: string;
  user: string;
  uid: number;
  mode: string;
  accessible: boolean;
  active: boolean;
}

interface SocketsResponse {
  sockets: PodmanSocket[];
  current: {
    id: string;
    mode: string;
    target_user: string;
    running_as_root: boolean;
  };
}

export function ContextSwitcher() {
  const { token, user } = useAuth();
  const [sockets, setSockets] = useState<PodmanSocket[]>([]);
  const [currentSocket, setCurrentSocket] = useState<string>("");
  const [currentMode, setCurrentMode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isAdmin = user?.role === "admin" || user?.is_pam_admin;

  const fetchSockets = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch("/api/podman-sockets", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: SocketsResponse = await response.json();
        setSockets(data.sockets || []);
        setCurrentSocket(data.current?.id || "");
        setCurrentMode(data.current?.mode || "");
      }
    } catch (err) {
      console.error("Failed to fetch sockets:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSockets();
  }, [fetchSockets]);

  const handleSwitch = async (socketId: string) => {
    if (!token || !isAdmin || socketId === currentSocket) return;

    setSwitching(true);
    try {
      const response = await fetch("/api/podman-sockets/switch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ socket_id: socketId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSocket(data.current?.id || socketId);
        setCurrentMode(data.current?.mode || "");
        // Trigger page refresh to reload data with new context
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to switch socket:", err);
    } finally {
      setSwitching(false);
    }
  };

  const handleRefresh = async () => {
    if (!token || !isAdmin) return;

    setLoading(true);
    try {
      const response = await fetch("/api/podman-sockets/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: SocketsResponse = await response.json();
        setSockets(data.sockets || []);
        setCurrentSocket(data.current?.id || "");
        setCurrentMode(data.current?.mode || "");
      }
    } catch (err) {
      console.error("Failed to refresh sockets:", err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no sockets or only one socket
  if (sockets.length <= 1) {
    return null;
  }

  const currentSocketInfo = sockets.find((s) => s.id === currentSocket);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading || switching}
        >
          {currentMode === "rootful" ? (
            <Server className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {currentSocketInfo?.user || currentMode || "Select Context"}
          </span>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentMode === "rootful"
                ? "bg-red-500/20 text-red-400 border-red-500/40"
                : "bg-green-500/20 text-green-400 border-green-500/40"
            }`}
          >
            {currentMode === "rootful" ? "root" : "rootless"}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Podman Context</span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sockets.map((socket) => (
          <DropdownMenuItem
            key={socket.id}
            onClick={() => handleSwitch(socket.id)}
            disabled={!socket.accessible || !isAdmin || switching}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {socket.mode === "rootful" ? (
                <Server className="h-4 w-4 text-red-400" />
              ) : (
                <User className="h-4 w-4 text-green-400" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{socket.user}</span>
                <span className="text-xs text-muted-foreground">
                  {socket.mode === "rootful" ? "System (root)" : `UID ${socket.uid}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {socket.active && <Check className="h-4 w-4 text-accent" />}
              {!socket.accessible && (
                <Badge variant="outline" className="text-xs">
                  No access
                </Badge>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {!isAdmin && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Admin required to switch contexts
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
