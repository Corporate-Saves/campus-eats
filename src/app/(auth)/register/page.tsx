"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required").max(200),
    institutionCode: z
      .string()
      .min(1, "Institution code is required")
      .regex(
        /^[a-z0-9-]+$/i,
        "Use letters, numbers, and hyphens only (institution slug)",
      ),
    studentId: z.string().min(1, "Student ID is required").max(100),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

type InstitutionLookup = {
  id: string;
  slug: string;
  domain_whitelist: string[];
};

function emailDomain(email: string) {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

function domainAllowed(domain: string, whitelist: string[]) {
  if (!whitelist?.length) return false;
  const d = domain.toLowerCase();
  return whitelist.some((w) => w.replace(/^@/, "").toLowerCase() === d);
}

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      institutionCode: "",
      studentId: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const slug = values.institutionCode.trim().toLowerCase();

    let institution: InstitutionLookup;
    try {
      const res = await fetch(
        `/api/institutions/by-slug/${encodeURIComponent(slug)}`,
      );
      const json = (await res.json()) as InstitutionLookup & { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Institution not found");
        setSubmitting(false);
        return;
      }
      institution = {
        id: json.id,
        slug: json.slug,
        domain_whitelist: json.domain_whitelist ?? [],
      };
    } catch {
      toast.error("Could not validate institution");
      setSubmitting(false);
      return;
    }

    const domain = emailDomain(values.email);
    if (!domainAllowed(domain, institution.domain_whitelist)) {
      toast.error(
        `Email must use an allowed domain for this institution (e.g. ${institution.domain_whitelist.join(", ")})`,
      );
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        data: {
          full_name: values.fullName.trim(),
          institution_id: institution.id,
          student_id: values.studentId.trim(),
        },
      },
    });

    if (signError) {
      toast.error(signError.message);
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      toast.error("Sign up failed");
      setSubmitting(false);
      return;
    }

    const profileRow = {
      id: data.user.id,
      institution_id: institution.id,
      full_name: values.fullName.trim(),
      role: "student" as const,
      student_id: values.studentId.trim(),
    };

    if (data.session) {
      const { error: insertError } = await supabase
        .from("profiles")
        .upsert(profileRow, { onConflict: "id" });

      if (insertError) {
        toast.error(insertError.message);
        setSubmitting(false);
        return;
      }
    } else {
      const res = await fetch("/api/auth/register-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          institutionSlug: slug,
          fullName: values.fullName.trim(),
          studentId: values.studentId.trim(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error || "Could not create profile");
        setSubmitting(false);
        return;
      }
    }

    toast.success("Check your email to confirm your account");
    setSubmitting(false);
  });

  return (
    <main>
      <h2 className="text-xl font-semibold text-text">Create account</h2>
      <p className="mt-1 text-sm text-muted">
        Register with your institution code and campus email.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-text"
          >
            Full name
          </label>
          <input
            id="fullName"
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("fullName")}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="institutionCode"
            className="block text-sm font-medium text-text"
          >
            Institution code
          </label>
          <input
            id="institutionCode"
            placeholder="e.g. demo-college"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("institutionCode")}
          />
          {errors.institutionCode && (
            <p className="mt-1 text-sm text-red-600">
              {errors.institutionCode.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-text"
          >
            Student ID
          </label>
          <input
            id="studentId"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("studentId")}
          />
          {errors.studentId && (
            <p className="mt-1 text-sm text-red-600">
              {errors.studentId.message}
            </p>
          )}
        </div>

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
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-text"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Register"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
