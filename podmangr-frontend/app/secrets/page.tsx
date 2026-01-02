"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SecretsTab } from "@/components/secrets-tab";
import { Key } from "lucide-react";

export default function SecretsPage() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>("");

  const hasPermission = user?.role === "admin" || user?.role === "operator" || user?.is_pam_admin;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !hasPermission) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, hasPermission, router]);

  if (isLoading || !isAuthenticated || !hasPermission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Key className="w-12 h-12 text-accent animate-pulse" />
      </div>
    );
  }

  return (
    <DashboardLayout title="SECRETS" time={time}>
      <div className="p-6 space-y-6">
        <SecretsTab token={token || ""} isAdmin={isAdmin} />
      </div>
    </DashboardLayout>
  );
}
