import Link from "next/link";
import { useRouter } from "next/router";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/panel-1-timeline", label: "Panel 1: Timeline" },
  { href: "/panel-2-flowchart", label: "Panel 2: Flowchart" },
  { href: "/panel-3-parallel-track", label: "Panel 3: Parallel Track" },
  { href: "/config", label: "Configuration" }
];

export default function ShellLayout({ title, subtitle, children }) {
  const router = useRouter();

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Release Governance Studio</p>
        <h1>{title}</h1>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </header>

      <nav className="top-nav">
        {links.map((link) => {
          const active = router.pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className={active ? "nav-link active" : "nav-link"}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <main>{children}</main>
    </div>
  );
}
