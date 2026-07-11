"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useAuthActions() {
  const router = useRouter();

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Failed to call logout API", e);
    }

    router.replace("/");
    router.refresh();
  }, [router]);

  return { signOut };
}
