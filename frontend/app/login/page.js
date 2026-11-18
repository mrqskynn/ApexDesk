"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  ShieldCheck,
  User,
  Headphones,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { loginApi, setCurrentUser } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState("customer"); // "customer" | "agent" | "admin"
  const [username, setUsername] = useState("marcus.vance@company.com");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRoleSwitch = (tab) => {
    setRoleTab(tab);
    setErrorMsg("");
    if (tab === "admin") {
      setUsername("admin");
      setPassword("");
    } else if (tab === "agent") {
      setUsername("jane.doe@company.com");
      setPassword("");
    } else {
      setUsername("marcus.vance@company.com");
      setPassword("");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const resp = await loginApi({
        username: username.trim(),
        password: password.trim(),
        role: roleTab,
      });

      setCurrentUser(resp);

      if (resp.role === "admin") {
        router.push("/admin/dashboard");
      } else if (resp.role === "agent") {
        router.push("/agent");
      } else {
        router.push("/my-tickets");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
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
            <div style={{ fontWeight: 800, fontSize: "17px", letterSpacing: "-0.02em" }}>
              ApexDesk
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>IT Helpdesk &amp; Automation</div>
          </div>
        </Link>

        <Link
          href="/"
          style={{
            fontSize: "13px",
            color: "#64748b",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 500,
          }}
        >
          <span>Help Center Home</span>
          <ArrowRight size={14} />
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.03)",
            padding: "36px 32px",
            animation: "fadeIn 0.25s ease-out",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
              Sign In to ApexDesk
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Select your role to enter your authorized helpdesk workspace.
            </p>
          </div>

          {/* 3-Role Switcher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "4px",
              backgroundColor: "#f1f5f9",
              borderRadius: "10px",
              marginBottom: "20px",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => handleRoleSwitch("customer")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "9px 8px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                backgroundColor: roleTab === "customer" ? "#ffffff" : "transparent",
                color: roleTab === "customer" ? "#2563eb" : "#64748b",
                boxShadow: roleTab === "customer" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <User size={14} />
              <span>Customer</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitch("agent")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "9px 8px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                backgroundColor: roleTab === "agent" ? "#4f46e5" : "transparent",
                color: roleTab === "agent" ? "#ffffff" : "#64748b",
                boxShadow: roleTab === "agent" ? "0 1px 3px rgba(79,70,229,0.25)" : "none",
              }}
            >
              <Headphones size={14} />
              <span>Support Agent</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitch("admin")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "9px 8px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                backgroundColor: roleTab === "admin" ? "#0f172a" : "transparent",
                color: roleTab === "admin" ? "#ffffff" : "#64748b",
                boxShadow: roleTab === "admin" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <ShieldCheck size={14} />
              <span>Admin</span>
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                marginBottom: "20px",
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                {roleTab === "admin" ? "Admin Username" : "Corporate Email"}
              </label>
              <input
                type="text"
                required
                placeholder={roleTab === "admin" ? "admin" : roleTab === "agent" ? "jane.doe@company.com" : "marcus.vance@company.com"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", color: "#0f172a", backgroundColor: "#ffffff", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                {roleTab === "admin" ? "Administrator Secret Key" : "Password"}
              </label>
              <input
                type="password"
                required
                placeholder={roleTab === "admin" ? "Enter admin password..." : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", color: "#0f172a", backgroundColor: "#ffffff", outline: "none" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                backgroundColor: roleTab === "admin" ? "#0f172a" : roleTab === "agent" ? "#4f46e5" : "#2563eb",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <span>
                {loading
                  ? "Authenticating..."
                  : roleTab === "admin"
                  ? "Enter Admin Console"
                  : roleTab === "agent"
                  ? "Enter Agent Inbox"
                  : "Sign In to Customer Portal"}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9", textAlign: "center", display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", fontSize: "12px" }}>
            <span style={{ color: "#94a3b8" }}>Quick Fill:</span>
            <button
              type="button"
              onClick={() => {
                setRoleTab("customer");
                setUsername("marcus.vance@company.com");
                setPassword("demo123");
                setErrorMsg("");
              }}
              style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 600, cursor: "pointer" }}
            >
              Marcus (Customer)
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("customer");
                setUsername("elena.rostova@company.com");
                setPassword("demo123");
                setErrorMsg("");
              }}
              style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 600, cursor: "pointer" }}
            >
              Elena (Customer)
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("agent");
                setUsername("jane.doe@company.com");
                setPassword("demo123");
                setErrorMsg("");
              }}
              style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: 600, cursor: "pointer" }}
            >
              Jane Doe (Agent)
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("admin");
                setUsername("admin");
                setPassword("");
                setErrorMsg("");
              }}
              style={{ background: "none", border: "none", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
            >
              Admin
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
