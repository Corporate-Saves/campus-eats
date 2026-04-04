import Link from "next/link";

const links = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/dashboard", label: "Student · Dashboard" },
  { href: "/menu", label: "Student · Menu" },
  { href: "/orders", label: "Student · Orders" },
  { href: "/wallet", label: "Student · Wallet" },
  { href: "/queue", label: "Staff · Queue" },
  { href: "/owner/menu", label: "Owner · Menu" },
  { href: "/analytics", label: "Owner · Analytics" },
  { href: "/tenants", label: "Admin · Tenants" },
  { href: "/institutions", label: "Admin · Institutions" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-8 text-text">
      <div className="mx-auto max-w-lg rounded-lg border border-muted/20 bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Campus Eats</h1>
        <p className="mt-2 text-sm text-muted">Next.js 15 App Router · Route map</p>
        <ul className="mt-6 space-y-2">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-primary underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
