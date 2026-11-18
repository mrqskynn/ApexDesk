"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, HelpCircle, Ticket, PlusCircle, User, LogIn, LogOut, ShieldCheck, Headphones } from "lucide-react";
import { getCurrentUser, logout } from "../lib/api";
import ModuleSwitcher from "./ModuleSwitcher";

export default function PortalHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const role = user?.role || "";
  const showCustomerLinks = !role || role === "customer";

  const navLinks = [
    { href: "/", label: "Help Center", icon: HelpCircle },
    ...(showCustomerLinks
      ? [
          { href: "/my-tickets", label: "My Tickets", icon: Ticket },
          { href: "/submit", label: "Submit a Request", icon: PlusCircle },
        ]
      : []),
  ];

  const roleLabel =
    role === "admin" ? "Admin" : role === "agent" ? "Support Staff" : "Customer";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.03)",
      }}
    >
      <div
        style={{
          maxWidth: "1160px",
          margin: "0 auto",
          padding: "0 24px",
          height: "68px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        {/* Logo Left */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#0f172a",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 10px rgba(37, 99, 235, 0.28)",
            }}
          >
            <Zap size={20} fill="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "-0.02em" }}>
              ApexDesk
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  display: "inline-block",
                }}
              />
              IT Help &amp; Services
            </div>
          </div>
        </Link>

        {/* Navigation Links Right */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  color: isActive ? "#2563eb" : "#475569",
                  backgroundColor: isActive ? "#eff6ff" : "transparent",
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {user && <ModuleSwitcher variant="header" />}

          <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0", margin: "0 4px" }} />

          {/* User Auth Profile or Sign In Button */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor:
                    role === "admin" ? "#fef3c7" : role === "agent" ? "#eef2ff" : "#f1f5f9",
                  border:
                    role === "admin"
                      ? "1px solid #fde68a"
                      : role === "agent"
                      ? "1px solid #c7d2fe"
                      : "1px solid #e2e8f0",
                  fontSize: "13px",
                  fontWeight: 600,
                  color:
                    role === "admin" ? "#92400e" : role === "agent" ? "#4338ca" : "#1e293b",
                }}
              >
                {role === "admin" ? (
                  <ShieldCheck size={14} color="#d97706" />
                ) : role === "agent" ? (
                  <Headphones size={14} color="#4f46e5" />
                ) : (
                  <User size={14} color="#2563eb" />
                )}
                <span>{user.name || user.username}</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255,255,255,0.7)",
                    textTransform: "uppercase",
                  }}
                >
                  {roleLabel}
                </span>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#2563eb",
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                textDecoration: "none",
              }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
