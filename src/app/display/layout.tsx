import type { ReactNode } from "react";

export default function DisplayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050508] text-white antialiased">
      {children}
    </div>
  );
}
