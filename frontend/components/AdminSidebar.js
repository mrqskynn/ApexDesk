"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  UserCheck,
  User,
  BookOpen,
  BarChart3,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
  ExternalLink,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { getCurrentUser, logout } from "../lib/api";
import ModuleSwitcher from "./ModuleSwitcher";

export default function AdminSidebar({ collapsed, onToggleCollapse }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, [pathname]);

  const isAdmin = currentUser?.role === "admin";
  const displayName = currentUser?.name || "Sign In Required";
  const roleLabel =
    currentUser?.role === "admin"
      ? "Administrator"
      : currentUser?.role === "agent"
        ? "Support Staff"
        : "Unauthenticated";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  // Agent & Admin inbox items live under /agent
  const agentItems = [
    { href: "/agent", label: "Inbox", icon: Inbox, exact: true },
    { href: "/agent?filter=mine", label: "Assigned to Me", icon: User },
    { href: "/agent?filter=unassigned", label: "Unassigned", icon: UserCheck },
  ];

  // Admin-only routes live under /admin/* — hidden completely for Support Staff (agent)
  const adminItems = isAdmin
    ? [
        {
          href: "/admin/dashboard",
          label: "Analytics & KPIs",
          icon: BarChart3,
        },
        { href: "/admin/kb", label: "Knowledge Base", icon: BookOpen },
        { href: "/admin/settings", label: "Settings & SLA", icon: Settings },
      ]
    : [];

  const navItems = [...agentItems, ...adminItems];

  return (
    <aside
      style={{
        width: collapsed ? "68px" : "240px",
        flexShrink: 0,
        backgroundColor: "#0b0f19",
        borderRight: "1px solid #1e293b",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "none",
        zIndex: 50,
      }}>
      {/* Top Workspace Header */}
      <div
        style={{
          height: "56px",
          padding: collapsed ? "0 14px" : "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #1e293b",
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
          }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              backgroundColor: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "14px",
              flexShrink: 0,
            }}>
            A
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#f8fafc",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "-0.01em",
                }}>
                ApexDesk Ops
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}>
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                  }}
                />
                <span>{isAdmin ? "Admin Console" : "Support Queue"}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}>
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Quick Link */}
      <div style={{ padding: collapsed ? "12px 10px" : "12px 14px" }}>
        <Link
          href="/agent"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: collapsed ? "8px" : "7px 12px",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "#e2e8f0",
            fontSize: "12.5px",
            fontWeight: 500,
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={14} color="#38bdf8" />
            {!collapsed && <span>Ticket Queue</span>}
          </div>
        </Link>
      </div>

      {/* Role-Filtered Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: collapsed ? "6px 8px" : "6px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          overflowY: "auto",
        }}>
        {navItems.map((item) => {
          const baseHref = item.href.split("?")[0];
          const isActive = item.exact
            ? pathname === baseHref
            : pathname === item.href ||
              (baseHref !== "/agent" && pathname.startsWith(baseHref));
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "space-between",
                padding: collapsed ? "9px 0" : "8px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#ffffff" : "#94a3b8",
                backgroundColor: isActive ? "#1e293b" : "transparent",
                textDecoration: "none",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#141c2e";
                  e.currentTarget.style.color = "#f1f5f9";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Icon size={16} color={isActive ? "#38bdf8" : "#64748b"} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}

        <div
          style={{
            margin: "16px 0 8px",
            height: "1px",
            backgroundColor: "#1e293b",
          }}
        />

        {/* Help Center Home */}
        <Link
          href="/"
          title={collapsed ? "Go to Help Center" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: collapsed ? "8px 0" : "7px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#64748b",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#38bdf8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#64748b";
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LifeBuoy size={15} />
            {!collapsed && <span>Help Center</span>}
          </div>
          {!collapsed && <ExternalLink size={12} />}
        </Link>
      </nav>

      {/* Inline Role-Aware Workspace Switcher (no floating bottom overlay) */}
      <ModuleSwitcher variant="sidebar" collapsed={collapsed} />

      {/* Bottom Authenticated Profile Card */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          padding: collapsed ? "12px 10px" : "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
          }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                color: "#f8fafc",
                border: "1px solid #475569",
              }}>
              {initials}
            </div>
            <span
              style={{
                position: "absolute",
                bottom: "-1px",
                right: "-1px",
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: currentUser ? "#10b981" : "#f59e0b",
                border: "2px solid #0b0f19",
              }}
            />
          </div>

          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#f8fafc",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                {displayName}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  whiteSpace: "nowrap",
                }}>
                {roleLabel}
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={logout}
            title="Log Out"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}>
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
