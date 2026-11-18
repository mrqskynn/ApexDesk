"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Clock,
  Bot,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { adminFetch, adminPatch, apiPut } from "../../../lib/api";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({
    urgent_minutes: 60,
    high_minutes: 240,
    medium_minutes: 720,
    low_minutes: 1440,
    retrieval_min_score: 0.35,
    redact_pii: true,
    detect_injection: true,
  });

  useEffect(() => {
    Promise.all([adminFetch("/settings/sla"), adminFetch("/users")])
      .then(([slaData, userList]) => {
        if (slaData && typeof slaData === "object") {
          setSettings((prev) => ({ ...prev, ...slaData }));
        }
        if (Array.isArray(userList)) {
          setUsers(userList);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || "Failed to load admin settings.");
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSaved(false);
    try {
      const updated = await apiPut("/settings/sla", {
        urgent_minutes: Number(settings.urgent_minutes),
        high_minutes: Number(settings.high_minutes),
        medium_minutes: Number(settings.medium_minutes),
        low_minutes: Number(settings.low_minutes),
        retrieval_min_score: Number(settings.retrieval_min_score),
        redact_pii: Boolean(settings.redact_pii),
        detect_injection: Boolean(settings.detect_injection),
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save SLA settings.");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setErrorMsg("");
    try {
      const updatedUser = await adminPatch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    } catch (err) {
      setErrorMsg(err.message || "Failed to update user role.");
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", backgroundColor: "#ffffff" }}>
      <div
        style={{
          padding: "16px 28px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "0 0 2px 0", letterSpacing: "-0.01em" }}>
            Admin Settings, SLA &amp; User Roles
          </h1>
          <p style={{ fontSize: "12.5px", color: "#64748b", margin: 0 }}>
            Admin-only configuration for SLA targets, safety guardrails, and user RBAC permissions.
          </p>
        </div>

        {saved && (
          <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={14} />
            Settings saved to server!
          </span>
        )}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "28px" }}>
        {errorMsg && (
          <div style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* SLA Thresholds */}
          <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Clock size={18} color="#4f46e5" />
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                SLA Response Targets (Minutes) &amp; RAG Threshold
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Urgent SLA (min)
                </label>
                <input
                  type="number"
                  value={settings.urgent_minutes}
                  onChange={(e) => setSettings({ ...settings, urgent_minutes: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", backgroundColor: "#ffffff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  High SLA (min)
                </label>
                <input
                  type="number"
                  value={settings.high_minutes}
                  onChange={(e) => setSettings({ ...settings, high_minutes: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", backgroundColor: "#ffffff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Retrieval Min Score
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.retrieval_min_score}
                  onChange={(e) => setSettings({ ...settings, retrieval_min_score: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", backgroundColor: "#ffffff" }}
                />
              </div>
            </div>
          </div>

          {/* Guardrails */}
          <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Shield size={18} color="#059669" />
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Security &amp; Privacy Guardrails
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#0f172a", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.redact_pii}
                  onChange={(e) => setSettings({ ...settings, redact_pii: e.target.checked })}
                />
                <span><strong>Redact PII:</strong> Mask emails, phone numbers, SSNs, and credit cards before LLM or DB logging.</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#0f172a", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.detect_injection}
                  onChange={(e) => setSettings({ ...settings, detect_injection: e.target.checked })}
                />
                <span><strong>Prompt Injection Filter:</strong> Block system-prompt extraction and jailbreak attempts.</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 20px",
              borderRadius: "6px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Save size={15} />
            <span>Save SLA Configuration</span>
          </button>
        </form>

        {/* User & Role Management */}
        <div style={{ borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={16} color="#4f46e5" />
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              User &amp; Role Management
            </h2>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px 16px", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>ID</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Username</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "#64748b" }}>{u.id}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#0f172a" }}>{u.name}</td>
                  <td style={{ padding: "10px 16px", color: "#475569" }}>{u.username}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                      }}
                    >
                      <option value="customer">customer</option>
                      <option value="agent">agent</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
