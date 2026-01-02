"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to container manager as the default landing page
    router.push("/container-manager");
  }, [router]);

  return null;
}
