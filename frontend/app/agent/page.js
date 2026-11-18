"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Clock,
  AlertCircle,
  User,
  Bot,
  Lock,
  Send,
  Sparkles,
  CornerDownRight,
  Shield,
  Check,
  Mail,
  RefreshCw,
  X,
  CheckCircle2,
} from "lucide-react";
import { adminPatch, apiFetch, getCurrentUser, post } from "../../lib/api";

function formatTimeAgo(iso) {
  if (!iso) return "Recently";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "Recently";
  }
}

function mapApiTicket(t) {
  const updatedIso = t.updated_at || t.created_at || "";
  const timeAgo = formatTimeAgo(updatedIso);
  const reqMatch = t.description ? t.description.match(/Requester:\s*([^<\n]+)\s*<([^>\n]+)>/) : null;
  const reqName = reqMatch ? reqMatch[1].trim() : "Corporate Customer";
  const reqEmail = reqMatch ? reqMatch[2].trim() : "customer@company.com";
  const initials =
    reqName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CU";

  const persistedNotes = Array.isArray(t.notes)
    ? t.notes.map((n) => ({
        id: n.id || "n-" + Math.random(),
        type: n.type || "agent",
        author: n.author || "Support Staff",
        time: formatTimeAgo(n.time),
        text: n.text || "",
        pendingTool: n.pending_tool || null,
      }))
    : [];

  return {
    id: "TICK-" + t.id,
    dbId: t.id,
    subject: t.title,
    assignee: t.assignee || "Unassigned",
    requester: {
      name: reqName,
      email: reqEmail,
      avatar: initials,
      dept: t.title.toLowerCase().includes("license")
        ? "Engineering"
        : t.title.toLowerCase().includes("vpn") || t.title.toLowerCase().includes("wi-fi")
        ? "Network"
        : "Operations",
      device: "Company Managed Workstation",
      network: "CorpNet-Secure (802.1X)",
    },
    priority: t.priority || "medium",
    status: t.status || "open",
    slaStatus: t.sla_status || "active",
    slaLabel: t.sla_label || "",
    updatedAtIso: updatedIso,
    resolvedAtIso: t.resolved_at || null,
    timeAgo,
    suggestedSOP: t.suggested_sop || null,
    thread: [
      {
        id: "m1",
        type: "customer",
        author: reqName,
        time: timeAgo,
        text: t.description || t.title,
      },
      ...(t.status === "escalated" && persistedNotes.length === 0
        ? [
            {
              id: "sys-esc",
              type: "system",
              author: "ApexDesk AI",
              time: timeAgo,
              text: "Ticket flagged for human specialist review.",
            },
          ]
        : []),
      ...persistedNotes,
    ],
  };
}

