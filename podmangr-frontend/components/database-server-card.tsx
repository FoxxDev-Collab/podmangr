"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server,
  Database,
  Play,
  Square,
  Trash2,
  ChevronRight,
  AlertCircle,
  Loader2
} from "lucide-react";

export interface DatabaseServer {
  id: string;
  container_id: string;
  name: string;
  engine: 'postgresql' | 'mariadb' | 'mysql';
  version: string;
  network: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'unknown';
  internal_port: number;
  created_at: string;
  database_count: number;
}

interface DatabaseServerCardProps {
  server: DatabaseServer;
  isAdmin: boolean;
  onViewDatabases: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export function DatabaseServerCard({
  server,
  isAdmin,
  onViewDatabases,
  onStart,
  onStop,
  onDelete,
  isLoading
}: DatabaseServerCardProps) {
  // Engine colors and labels
  const getEngineInfo = (engine: string) => {
    switch (engine) {
      case 'postgresql':
        return { color: 'text-blue-400', bgColor: 'bg-blue-500/10', label: 'PostgreSQL', icon: '🐘' };
      case 'mariadb':
        return { color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'MariaDB', icon: '🦭' };
      case 'mysql':
        return { color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: 'MySQL', icon: '🐬' };
      default:
        return { color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: 'Database', icon: '💾' };
    }
  };

  // Status badge variants
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'running':
        return {
          label: 'Running',
          className: 'bg-green-500/10 text-green-400 border-green-500/50',
          indicator: 'bg-green-500',
          animated: true,
        };
      case 'stopped':
        return {
          label: 'Stopped',
          className: 'bg-gray-500/10 text-gray-400 border-gray-500/50',
          indicator: 'bg-gray-500',
          animated: false,
        };
      case 'starting':
        return {
          label: 'Starting',
          className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50',
          indicator: 'bg-cyan-500',
          animated: true,
        };
      case 'stopping':
        return {
          label: 'Stopping',
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/50',
          indicator: 'bg-amber-500',
          animated: true,
        };
      case 'error':
        return {
          label: 'Error',
          className: 'bg-red-500/10 text-red-400 border-red-500/50',
          indicator: 'bg-red-500',
          animated: true,
        };
      default:
        return {
          label: 'Unknown',
          className: 'bg-muted/50 text-muted-foreground border-border/50',
          indicator: 'bg-muted-foreground',
          animated: false,
        };
    }
  };

  const engineInfo = getEngineInfo(server.engine);
  const statusInfo = getStatusInfo(server.status);
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';

  return (
    <Card className="relative border-border/50 bg-card/70 transition-all duration-200 hover:bg-card/90 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] group">
      {/* Corner accents */}
      <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
      <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
      <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />
      <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-cyan-500/40 transition-colors group-hover:border-cyan-500/70" />

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div
              className={`
                relative w-12 h-12 flex items-center justify-center rounded-lg
                border-2 border-border/60 ${engineInfo.bgColor}
                transition-all duration-200 group-hover:border-cyan-500/50
              `}
            >
              <Server className={`w-6 h-6 ${engineInfo.color}`} />

              {/* Status indicator */}
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusInfo.indicator} border-2 border-background`}>
                {statusInfo.animated && (
                  <div className={`absolute inset-0 rounded-full ${statusInfo.indicator} animate-ping opacity-75`} />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate group-hover:text-cyan-400 transition-colors">
                {server.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {engineInfo.label} {server.version}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <Badge variant="outline" className={`${statusInfo.className} text-xs shrink-0 gap-1.5`}>
            {isTransitioning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : server.status === 'error' ? (
              <AlertCircle className="w-3 h-3" />
            ) : null}
            {statusInfo.label}
          </Badge>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="w-3.5 h-3.5 text-cyan-400/70" />
            <span>
              <span className="font-mono text-cyan-400">{server.database_count}</span> database{server.database_count !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Port <span className="font-mono text-muted-foreground">{server.internal_port}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {/* View Databases */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDatabases}
            className="flex-1 h-8 text-xs gap-1.5 hover:bg-cyan-500/10 hover:text-cyan-400"
          >
            <Database className="w-3.5 h-3.5" />
            View Databases
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </Button>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              {server.status === 'stopped' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStart}
                  disabled={isLoading || isTransitioning}
                  className="h-8 w-8 hover:bg-green-500/10 hover:text-green-400"
                  title="Start Server"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </Button>
              ) : server.status === 'running' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStop}
                  disabled={isLoading || isTransitioning}
                  className="h-8 w-8 hover:bg-amber-500/10 hover:text-amber-400"
                  title="Stop Server"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </Button>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                disabled={isLoading || isTransitioning}
                className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400"
                title="Delete Server"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
