"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Conferir" },
  { href: "/medidas/", label: "Medidas" },
  { href: "/conta/", label: "Conta" },
  { href: "/coleta/", label: "Coleta" },
  { href: "/guardadas/", label: "Guardadas" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <img className="brand-mark" src="/logo.svg" alt="" width={40} height={40} />
          Olho na Caixa
        </Link>
        <nav className="nav">
          {links.map((link) => {
            const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
            const current = link.href === "/" ? path === "/" : path === link.href;
            return (
              <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
