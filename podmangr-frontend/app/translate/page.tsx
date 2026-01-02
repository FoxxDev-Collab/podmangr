"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileCode2,
  Play,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowRight,
  RefreshCw,
  FileText,
  Layers,
  Server,
} from "lucide-react";

interface TransformChange {
  type: string;
  location: string;
  original: string;
  transformed: string;
  reason: string;
}

interface TranslationResult {
  output: string;
  output_format: string;
  warnings: string[];
  errors: string[];
  changes: TransformChange[];
}

interface TransformRule {
  name: string;
  description: string;
}

interface OutputFormat {
  id: string;
  name: string;
  description: string;
}

const defaultComposeExample = `version: "3.8"

services:
  web:
    image: nginx
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html
    restart: unless-stopped

  redis:
    image: redis:7
    volumes:
      - redis-data:/data
    restart: always

  app:
    image: myapp
    environment:
      - DATABASE_URL=postgres://db:5432/app
    depends_on:
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  redis-data:

networks:
  default:
    driver: bridge
`;

export default function TranslatePage() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();

  const [input, setInput] = useState(defaultComposeExample);
  const [output, setOutput] = useState("");
  const [outputFormat, setOutputFormat] = useState("podman-compose");
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [rules, setRules] = useState<TransformRule[]>([]);
  const [formats, setFormats] = useState<OutputFormat[]>([]);
  const [activeTab, setActiveTab] = useState("output");

  // Fetch available rules and formats
  const fetchRulesAndFormats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/translate/rules", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
        setFormats(data.formats || []);
      }
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetchRulesAndFormats();
    }
  }, [token, fetchRulesAndFormats]);

  const handleTranslate = async () => {
    if (!token || !input.trim()) return;

    setTranslating(true);
    setResult(null);
    setOutput("");

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: input,
          format: outputFormat,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setOutput(data.output || "");
      } else {
        setResult({
          output: "",
          output_format: outputFormat,
          warnings: data.warnings || [],
          errors: [data.error || "Translation failed"],
          changes: [],
        });
      }
    } catch (err) {
      setResult({
        output: "",
        output_format: outputFormat,
        warnings: [],
        errors: [err instanceof Error ? err.message : "Translation failed"],
        changes: [],
      });
    } finally {
      setTranslating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadOutput = () => {
    if (!output) return;

    let filename = "output";
    let mimeType = "text/plain";

    switch (outputFormat) {
      case "podman-compose":
        filename = "docker-compose.podman.yml";
        mimeType = "text/yaml";
        break;
      case "quadlet":
        filename = "container.quadlet";
        mimeType = "text/plain";
        break;
      case "kube":
        filename = "pod.yaml";
        mimeType = "text/yaml";
        break;
    }

    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "podman-compose":
        return <FileCode2 className="h-4 w-4" />;
      case "quadlet":
        return <Server className="h-4 w-4" />;
      case "kube":
        return <Layers className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout title="Translate">
      <div className="p-6 space-y-6">
        {/* Header */}
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-accent" />
                Docker Compose Translator
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Output format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        <div className="flex items-center gap-2">
                          {getFormatIcon(format.id)}
                          <span>{format.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleTranslate}
                  disabled={translating || !input.trim()}
                >
                  {translating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Translate
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Convert Docker Compose files to Podman-compatible formats with automatic transformations.
            </p>
          </CardHeader>
        </Card>

        {/* Editor and Output */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Editor */}
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-blue-400" />
                  Docker Compose Input
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput(defaultComposeExample)}
                >
                  Reset Example
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-[500px] bg-background/60 border border-border/50 rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="Paste your docker-compose.yml here..."
                spellCheck={false}
              />
            </CardContent>
          </Card>

          {/* Output Panel */}
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-green-400" />
                  {formats.find((f) => f.id === outputFormat)?.name || "Output"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(output)}
                    disabled={!output}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadOutput}
                    disabled={!output}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="output">Output</TabsTrigger>
                  <TabsTrigger value="changes">
                    Changes
                    {result && result.changes.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {result.changes.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="warnings">
                    Warnings
                    {result && (result.warnings.length > 0 || result.errors.length > 0) && (
                      <Badge
                        variant={result.errors.length > 0 ? "destructive" : "secondary"}
                        className="ml-2"
                      >
                        {result.warnings.length + result.errors.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="output" className="mt-0">
                  <textarea
                    value={output}
                    readOnly
                    className="w-full h-[440px] bg-background/60 border border-border/50 rounded-lg p-4 font-mono text-sm resize-none"
                    placeholder="Translated output will appear here..."
                  />
                </TabsContent>

                <TabsContent value="changes" className="mt-0">
                  <div className="h-[440px] overflow-auto space-y-2">
                    {result?.changes && result.changes.length > 0 ? (
                      result.changes.map((change, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border ${
                            change.type === "warning"
                              ? "bg-yellow-500/10 border-yellow-500/30"
                              : change.type === "modified"
                              ? "bg-blue-500/10 border-blue-500/30"
                              : "bg-muted/50 border-border/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant="outline"
                              className={
                                change.type === "warning"
                                  ? "border-yellow-500/50 text-yellow-500"
                                  : "border-blue-500/50 text-blue-500"
                              }
                            >
                              {change.type}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">
                              {change.location}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{change.reason}</p>
                          {change.original && (
                            <div className="text-xs font-mono">
                              <span className="text-red-400 line-through">
                                {change.original}
                              </span>
                              {change.transformed && change.transformed !== change.original && (
                                <>
                                  <span className="mx-2">→</span>
                                  <span className="text-green-400">{change.transformed}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        {result ? "No changes applied" : "Run translation to see changes"}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="warnings" className="mt-0">
                  <div className="h-[440px] overflow-auto space-y-2">
                    {result?.errors && result.errors.length > 0 && (
                      <div className="space-y-2">
                        {result.errors.map((error, i) => (
                          <div
                            key={`error-${i}`}
                            className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                          >
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                            <span className="text-sm">{error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {result?.warnings && result.warnings.length > 0 && (
                      <div className="space-y-2">
                        {result.warnings.map((warning, i) => (
                          <div
                            key={`warning-${i}`}
                            className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                          >
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <span className="text-sm">{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(!result ||
                      (result.errors.length === 0 && result.warnings.length === 0)) && (
                      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {result ? "No warnings or errors" : "Run translation to check for issues"}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Transformation Rules */}
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-accent" />
              Transformation Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.name}
                  className="p-4 bg-muted/30 border border-border/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{rule.name}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
