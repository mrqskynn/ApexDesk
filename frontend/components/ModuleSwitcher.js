"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, UserCheck, HelpCircle, Inbox } from "lucide-react";
import { getCurrentUser } from "../lib/api";

export default function ModuleSwitcher({
  variant = "header",
  collapsed = false,
}) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const role = user?.role || "";
  if (!role || collapsed) return null;

  const isAgentRoute = pathname.startsWith("/agent");
  const isAdminRoute = pathname.startsWith("/admin");

  const items = [];
  if (role === "customer") {
    items.push({
      href: "/",
      label: "Help Center",
      active: pathname === "/",
      icon: HelpCircle,
    });
    items.push({
      href: "/my-tickets",
      label: "My Tickets",
      active: pathname.startsWith("/my-tickets"),
      icon: UserCheck,
    });
  } else if (role === "agent") {
    items.push({
      href: "/agent",
      label: "Agent Inbox",
      active: isAgentRoute,
      icon: Inbox,
    });
    items.push({
      href: "/",
      label: "Help Center",
      active: pathname === "/",
      icon: HelpCircle,
    });
  } else if (role === "admin") {
    items.push({
      href: "/admin/dashboard",
      label: "Admin Console",
      active: isAdminRoute,
      icon: Shield,
    });
    items.push({
      href: "/agent",
      label: "Agent Inbox",
      active: isAgentRoute,
      icon: Inbox,
    });
    items.push({
      href: "/",
      label: "Help Center",
      active: pathname === "/",
      icon: HelpCircle,
    });
  }

  if (variant === "sidebar") {
    return (
      <div
        style={{
          margin: "8px 12px",
          padding: "6px",
          borderRadius: "8px",
          backgroundColor: "#111827",
          border: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "2px 6px",
          }}>
          Workspace
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
                color: item.active ? "#ffffff" : "#94a3b8",
                backgroundColor: item.active ? "#4f46e5" : "transparent",
              }}>
              <Icon size={13} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  // Inline header variant (compact segmented pill inside PortalHeader)
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px",
        borderRadius: "10px",
        backgroundColor: "#f1f5f9",
        border: "1px solid #e2e8f0",
      }}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
              color: item.active ? "#ffffff" : "#475569",
              backgroundColor: item.active ? "#2563eb" : "transparent",
            }}>
            <Icon size={13} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
