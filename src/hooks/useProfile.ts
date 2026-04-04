"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/profile";

async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, institution_id, canteen_id, full_name, role, student_id, wallet_balance, fcm_token, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export function useProfile() {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  return {
    profile: query.data ?? undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
