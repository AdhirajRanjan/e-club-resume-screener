"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ClipboardList, LayoutDashboard, UserRound, UsersRound } from "lucide-react";

export function Navigation({ reviewer }: { reviewer: boolean }) {
  const path = usePathname();
  const nav = reviewer
    ? [{ href: "/reviewer", label: "Reviewer dashboard", icon: LayoutDashboard },
      { href: "/dash", label: "Project matching", icon: UsersRound }]
    : [{ href: "/projects", label: "Explore projects", icon: BriefcaseBusiness },
      { href: "/applications", label: "My applications", icon: ClipboardList }];
  return <nav aria-label="Main navigation" className="navigation">
    {[...nav, { href: "/profile", label: "Profile", icon: UserRound }].map(({ href, label, icon: Icon }) =>
      <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}>
        <Icon size={16} aria-hidden="true" /> {label}
      </Link>)}
  </nav>;
}
