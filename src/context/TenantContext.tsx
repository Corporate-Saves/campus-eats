"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type TenantInstitution = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
};

type TenantContextValue = {
  institution: TenantInstitution | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitution] = useState<TenantInstitution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("institution_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(new Error(profileError.message));
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    if (!profile?.institution_id) {
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    const { data: inst, error: instError } = await supabase
      .from("institutions")
      .select("id, name, slug, logo_url, primary_color")
      .eq("id", profile.institution_id)
      .maybeSingle();

    if (instError) {
      setError(new Error(instError.message));
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    if (!inst) {
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    setInstitution({
      id: inst.id,
      name: inst.name,
      slug: inst.slug,
      logo_url: inst.logo_url,
      primary_color: inst.primary_color ?? "#FF6B35",
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const value = useMemo<TenantContextValue>(
    () => ({
      institution,
      isLoading,
      error,
      refresh: load,
    }),
    [institution, isLoading, error, load],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantContextProvider");
  }
  return ctx;
}
