"use client";

import { useEffect, useState } from "react";

interface Pet365User {
  id: string;
  username: string;
  avatar_url?: string | null;
  email?: string | null;
  isAdmin?: boolean;
}

/**
 * Pet365Care 인증 훅 — Alopop의 localStorage('alo_user') 기반 인증을
 * 기존 Pet365Care의 useAuth() 인터페이스로 래핑합니다.
 */
export function usePet365Auth() {
  const [user, setUser] = useState<Pet365User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("alo_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    window.location.href = "/";
  };

  return { user, loading, logout };
}
