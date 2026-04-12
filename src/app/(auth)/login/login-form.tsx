"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const supabase = createClient();

    const { error: signError } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (signError) {
      toast.error(signError.message || "Invalid credentials");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Could not load user");
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, institution_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      toast.error(profileError.message);
      setSubmitting(false);
      return;
    }

    if (!profile?.role) {
      toast.error("No profile found. Please register first.");
      setSubmitting(false);
      return;
    }

    if (
      profile.role !== "super_admin" &&
      profile.institution_id
    ) {
      const { data: inst, error: instErr } = await supabase
        .from("institutions")
        .select("is_active, deleted_at")
        .eq("id", profile.institution_id)
        .maybeSingle();

      if (instErr || !inst || !inst.is_active || inst.deleted_at != null) {
        await supabase.auth.signOut();
        toast.error(
          "This institution is not available. Contact your administrator.",
        );
        setSubmitting(false);
        return;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["profile"] });

    const next = searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : null;

    if (safeNext) {
      router.push(safeNext);
      router.refresh();
      return;
    }

    router.push(dashboardPathForRole(profile.role as string));
    router.refresh();
  });

  const tenantNotice = searchParams.get("tenant") === "unavailable";

  return (
    <>
      <h2 className="text-xl font-semibold text-text">Sign in</h2>
      <p className="mt-1 text-sm text-muted">
        Use your campus email and password.
      </p>
      {tenantNotice ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Your institution is inactive or no longer available. Contact your
          administrator if this is unexpected.
        </p>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-text"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="font-medium text-primary underline">
          Register
        </Link>
      </p>
    </>
  );
}
