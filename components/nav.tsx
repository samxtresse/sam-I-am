import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-cream-200 bg-cream-50">
      <div className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <Link href="/" className="display text-xl font-medium">
          Sam I am
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/secretary" className="hover:underline">
            Secretary
          </Link>
          <Link href="/secretary/approvals" className="hover:underline">
            Approvals
          </Link>
          <Link href="/secretary/allowlist" className="hover:underline">
            Allowlist
          </Link>
          <Link href="/secretary/notes" className="hover:underline">
            Notes
          </Link>
          <Link href="/secretary/audit" className="hover:underline">
            Audit
          </Link>
          <Link href="/secretary/setup" className="hover:underline">
            Setup
          </Link>
        </nav>
      </div>
    </header>
  );
}
