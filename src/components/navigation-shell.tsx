"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gauge,
  History,
  Map,
  Menu,
  RadioTower,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Tempo real", description: "Cronometragem ao vivo", icon: Activity },
  { href: "/historico", label: "Histórico", description: "Sessões e voltas", icon: History },
  { href: "/events", label: "Eventos", description: "Eventos e treinos", icon: CalendarDays },
  { href: "/karts", label: "Karts", description: "Cadastro de karts", icon: Gauge },
  { href: "/pilots", label: "Pilotos", description: "Cadastro de pilotos", icon: Users },
  { href: "/tracks", label: "Pistas", description: "Circuitos cadastrados", icon: Map },
  { href: "/transponders", label: "Transponders", description: "Dispositivos de cronometragem", icon: RadioTower },
];

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className={`adiem-shell${collapsed ? " adiem-shell--collapsed" : ""}`}>
      {mobileOpen && <button className="adiem-nav-backdrop" aria-label="Fechar menu" onClick={closeMobile} />}
      <aside className={`adiem-nav${mobileOpen ? " adiem-nav--mobile-open" : ""}${collapsed ? " adiem-nav--collapsed" : ""}`}>
        <div className="adiem-nav-brand">
          <Link href="/" className="adiem-nav-brand-link" onClick={closeMobile} aria-label="ADIEM - Tempo real">
            <Image src="/adiem-icon.png" alt="ADIEM" width={42} height={42} className="adiem-nav-logo" priority />
            <span className="adiem-nav-brand-copy">
              <strong>ADIEM</strong>
              <small>RACING TIMING</small>
            </span>
          </Link>
          <button className="adiem-nav-mobile-close" onClick={closeMobile} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <div className="adiem-nav-section-label">NAVEGAÇÃO</div>
        <nav className="adiem-nav-links" aria-label="Navegação principal">
          {navItems.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={`adiem-nav-link${active ? " is-active" : ""}`}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.9} className="adiem-nav-link-icon" />
                <span className="adiem-nav-link-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {active && <span className="adiem-nav-active-mark" />}
              </Link>
            );
          })}
        </nav>

        <div className="adiem-nav-footer">
          <div className="adiem-nav-status"><span /> Sistema ADIEM V1</div>
          <button
            className="adiem-nav-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Recolher menu</span></>}
          </button>
        </div>
      </aside>

      <div className="adiem-shell-content">
        <div className="adiem-mobile-topbar">
          <button className="adiem-mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <div className="adiem-mobile-title"><Flag size={17} /> ADIEM <span>RACING TIMING</span></div>
          <div className="adiem-mobile-live"><span /> V1</div>
        </div>
        <div className="adiem-page-content">{children}</div>
      </div>
    </div>
  );
}
