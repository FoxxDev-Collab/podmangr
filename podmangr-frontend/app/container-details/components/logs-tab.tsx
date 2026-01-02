"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Download,
  Search,
  RotateCw,
  Pause,
  Play,
  Copy,
  Check,
  Loader2,
  Filter,
  WrapText,
  Regex,
  Trash2,
  FileJson,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Zap,
} from "lucide-react";

interface LogsTabProps {
  containerId: string;
  containerName?: string;
}

type LogLevel = "all" | "error" | "warn" | "info" | "debug";

interface ParsedLog {
  raw: string;
  timestamp?: string;
  level?: LogLevel;
  message: string;
  isJson: boolean;
  jsonData?: Record<string, unknown>;
}

export function LogsTab({ containerId, containerName }: LogsTabProps) {
  const { token } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [following, setFollowing] = useState(false);
  const [tailLines, setTailLines] = useState("500");
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevel>("all");
  const [expandedJsonLines, setExpandedJsonLines] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse logs to extract metadata
  const parsedLogs = useMemo((): ParsedLog[] => {
    return logs.map((log) => {
      const parsed: ParsedLog = {
        raw: log,
        message: log,
        isJson: false,
      };

      // Try to detect timestamp at start (common formats)
      const timestampMatch = log.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s*/);
      if (timestampMatch) {
        parsed.timestamp = timestampMatch[1];
        parsed.message = log.slice(timestampMatch[0].length);
      }

      // Try to detect log level
      const levelMatch = parsed.message.match(/\b(ERROR|ERRO|ERR|FATAL|WARN|WARNING|INFO|DEBUG|DBG|TRACE)\b/i);
      if (levelMatch) {
        const level = levelMatch[1].toUpperCase();
        if (["ERROR", "ERRO", "ERR", "FATAL"].includes(level)) parsed.level = "error";
        else if (["WARN", "WARNING"].includes(level)) parsed.level = "warn";
        else if (level === "INFO") parsed.level = "info";
        else if (["DEBUG", "DBG", "TRACE"].includes(level)) parsed.level = "debug";
      }

      // Try to parse JSON logs
      try {
        const jsonStart = parsed.message.indexOf("{");
        if (jsonStart !== -1) {
          const jsonStr = parsed.message.slice(jsonStart);
          const jsonData = JSON.parse(jsonStr);
          parsed.isJson = true;
          parsed.jsonData = jsonData;

          // Extract level from JSON if not already found
          if (!parsed.level && jsonData.level) {
            const jLevel = String(jsonData.level).toLowerCase();
            if (jLevel.includes("err") || jLevel.includes("fatal")) parsed.level = "error";
            else if (jLevel.includes("warn")) parsed.level = "warn";
            else if (jLevel.includes("info")) parsed.level = "info";
            else if (jLevel.includes("debug") || jLevel.includes("trace")) parsed.level = "debug";
          }
        }
      } catch {
        // Not JSON, that's fine
      }

      return parsed;
    });
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let result = parsedLogs;

    // Level filter
    if (logLevelFilter !== "all") {
      result = result.filter((log) => log.level === logLevelFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      if (useRegex) {
        try {
          const regex = new RegExp(searchTerm, "gi");
          setRegexError(null);
          result = result.filter((log) => regex.test(log.raw));
        } catch (e) {
          setRegexError(e instanceof Error ? e.message : "Invalid regex");
        }
      } else {
        const term = searchTerm.toLowerCase();
        result = result.filter((log) => log.raw.toLowerCase().includes(term));
      }
    } else {
      setRegexError(null);
    }

    return result;
  }, [parsedLogs, searchTerm, useRegex, logLevelFilter]);

  // Stats
  const stats = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0, other: 0 };
    parsedLogs.forEach((log) => {
      if (log.level && log.level !== "all") counts[log.level]++;
      else counts.other++;
    });
    return counts;
  }, [parsedLogs]);

  const fetchLogs = useCallback(async () => {
    if (!token || !containerId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        tail: tailLines,
        timestamps: showTimestamps.toString(),
      });

      const response = await fetch(
        `/api/containers/${containerId}/logs?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [token, containerId, tailLines, showTimestamps]);

  const startFollowing = useCallback(() => {
    if (!containerId || !token) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/containers/${containerId}/logs/stream`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      setFollowing(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "log" || data.line) {
          setLogs((prev) => [...prev, data.line || data.message || event.data]);
        }
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    };

    ws.onerror = () => {
      setFollowing(false);
    };

    ws.onclose = () => {
      setFollowing(false);
      wsRef.current = null;
    };
  }, [containerId, token]);

  const stopFollowing = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setFollowing(false);
  }, []);

  useEffect(() => {
    fetchLogs();
    return () => {
      stopFollowing();
    };
  }, [fetchLogs, stopFollowing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to clear search
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchTerm("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDownload = (format: "txt" | "json") => {
    if (format === "json") {
      const jsonLogs = filteredLogs.map((log, i) => ({
        line: i + 1,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        raw: log.raw,
        ...(log.jsonData ? { data: log.jsonData } : {}),
      }));
      const blob = new Blob([JSON.stringify(jsonLogs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${containerName || containerId}-logs.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([logs.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${containerName || containerId}-logs.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(filteredLogs.map((l) => l.raw).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setExpandedJsonLines(new Set());
  };

  const handleRefresh = () => {
    stopFollowing();
    fetchLogs();
  };

  const toggleFollow = () => {
    if (following) {
      stopFollowing();
    } else {
      startFollowing();
    }
  };

  const toggleJsonExpand = (index: number) => {
    setExpandedJsonLines((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getLevelIcon = (level?: LogLevel) => {
    switch (level) {
      case "error": return <AlertCircle className="w-3 h-3 text-red-400" />;
      case "warn": return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
      case "info": return <Info className="w-3 h-3 text-blue-400" />;
      case "debug": return <Bug className="w-3 h-3 text-purple-400" />;
      default: return null;
    }
  };

  const getLevelColor = (level?: LogLevel) => {
    switch (level) {
      case "error": return "text-red-400";
      case "warn": return "text-yellow-400";
      case "info": return "text-blue-400";
      case "debug": return "text-purple-400";
      default: return "text-gray-300";
    }
  };

  const highlightSearch = (text: string) => {
    if (!searchTerm.trim()) return text;

    try {
      const regex = useRegex ? new RegExp(`(${searchTerm})`, "gi") : new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-yellow-500/40 text-yellow-200 rounded px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch {
      return text;
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col rounded-lg overflow-hidden border border-border/30">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-card/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Container Logs</span>
              {containerName && (
                <span className="text-sm text-muted-foreground">{containerName}</span>
              )}
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-xs gap-1">
              {filteredLogs.length} / {logs.length}
            </Badge>
            {stats.error > 0 && (
              <Badge variant="outline" className="font-mono text-xs gap-1 border-red-500/30 text-red-400">
                <AlertCircle className="w-3 h-3" /> {stats.error}
              </Badge>
            )}
            {stats.warn > 0 && (
              <Badge variant="outline" className="font-mono text-xs gap-1 border-yellow-500/30 text-yellow-400">
                <AlertTriangle className="w-3 h-3" /> {stats.warn}
              </Badge>
            )}
            {following && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                <Zap className="w-3 h-3" /> Live
              </Badge>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={useRegex ? "Search with regex..." : "Search logs... (Ctrl+F)"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-10 ${regexError ? "border-red-500" : ""}`}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 ${useRegex ? "text-accent" : "text-muted-foreground"}`}
                    onClick={() => setUseRegex(!useRegex)}
                  >
                    <Regex className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {useRegex ? "Regex mode enabled" : "Enable regex search"}
                </TooltipContent>
              </Tooltip>
            </div>
            {regexError && (
              <span className="text-xs text-red-400">{regexError}</span>
            )}

            {/* Level filter */}
            <Select value={logLevelFilter} onValueChange={(v) => setLogLevelFilter(v as LogLevel)}>
              <SelectTrigger className="w-[130px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-red-400" /> Errors
                  </span>
                </SelectItem>
                <SelectItem value="warn">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" /> Warnings
                  </span>
                </SelectItem>
                <SelectItem value="info">
                  <span className="flex items-center gap-2">
                    <Info className="w-3 h-3 text-blue-400" /> Info
                  </span>
                </SelectItem>
                <SelectItem value="debug">
                  <span className="flex items-center gap-2">
                    <Bug className="w-3 h-3 text-purple-400" /> Debug
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Tail lines */}
            <Select value={tailLines} onValueChange={setTailLines}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">Last 100</SelectItem>
                <SelectItem value="500">Last 500</SelectItem>
                <SelectItem value="1000">Last 1,000</SelectItem>
                <SelectItem value="5000">Last 5,000</SelectItem>
                <SelectItem value="all">All lines</SelectItem>
              </SelectContent>
            </Select>

            {/* Follow button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFollow}
                  className={following ? "bg-green-500/20 border-green-500/30 text-green-400" : ""}
                >
                  {following ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {following ? "Stop" : "Follow"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stream logs in real-time</TooltipContent>
            </Tooltip>

            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>

            <Button variant="outline" size="sm" onClick={handleCopyAll}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy"}
            </Button>

            {/* Download dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleDownload("txt")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download as .txt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("json")}>
                  <FileJson className="w-4 h-4 mr-2" />
                  Download as .json
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleClearLogs}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear logs from view</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Switch id="auto-scroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
              <Label htmlFor="auto-scroll" className="text-sm cursor-pointer">Auto-scroll</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} />
              <Label htmlFor="timestamps" className="text-sm cursor-pointer">Timestamps</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="wrap-lines" checked={wrapLines} onCheckedChange={setWrapLines} />
              <Label htmlFor="wrap-lines" className="text-sm cursor-pointer flex items-center gap-1">
                <WrapText className="w-3 h-3" /> Wrap
              </Label>
            </div>
          </div>
        </div>

        {/* Logs Display */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-2 bg-[#0d1117] font-mono text-xs min-h-0"
        >
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-2">{error}</div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm || logLevelFilter !== "all" ? "No logs match your filters" : "No logs available"}
            </div>
          ) : (
            <div className="space-y-0">
              {filteredLogs.map((log, index) => {
                const isExpanded = expandedJsonLines.has(index);

                return (
                  <div
                    key={index}
                    className={`group flex hover:bg-white/5 rounded transition-colors ${wrapLines ? "" : "whitespace-nowrap"}`}
                  >
                    {/* Line number */}
                    <span className="select-none text-muted-foreground/50 w-12 flex-shrink-0 text-right pr-3 py-0.5 border-r border-border/20 mr-2">
                      {index + 1}
                    </span>

                    {/* Level icon */}
                    <span className="w-5 flex-shrink-0 py-0.5">
                      {getLevelIcon(log.level)}
                    </span>

                    {/* Log content */}
                    <div className={`flex-1 py-0.5 ${wrapLines ? "break-all" : "overflow-hidden"}`}>
                      {/* Timestamp */}
                      {log.timestamp && showTimestamps && (
                        <span className="text-muted-foreground/70 mr-2">
                          {log.timestamp}
                        </span>
                      )}

                      {/* Message */}
                      <span className={getLevelColor(log.level)}>
                        {highlightSearch(log.isJson && !showTimestamps ? log.raw : log.message)}
                      </span>

                      {/* JSON expand button */}
                      {log.isJson && log.jsonData && (
                        <button
                          onClick={() => toggleJsonExpand(index)}
                          className="ml-2 text-accent hover:text-accent/80 text-[10px] uppercase font-semibold"
                        >
                          {isExpanded ? "Collapse" : "Expand JSON"}
                        </button>
                      )}

                      {/* Expanded JSON */}
                      {log.isJson && log.jsonData && isExpanded && (
                        <pre className="mt-1 p-2 bg-black/50 rounded border border-border/30 text-[11px] overflow-x-auto">
                          {JSON.stringify(log.jsonData, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {following ? "Streaming live logs..." : `Showing ${filteredLogs.length} of ${logs.length} lines`}
          </span>
          <span className="text-muted-foreground/60">
            Ctrl+F to search • Esc to clear
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