export default function AgentTicketInbox() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [filterView, setFilterView] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [composerMode, setComposerMode] = useState("customer"); // "ai" | "customer" | "internal"
  const [composerText, setComposerText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  const loadTickets = async () => {
    setLoading(true);
    setErrorBanner("");
    try {
      const data = await apiFetch("/tickets");
      if (Array.isArray(data)) {
        const mapped = data.map(mapApiTicket);
        setTickets(mapped);
        setSelectedId((prev) =>
          prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || ""
        );
      }
    } catch (err) {
      setErrorBanner(`Could not load ticket inbox: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("filter");
      if (param) setFilterView(param);
    }
    loadTickets();
  }, []);

  const sessionName = currentUser?.name || "";

  const formatAuthorLabel = (author) => {
    if (sessionName && author === sessionName) {
      return `${author} (You)`;
    }
    return author;
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    const ta = a.updatedAtIso ? new Date(a.updatedAtIso).getTime() : 0;
    const tb = b.updatedAtIso ? new Date(b.updatedAtIso).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.dbId || 0) - (a.dbId || 0);
  });

  const filteredTickets = sortedTickets.filter((t) => {
    if (filterView === "mine" && (!sessionName || t.assignee !== sessionName)) return false;
    if (filterView === "unassigned" && t.assignee && t.assignee !== "Unassigned") return false;
    if (filterView === "urgent" && t.priority !== "urgent" && t.priority !== "high") return false;
    if (filterView === "escalated" && t.status !== "escalated") return false;
    if (filterView === "open" && t.status !== "open" && t.status !== "in_progress") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.requester.name.toLowerCase().includes(q) ||
        (t.assignee || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeTicket =
    filteredTickets.find((t) => t.id === selectedId) || filteredTickets[0] || null;

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

  const syncUpdatedTicket = (apiTicket) => {
    const mapped = mapApiTicket(apiTicket);
    setTickets((prev) => prev.map((t) => (t.dbId === mapped.dbId ? mapped : t)));
  };

  const appendLocalAiMessages = (ticketId, msgs, newStatus) => {
    const nowIso = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: newStatus || t.status,
              updatedAtIso: nowIso,
              timeAgo: "Just now",
              thread: [...t.thread, ...msgs],
            }
          : t
      )
    );
  };

  const handleAskAi = async (customPrompt) => {
    if (!activeTicket || isAiTyping) return;
    const rawPrompt = (typeof customPrompt === "string" ? customPrompt : composerText).trim();
    const cleanDesc = (activeTicket.thread[0]?.text || "")
      .replace(/^Requester:[^\n]*\n*/i, "")
      .trim();
    const ticketContext = `${activeTicket.subject}\n${cleanDesc}`.trim();
    const promptToSend = rawPrompt
      ? [
          `Ticket: ${activeTicket.subject}`,
          cleanDesc ? `Description: ${cleanDesc}` : "",
          `Question: ${rawPrompt}`,
        ]
          .filter(Boolean)
          .join("\n")
      : ticketContext;
    if (!promptToSend) return;

    const targetTicketId = activeTicket.id;
    setErrorBanner("");
    if (rawPrompt) {
      setComposerText("");
      appendLocalAiMessages(targetTicketId, [
        {
          id: "m-" + Date.now(),
          type: "customer",
          author: `${activeTicket.requester.name} (AI Query)`,
          time: "Just now",
          text: rawPrompt,
        },
      ]);
    }

    setIsAiTyping(true);
    try {
      const resp = await post("/chat", {
        session_id: "agent-" + targetTicketId,
        message: promptToSend,
        role: currentUser?.role || "agent",
      });

      appendLocalAiMessages(
        targetTicketId,
        [
          {
            id: "ai-" + Date.now(),
            type: "ai",
            author: "ApexDesk AI",
            time: "Just now",
            text: resp.reply || "(Empty response returned by AI)",
            citations: resp.citations || [],
            action_taken: resp.action_taken || null,
            escalated: Boolean(resp.escalated),
            latency_ms: resp.latency_ms,
          },
        ],
        resp.escalated ? "escalated" : undefined
      );
    } catch (err) {
      setErrorBanner(`AI reply failed: ${err.message}`);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSend = async () => {
    if (!composerText.trim() || !activeTicket || isSending || isAiTyping) return;

    if (composerMode === "ai") {
      handleAskAi(composerText);
      return;
    }

    const messageText = composerText.trim();
    setErrorBanner("");
    setIsSending(true);
    try {
      const endpoint =
        composerMode === "internal"
          ? `/tickets/${activeTicket.dbId}/notes`
          : `/tickets/${activeTicket.dbId}/reply`;
      const updatedTicket = await post(endpoint, { message: messageText });
      syncUpdatedTicket(updatedTicket);
      setComposerText("");
    } catch (err) {
      setErrorBanner(`Failed to send ${composerMode === "internal" ? "internal note" : "reply"}: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handlePatchTicket = async (patchBody) => {
    if (!activeTicket?.dbId) return;
    setErrorBanner("");
    try {
      const updatedTicket = await adminPatch(`/tickets/${activeTicket.dbId}`, patchBody);
      syncUpdatedTicket(updatedTicket);
    } catch (err) {
      setErrorBanner(`Failed to update ticket: ${err.message}`);
    }
  };

  const handleApproveAction = async (toolName) => {
    if (!activeTicket?.dbId) return;
    setErrorBanner("");
    try {
      const pendingNote = [...(activeTicket.thread || [])]
        .reverse()
        .find((n) => n.pendingTool && n.pendingTool.tool === toolName);

      let args = pendingNote?.pendingTool?.arguments;
      if (!args) {
        if (toolName === "reset_password") {
          args = { username: activeTicket.requester.email };
        } else if (toolName === "request_software_access") {
          args = {
            username: activeTicket.requester.email,
            software_name: activeTicket.subject || "Requested Software",
            justification: `Approved via ${activeTicket.id} by ${sessionName || "Support Staff"}`,
            access_level: "standard",
          };
        } else {
          args = { reason: `Approved by ${sessionName || "Support Staff"} for ${activeTicket.id}` };
        }
      }

      const updatedTicket = await post(`/tickets/${activeTicket.dbId}/approve-action`, {
        tool_name: toolName,
        arguments: args,
        resolve_ticket: toolName === "reset_password" || toolName === "request_software_access",
      });
      syncUpdatedTicket(updatedTicket);
    } catch (err) {
      setErrorBanner(`Failed to approve tool action: ${err.message}`);
    }
  };

  const handleInsertSOP = (sop) => {
    const stepsList = Array.isArray(sop.steps) && sop.steps.length > 0 ? sop.steps : [sop.snippet];
    const formattedSteps = stepsList
      .map((step, idx) => (/^\d+\./.test(step) ? step : `${idx + 1}. ${step}`))
      .join("\n");
    const sourceMeta = [sop.source, sop.section].filter(Boolean).join(" § ");
    setComposerMode("customer");
    setComposerText(
      `Hello ${activeTicket.requester.name.split(" ")[0]},\n\nI reviewed our internal SOP "${sop.title}"${sourceMeta ? ` (${sourceMeta})` : ""}. Here are the resolution steps:\n\n${formattedSteps}\n\nPlease let me know if this resolves your issue.`
    );
  };

  const assigneeOptions = Array.from(
    new Set(["Unassigned", ...(sessionName ? [sessionName] : []), "Jane Doe", "Jordan Vance", activeTicket?.assignee].filter(Boolean))
  );

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden", backgroundColor: "#ffffff" }}>
      {/* PANE 1: LEFT TICKET LIST */}
      <div
        style={{
          width: "320px",
          minWidth: "290px",
          borderRight: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Agent Inbox
              </h2>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px", backgroundColor: "#e2e8f0", color: "#475569" }}>
                {filteredTickets.length}
              </span>
            </div>
            <button
              onClick={loadTickets}
              title="Refresh tickets"
              style={{ border: "none", background: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
            >
              <RefreshCw size={13} className={loading ? "pulse-dot" : ""} />
            </button>
          </div>

          {/* Filter Pills including Assigned to me */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All" },
              { id: "mine", label: "Assigned to me" },
              { id: "unassigned", label: "Unassigned" },
              { id: "urgent", label: "Urgent/High" },
              { id: "escalated", label: "Escalated" },
              { id: "open", label: "Active" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterView(f.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "5px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: filterView === f.id ? "#0f172a" : "#ffffff",
                  color: filterView === f.id ? "#ffffff" : "#64748b",
                  border: filterView === f.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "6px 10px",
            }}
          >
            <Search size={13} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filter tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "12px", width: "100%", color: "#0f172a", backgroundColor: "transparent" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "24px", fontSize: "12.5px", color: "#64748b", textAlign: "center" }}>
              Loading live tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: "24px", fontSize: "12.5px", color: "#64748b", textAlign: "center" }}>
              No tickets match this filter.
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = activeTicket && t.id === activeTicket.id;
              const badge = getStatusBadge(t.status);
              const dot = getPriorityDot(t.priority);

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#ffffff" : "transparent",
                    borderLeft: isSelected ? "3px solid #4f46e5" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: dot }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", fontFamily: "JetBrains Mono, monospace" }}>
                        {t.id}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>{t.timeAgo}</span>
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? "#0f172a" : "#334155",
                      lineHeight: 1.35,
                      marginBottom: "6px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.subject}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.requester.name} • {formatAuthorLabel(t.assignee)}
                    </span>
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PANE 2 & 3 */}
      {!activeTicket ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "14px" }}>
          {errorBanner ? errorBanner : "Select a ticket from the inbox to inspect details."}
        </div>
      ) : (
        <>
          {/* PANE 2: CENTER ACTIVE THREAD & COMPOSER */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0, backgroundColor: "#ffffff" }}>
            <div
              style={{
                height: "56px",
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#64748b",
                    backgroundColor: "#f1f5f9",
                    padding: "3px 7px",
                    borderRadius: "5px",
                  }}
                >
                  {activeTicket.id}
                </span>
                <h1 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeTicket.subject}
                </h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                {(() => {
                  const statusBadge = getStatusBadge(activeTicket.status);
                  const slaColors =
                    activeTicket.slaStatus === "met"
                      ? { bg: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" }
                      : activeTicket.slaStatus === "breached"
                      ? { bg: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }
                      : { bg: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
                  return (
                    <>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 9px",
                          borderRadius: "5px",
                          backgroundColor: statusBadge.bg,
                          color: statusBadge.text,
                          border: `1px solid ${statusBadge.border}`,
                        }}
                      >
                        {statusBadge.label}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          padding: "4px 9px",
                          borderRadius: "5px",
                          backgroundColor: slaColors.bg,
                          color: slaColors.color,
                          border: slaColors.border,
                        }}
                      >
                        {activeTicket.slaStatus === "met" ? (
                          <CheckCircle2 size={12} />
                        ) : activeTicket.slaStatus === "breached" ? (
                          <AlertCircle size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        <span>{activeTicket.slaLabel || (activeTicket.status === "resolved" ? "SLA Met" : "SLA Active")}</span>
                      </div>
                    </>
                  );
                })()}

                {activeTicket.status === "resolved" ? (
                  <button
                    onClick={() => handlePatchTicket({ status: "open" })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 11px",
                      borderRadius: "5px",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Reopen</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePatchTicket({ status: "resolved" })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 11px",
                      borderRadius: "5px",
                      backgroundColor: "#059669",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Check size={13} />
                    <span>Resolve</span>
                  </button>
                )}
              </div>
            </div>

            {errorBanner && (
              <div
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#fef2f2",
                  borderBottom: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={15} color="#dc2626" />
                  <span>{errorBanner}</span>
                </div>
                <button
                  onClick={() => setErrorBanner("")}
                  style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Conversation Thread */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                backgroundColor: "#fafbfc",
              }}
            >
              {activeTicket.thread.map((msg) => {
                const isInternal = msg.type === "internal";
                const isSystem = msg.type === "system";
                const isAi = msg.type === "ai";
                const isAgent = msg.type === "agent";

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        backgroundColor: "#f1f5f9",
                        border: "1px dashed #cbd5e1",
                        fontSize: "12.5px",
                        color: "#475569",
                      }}
                    >
                      <Bot size={16} color="#4f46e5" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong style={{ color: "#0f172a" }}>{formatAuthorLabel(msg.author)}:</strong> {msg.text}
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>{msg.time}</div>
                      </div>
                    </div>
                  );
                }

                const roleBadge = isInternal
                  ? { label: "INTERNAL NOTE (Staff Only)", bg: "#fef3c7", color: "#92400e", border: "#fde68a" }
                  : isAi
                  ? { label: "AI REPLY (RAG)", bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" }
                  : isAgent
                  ? { label: "HUMAN AGENT REPLY", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" }
                  : { label: "CUSTOMER", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };

                const authorDisplay = formatAuthorLabel(msg.author);

                return (
                  <div
                    key={msg.id}
                    style={{
                      borderRadius: "8px",
                      border: isInternal
                        ? "1px solid #fde68a"
                        : isAi
                        ? "1px solid #c7d2fe"
                        : isAgent
                        ? "1px solid #a7f3d0"
                        : "1px solid #e2e8f0",
                      backgroundColor: isInternal ? "#fffbeb" : isAi ? "#fafbff" : "#ffffff",
                      padding: "16px 18px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <div
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            backgroundColor: isInternal ? "#d97706" : isAi ? "#4f46e5" : isAgent ? "#059669" : "#2563eb",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isInternal ? <Lock size={12} /> : isAi ? <Bot size={13} /> : msg.author.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{authorDisplay}</span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.color,
                            border: `1px solid ${roleBadge.border}`,
                          }}
                        >
                          {roleBadge.label}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>{msg.time}</span>
                    </div>

                    <div
                      style={{
                        fontSize: "13.5px",
                        lineHeight: 1.55,
                        color: isInternal ? "#78350f" : "#1e293b",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {msg.text}
                    </div>

                    {isAi && (msg.citations?.length > 0 || msg.action_taken || msg.latency_ms) && (
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "8px",
                          borderTop: "1px solid #e0e7ff",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          alignItems: "center",
                          fontSize: "11px",
                          color: "#4338ca",
                        }}
                      >
                        {msg.citations?.map((c, idx) => (
                          <span
                            key={idx}
                            title={c.snippet || ""}
                            style={{ padding: "2px 7px", borderRadius: "4px", backgroundColor: "#eef2ff", border: "1px solid #c7d2fe", fontWeight: 600 }}
                          >
                            SOP: {c.title}
                            {c.source
                              ? ` (${c.source}${c.section ? ` § ${c.section}` : ""})`
                              : c.section
                              ? ` § ${c.section}`
                              : ""}
                          </span>
                        ))}
                        {msg.action_taken && (
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: "4px",
                              backgroundColor: msg.escalated ? "#fef3c7" : "#ecfdf5",
                              color: msg.escalated ? "#92400e" : "#047857",
                              fontWeight: 600,
                            }}
                          >
                            Tool: {msg.action_taken}
                          </span>
                        )}
                        {msg.latency_ms && <span style={{ color: "#64748b" }}>{msg.latency_ms} ms</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {isAiTyping && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #c7d2fe",
                    backgroundColor: "#eef2ff",
                    color: "#4338ca",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <Bot size={16} className="pulse-dot" />
                  <span>ApexDesk AI is retrieving SOPs and typing a reply...</span>
                </div>
              )}
            </div>

            {/* Center Composer Box */}
            <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 20px 14px", backgroundColor: "#ffffff" }}>
              <div
                style={{
                  marginBottom: "10px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "11.5px",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Sparkles size={13} color="#4f46e5" style={{ flexShrink: 0 }} />
                <span>
                  <strong>AI Reply</strong> calls <code>POST /chat</code> for an automated RAG answer.{" "}
                  <strong>Human Agent Reply</strong> sends a persisted staff response authored by{" "}
                  <strong>{sessionName || "current user"}</strong>.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setComposerMode("customer")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: composerMode === "customer" ? "#059669" : "#f1f5f9",
                    color: composerMode === "customer" ? "#ffffff" : "#64748b",
                  }}
                >
                  <Mail size={13} />
                  <span>Human Agent Reply</span>
                </button>

                <button
                  onClick={() => setComposerMode("ai")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: composerMode === "ai" ? "#4f46e5" : "#f1f5f9",
                    color: composerMode === "ai" ? "#ffffff" : "#64748b",
                  }}
                >
                  <Bot size={13} />
                  <span>Ask AI (RAG Reply)</span>
                </button>

                <button
                  onClick={() => setComposerMode("internal")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: composerMode === "internal" ? "#d97706" : "#f1f5f9",
                    color: composerMode === "internal" ? "#ffffff" : "#64748b",
                  }}
                >
                  <Lock size={13} />
                  <span>Internal Note</span>
                </button>
              </div>

              <div
                style={{
                  border:
                    composerMode === "internal"
                      ? "1px solid #fde68a"
                      : composerMode === "ai"
                      ? "1px solid #c7d2fe"
                      : "1px solid #cbd5e1",
                  borderRadius: "8px",
                  backgroundColor: composerMode === "internal" ? "#fffbeb" : "#ffffff",
                  padding: "10px 12px",
                }}
              >
                <textarea
                  rows={3}
                  disabled={isAiTyping || isSending}
                  placeholder={
                    composerMode === "ai"
                      ? "Ask AI-HAS a question or test an IT prompt via POST /chat..."
                      : composerMode === "internal"
                      ? `Add an internal staff note as ${sessionName || "Support Staff"}...`
                      : `Write a manual reply to ${activeTicket.requester.name} as ${sessionName || "Support Staff"}...`
                  }
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      handleSend();
                    }
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    color: "#0f172a",
                    resize: "none",
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #f1f5f9", gap: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Press <strong>⌘ + Enter</strong> to send
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {composerMode !== "ai" && (
                      <button
                        type="button"
                        disabled={isAiTyping || isSending}
                        onClick={() => handleAskAi(composerText)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: "1px solid #c7d2fe",
                          cursor: isAiTyping ? "not-allowed" : "pointer",
                          backgroundColor: "#eef2ff",
                          color: "#4338ca",
                        }}
                      >
                        <Sparkles size={13} />
                        <span>{isAiTyping ? "AI Thinking..." : "Ask AI Instead"}</span>
                      </button>
                    )}

                    <button
                      onClick={handleSend}
                      disabled={isAiTyping || isSending}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        borderRadius: "6px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        border: "none",
                        cursor: isAiTyping || isSending ? "not-allowed" : "pointer",
                        backgroundColor: composerMode === "internal" ? "#d97706" : composerMode === "ai" ? "#4f46e5" : "#059669",
                        color: "#ffffff",
                      }}
                    >
                      <Send size={13} />
                      <span>
                        {isAiTyping
                          ? "Waiting for AI..."
                          : isSending
                          ? "Saving..."
                          : composerMode === "ai"
                          ? "Send to AI"
                          : composerMode === "internal"
                          ? "Add Note"
                          : "Send Human Reply"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PANE 3: RIGHT INSPECTOR PANEL */}
          <div
            style={{
              width: "280px",
              minWidth: "260px",
              borderLeft: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px 0" }}>
                Ticket Properties
              </h3>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                  Status
                </label>
                <select
                  value={activeTicket.status}
                  onChange={(e) => handlePatchTicket({ status: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff", color: "#0f172a", fontWeight: 600 }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                  Assignee
                </label>
                <select
                  value={activeTicket.assignee}
                  onChange={(e) => handlePatchTicket({ assignee: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff", color: "#0f172a", fontWeight: 600 }}
                >
                  {assigneeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatAuthorLabel(opt)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                  Priority
                </label>
                <select
                  value={activeTicket.priority}
                  onChange={(e) => handlePatchTicket({ priority: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff", color: "#0f172a", fontWeight: 600 }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                {[`#${activeTicket.priority}`, `#${activeTicket.status}`].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: "4px",
                      backgroundColor: "#e2e8f0",
                      color: "#334155",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>
                  Approve Tool Action
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleApproveAction("reset_password")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #a7f3d0",
                      backgroundColor: "#ecfdf5",
                      color: "#047857",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve Password Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApproveAction("request_software_access")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #c7d2fe",
                      backgroundColor: "#eef2ff",
                      color: "#4338ca",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Shield size={13} />
                    <span>Approve Software Access</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px 0" }}>
                Requester Profile
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: "#2563eb", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                  {activeTicket.requester.avatar}
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{activeTicket.requester.name}</div>
                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>{activeTicket.requester.dept}</div>
                </div>
              </div>
              <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div>
                  <span style={{ color: "#94a3b8" }}>Email: </span>
                  <span style={{ color: "#0f172a" }}>{activeTicket.requester.email}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#059669", fontWeight: 600 }}>
                  <Shield size={13} />
                  <span>Intune MDM Compliant</span>
                </div>
              </div>
            </div>

            {activeTicket.status !== "resolved" && activeTicket.suggestedSOP && (
              <div style={{ padding: "16px" }}>
                <div style={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #c7d2fe", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={14} color="#4f46e5" />
                      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4f46e5" }}>
                        AI Match ({activeTicket.suggestedSOP.confidence_pct ?? Math.round((activeTicket.suggestedSOP.score || 0) * 100)}%)
                      </span>
                    </div>
                    {activeTicket.suggestedSOP.source && (
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                        {activeTicket.suggestedSOP.source}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                    {activeTicket.suggestedSOP.title}
                  </div>
                  {activeTicket.suggestedSOP.section && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#4f46e5", marginBottom: "6px" }}>
                      Section: {activeTicket.suggestedSOP.section}
                    </div>
                  )}
                  <p style={{ fontSize: "11.5px", color: "#64748b", lineHeight: 1.4, margin: "0 0 10px 0" }}>
                    {activeTicket.suggestedSOP.snippet}
                  </p>
                  <button
                    onClick={() => handleInsertSOP(activeTicket.suggestedSOP)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      backgroundColor: "#eef2ff",
                      color: "#4f46e5",
                      border: "1px solid #c7d2fe",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <CornerDownRight size={12} />
                    <span>Insert Steps to Reply</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
