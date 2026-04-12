import Link from "next/link";

const links = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/student/dashboard", label: "Student · Dashboard" },
  { href: "/student/menu", label: "Student · Menu" },
  { href: "/student/orders", label: "Student · Orders" },
  { href: "/student/wallet", label: "Student · Wallet" },
  { href: "/staff/queue", label: "Staff · Queue" },
  { href: "/owner/menu", label: "Owner · Menu" },
  { href: "/owner/slots", label: "Owner · Slots" },
  { href: "/owner/analytics", label: "Owner · Analytics" },
  { href: "/admin/tenants", label: "Admin · Tenants" },
  { href: "/admin/institutions", label: "Admin · Institutions" },
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
