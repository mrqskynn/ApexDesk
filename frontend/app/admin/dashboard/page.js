"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Search,
  ArrowUpRight,
  RefreshCw,
  Download,
} from "lucide-react";
import { adminFetch } from "../../../lib/api";

export default function OverviewDashboard() {
  const [metrics, setMetrics] = useState({
    total_chats: 0,
    deflection_rate: 0,
    avg_latency_ms: 0,
    escalation_count: 0,
    escalation_rate: 0,
    mttr_minutes: 0,
    avg_rag_score: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    recent_llm_calls: [],
    tickets_by_status: { open: 0, in_progress: 0, escalated: 0, resolved: 0 },
  });
  const [loading, setLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [tickets, setTickets] = useState([]);

  const formatTimeAgo = (iso) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${Math.max(1, mins)}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "Recently";
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [metricsData, ticketData] = await Promise.all([
        adminFetch("/metrics"),
        adminFetch("/tickets"),
      ]);

      if (metricsData && metricsData.total_chats !== undefined) {
        setMetrics(metricsData);
        setIsLive(true);
        setApiError("");
      }

      if (Array.isArray(ticketData)) {
        const live = ticketData.map((t) => {
          const reqMatch = t.description ? t.description.match(/Requester:\s*([^<\n]+)/) : null;
          return {
            id: "TICK-" + t.id,
            requester: reqMatch ? reqMatch[1].trim() : "Corporate Customer",
            subject: t.title,
            priority: t.priority || "medium",
            status: t.status || "open",
            assignee: t.assignee || "Unassigned",
            created: formatTimeAgo(t.created_at),
            dept: t.title.toLowerCase().includes("license") ? "Engineering" : "Operations",
          };
        });
        setTickets(live);
      }
    } catch (err) {
      setApiError(err.message || "Failed to load admin analytics.");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const refreshMetrics = () => {
    loadAllData();
  };

  const handleExportCsv = async () => {
    try {
      const csvText = await adminFetch("/metrics/export?format=csv");
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-has-analytics.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setApiError(err.message || "Export failed.");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (tableFilter !== "all" && t.status !== tableFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.requester.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getPriorityDot = (p) => {
    switch (p) {
      case "urgent":
        return "#ef4444";
      case "high":
        return "#f97316";
      case "medium":
        return "#3b82f6";
      default:
        return "#94a3b8";
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case "escalated":
        return { label: "Escalated", bg: "#f3e8ff", text: "#7e22ce", border: "#e9d5ff" };
      case "in_progress":
        return { label: "In Progress", bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
      case "resolved":
        return { label: "Resolved", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
      case "open":
      default:
        return { label: "Open", bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", backgroundColor: "#ffffff" }}>
      
      {/* Top Bar Header */}
      <div
        style={{
          padding: "16px 28px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
              Helpdesk Overview &amp; KPIs
            </h1>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                backgroundColor: isLive ? "#ecfdf5" : "#fef3c7",
                color: isLive ? "#059669" : "#b45309",
                border: isLive ? "1px solid #a7f3d0" : "1px solid #fde68a",
              }}
            >
              {isLive ? "● Live Telemetry" : "○ Demo Telemetry"}
            </span>
          </div>
          <p style={{ fontSize: "12.5px", color: "#64748b", margin: 0 }}>
            Operational metrics, RAG deflection rates, and recent ticket activity.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={handleExportCsv}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: "#eef2ff",
              border: "1px solid #c7d2fe",
              color: "#4338ca",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={refreshMetrics}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
          >
            <RefreshCw size={13} className={loading ? "pulse-dot" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div
          style={{
            margin: "16px 28px 0",
            padding: "10px 14px",
            borderRadius: "6px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          {apiError}
        </div>
      )}

      <div style={{ padding: "24px 28px", maxWidth: "1280px" }}>
        
        {/* ========================================================= */}
        {/* ROW 1: OBSERVABILITY & HELPDESK KPI CARDS                */}
        {/* ========================================================= */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginBottom: "24px" }}>

          {/* Card 1: AI Deflection Rate */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Deflection Rate
              </span>
              <Bot size={16} color="#4f46e5" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#4f46e5", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              {metrics.deflection_rate}%
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
              <TrendingUp size={13} color="#059669" />
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{metrics.total_chats.toLocaleString()}</span>
              <span style={{ color: "#94a3b8" }}>total interactions</span>
            </div>
          </div>

          {/* Card 2: Mean Time to Resolve (MTTR) */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                MTTR
              </span>
              <CheckCircle2 size={16} color="#059669" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              {metrics.mttr_minutes ?? 0} <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>min</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
              <span style={{ fontWeight: 600, color: "#059669" }}>Mean resolution time</span>
            </div>
          </div>

          {/* Card 3: Avg Latency */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Avg Latency
              </span>
              <Clock size={16} color="#0891b2" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              {metrics.avg_latency_ms} <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>ms</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{(metrics.total_tokens || 0).toLocaleString()}</span>
              <span style={{ color: "#94a3b8" }}>tokens (${Number(metrics.total_cost_usd || 0).toFixed(4)})</span>
            </div>
          </div>

          {/* Card 4: Escalation Rate */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Escalation Rate
              </span>
              <AlertTriangle size={16} color="#d97706" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#d97706", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              {metrics.escalation_rate ?? 0}%
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{metrics.escalation_count}</span>
              <span style={{ color: "#94a3b8" }}>escalated chats</span>
            </div>
          </div>

          {/* Card 5: Avg RAG Retrieval Score */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Avg RAG Score
              </span>
              <BarChart3 size={16} color="#2563eb" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#2563eb", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              {Number(metrics.avg_rag_score || 0).toFixed(3)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
              <span style={{ color: "#94a3b8" }}>hybrid top-1 score (0–1)</span>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* ROW 2: TICKET STATUS DISTRIBUTION STRIP                  */}
        {/* ========================================================= */}
        {(() => {
          const statusMap = metrics.tickets_by_status || {};
          const resolvedCnt = Number(statusMap.resolved || 0);
          const inProgCnt = Number(statusMap.in_progress || 0);
          const escCnt = Number(statusMap.escalated || 0);
          const openCnt = Number(statusMap.open || 0);
          const totalStatus = resolvedCnt + inProgCnt + escCnt + openCnt;
          const pct = (n) => (totalStatus > 0 ? `${Math.round((n / totalStatus) * 100)}%` : "0%");
          return (
            <div
              style={{
                padding: "18px 20px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                  Ticket Pipeline &amp; Resolution Queue
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Total {totalStatus} tickets
                </span>
              </div>

              <div style={{ height: "10px", borderRadius: "999px", overflow: "hidden", display: "flex", width: "100%", backgroundColor: "#e2e8f0", marginBottom: "14px" }}>
                <div style={{ width: pct(resolvedCnt), backgroundColor: "#059669" }} title={`Resolved: ${resolvedCnt}`} />
                <div style={{ width: pct(inProgCnt), backgroundColor: "#f59e0b" }} title={`In Progress: ${inProgCnt}`} />
                <div style={{ width: pct(escCnt), backgroundColor: "#9333ea" }} title={`Escalated: ${escCnt}`} />
                <div style={{ width: pct(openCnt), backgroundColor: "#3b82f6" }} title={`Open: ${openCnt}`} />
              </div>

              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#059669" }} />
                  <span style={{ color: "#475569" }}>Resolved:</span>
                  <strong style={{ color: "#0f172a" }}>{resolvedCnt}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                  <span style={{ color: "#475569" }}>In Progress:</span>
                  <strong style={{ color: "#0f172a" }}>{inProgCnt}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9333ea" }} />
                  <span style={{ color: "#475569" }}>Escalated:</span>
                  <strong style={{ color: "#0f172a" }}>{escCnt}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                  <span style={{ color: "#475569" }}>Open:</span>
                  <strong style={{ color: "#0f172a" }}>{openCnt}</strong>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* ROW 3: MINIMALIST LINEAR-STYLE DATA TABLE                 */}
        {/* ========================================================= */}
        <div
          style={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {/* Table Controls */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Recent Support Tickets
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px", backgroundColor: "#f1f5f9", color: "#475569" }}>
                {filteredTickets.length}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Filter Tabs */}
              <div style={{ display: "flex", gap: "4px" }}>
                {[
                  { id: "all", label: "All" },
                  { id: "open", label: "Open" },
                  { id: "in_progress", label: "In Progress" },
                  { id: "escalated", label: "Escalated" },
                  { id: "resolved", label: "Resolved" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTableFilter(f.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "5px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: tableFilter === f.id ? "#0f172a" : "#f8fafc",
                      color: tableFilter === f.id ? "#ffffff" : "#64748b",
                      border: tableFilter === f.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                }}
              >
                <Search size={13} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: "none", outline: "none", fontSize: "12px", width: "130px", color: "#0f172a" }}
                />
              </div>
            </div>
          </div>

          {/* Minimalist Data Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    ID
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Requester
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Subject / Summary
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Priority
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Status
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Assignee
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Created
                  </th>
                  <th style={{ padding: "10px 18px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => {
                  const badge = getStatusBadge(t.status);
                  const dot = getPriorityDot(t.priority);

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background-color 0.1s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafbfc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "12px 18px", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                        {t.id}
                      </td>

                      <td style={{ padding: "12px 18px", fontWeight: 600, color: "#0f172a" }}>
                        <div>{t.requester}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>{t.dept}</div>
                      </td>

                      <td style={{ padding: "12px 18px", color: "#334155", maxWidth: "340px" }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.subject}
                        </div>
                      </td>

                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: dot }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "capitalize", color: "#334155" }}>
                            {t.priority}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 18px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: "12px 18px", fontSize: "12.5px", color: "#475569" }}>
                        {t.assignee}
                      </td>

                      <td style={{ padding: "12px 18px", fontSize: "12px", color: "#94a3b8" }}>
                        {t.created}
                      </td>

                      <td style={{ padding: "12px 18px", textAlign: "right" }}>
                        <Link
                          href="/agent"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#4f46e5",
                            textDecoration: "none",
                            backgroundColor: "#eef2ff",
                          }}
                        >
                          <span>Open</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ROW 4: RECENT LLM CALL OBSERVABILITY LOG                  */}
        {/* ========================================================= */}
        <div
          style={{
            marginTop: "24px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
              Recent LLM &amp; RAG Call Telemetry
            </span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Showing latest {(metrics.recent_llm_calls || []).length} calls
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Session</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Outcome</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Top RAG Score</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Retrieved Chunks</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tokens</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Cost (USD)</th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.recent_llm_calls || []).map((call) => {
                  const chunkLabel = (call.retrieved_chunks || [])
                    .map((c) => `${c.source || c.title || "chunk"} (${Number(c.score || 0).toFixed(2)})`)
                    .slice(0, 2)
                    .join(", ");
                  return (
                    <tr key={call.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: "11.5px", color: "#334155" }}>
                        {call.session_id}
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 700, textTransform: "capitalize", color: call.outcome === "refused" ? "#b91c1c" : call.outcome === "escalated" ? "#b45309" : "#047857" }}>
                        {call.outcome}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", color: "#1d4ed8", fontWeight: 600 }}>
                        {Number(call.top_rag_score || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#475569", maxWidth: "280px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {chunkLabel || "—"}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#334155" }}>
                        {(call.total_tokens || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", color: "#475569" }}>
                        ${Number(call.cost_usd || 0).toFixed(6)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                        {Number(call.latency_ms || 0).toFixed(1)} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
