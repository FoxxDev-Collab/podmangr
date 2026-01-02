"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Server,
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Database,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EngineConfig {
  engine: string;
  name: string;
  default_image: string;
  default_port: number;
  versions: string[];
}

interface Network {
  id: string;
  name: string;
  driver: string;
}

interface CreateDatabaseServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onServerCreated?: () => void;
}

export function CreateDatabaseServerDialog({
  open,
  onOpenChange,
  token,
  onServerCreated,
}: CreateDatabaseServerDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingEngines, setLoadingEngines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engines, setEngines] = useState<EngineConfig[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  // Form state
  const [selectedEngine, setSelectedEngine] = useState<string>('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [network, setNetwork] = useState('podmangr-db');

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedEngine('');
    setName('');
    setVersion('');
    setNetwork('podmangr-db');
    setError(null);
    setPasswordCopied(false);
    setCreatedPassword(null);
  }, []);

  const fetchEngines = useCallback(async () => {
    setLoadingEngines(true);
    setError(null);
    try {
      const response = await fetch('/api/database-servers/engines', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch database engines');
      }
      const data = await response.json();
      setEngines(data.engines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database engines');
    } finally {
      setLoadingEngines(false);
    }
  }, [token]);

  const fetchNetworks = useCallback(async () => {
    try {
      const response = await fetch('/api/podman-networks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNetworks(data || []);
      }
    } catch {
      // Silently fail - networks are optional
    }
  }, [token]);

  // Fetch engine configs when dialog opens
  useEffect(() => {
    if (open) {
      fetchEngines();
      fetchNetworks();
    } else {
      resetForm();
    }
  }, [open, fetchEngines, fetchNetworks, resetForm]);

  const validateName = (name: string): boolean => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(name) && name.length > 0 && name.length <= 64;
  };

  const handleNextStep = () => {
    setError(null);

    if (step === 1) {
      if (!selectedEngine) {
        setError('Please select a database engine');
        return;
      }
      // Set default version when moving to step 2
      const engine = engines.find((e) => e.engine === selectedEngine);
      if (engine && !version && engine.versions.length > 0) {
        setVersion(engine.versions[0]);
      }
      setStep(2);
    }
  };

  const handlePreviousStep = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    setError(null);

    if (!name) {
      setError('Server name is required');
      return;
    }
    if (!validateName(name)) {
      setError('Server name must contain only alphanumeric characters, dashes, and underscores (max 64 chars)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/database-servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          engine: selectedEngine,
          version: version || undefined,
          network: network || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create database server');
      }

      // Store the root password to show to user
      setCreatedPassword(data.root_password);
      setStep(3); // Move to success step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create database server');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (step === 3 && onServerCreated) {
      onServerCreated();
    }
    onOpenChange(false);
  };

  const selectedEngineConfig = engines.find((e) => e.engine === selectedEngine);

  const getEngineInfo = (engine: string) => {
    switch (engine) {
      case 'postgresql':
        return { color: 'text-blue-400', bgColor: 'bg-blue-500/10', description: 'Advanced open-source database with powerful features' };
      case 'mariadb':
        return { color: 'text-amber-400', bgColor: 'bg-amber-500/10', description: 'Community-developed MySQL fork with enhanced features' };
      case 'mysql':
        return { color: 'text-orange-400', bgColor: 'bg-orange-500/10', description: 'Popular open-source relational database' };
      default:
        return { color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', description: 'Database server' };
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            {step === 3 ? 'Server Created' : 'Create Database Server'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Choose the database engine for your server'}
            {step === 2 && 'Configure your database server settings'}
            {step === 3 && 'Your database server has been created'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Select Engine */}
        {step === 1 && (
          <div className="space-y-4">
            {loadingEngines ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RadioGroup value={selectedEngine} onValueChange={setSelectedEngine}>
                <div className="grid gap-3">
                  {engines.map((engine) => {
                    const info = getEngineInfo(engine.engine);
                    return (
                      <div key={engine.engine}>
                        <RadioGroupItem
                          value={engine.engine}
                          id={engine.engine}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={engine.engine}
                          className={`
                            flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer
                            transition-all duration-200
                            ${selectedEngine === engine.engine
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-border hover:border-cyan-500/50 hover:bg-card/80'
                            }
                          `}
                        >
                          <div className={`w-12 h-12 rounded-lg ${info.bgColor} flex items-center justify-center`}>
                            <Database className={`w-6 h-6 ${info.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{engine.name}</div>
                            <div className="text-xs text-muted-foreground">{info.description}</div>
                          </div>
                          {selectedEngine === engine.engine && (
                            <Check className="w-5 h-5 text-cyan-400" />
                          )}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            )}
          </div>
        )}

        {/* Step 2: Configure Server */}
        {step === 2 && selectedEngineConfig && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                placeholder="my-postgres-server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric characters, dashes, and underscores only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger id="version">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {selectedEngineConfig.versions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {selectedEngineConfig.name} {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="network">Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger id="network">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="podmangr-db">
                    podmangr-db (default)
                  </SelectItem>
                  {networks.filter(n => n.name !== 'podmangr-db').map((n) => (
                    <SelectItem key={n.name} value={n.name}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Containers on the same network can connect to this server
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Success - Show Password */}
        {step === 3 && createdPassword && (
          <div className="space-y-4">
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-400">
                Database server created and started successfully!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Root Password</Label>
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
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                  className={passwordCopied ? 'text-green-400' : ''}
                >
                  {passwordCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
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
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleNextStep} disabled={!selectedEngine}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={handlePreviousStep}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleCreate} disabled={loading || !name}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Server
                    <Check className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 3 && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
