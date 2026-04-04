"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { TenantProvider } from "@/components/TenantProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </TenantProvider>
    </QueryClientProvider>
  );
}
