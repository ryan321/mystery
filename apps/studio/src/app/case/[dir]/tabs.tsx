"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Story"],
  ["characters", "Characters"],
  ["relationships", "Relationships"],
  ["world", "World"],
  ["beats", "Beats"],
  ["solution", "Solution"],
  ["accuse", "Accuse"],
  ["art", "Art"],
  ["edit", "Edit JSON"],
] as const;

export function CaseTabs({ dir }: { dir: string }) {
  const pathname = usePathname();
  const base = `/case/${dir}`;
  return (
    <nav className="tabs">
      {TABS.map(([slug, label]) => {
        const href = slug ? `${base}/${slug}` : base;
        const active =
          pathname === href || (slug === "" && pathname === `${base}/`);
        return (
          <Link key={slug} href={href} className={active ? "active" : ""}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
