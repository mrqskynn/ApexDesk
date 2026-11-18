"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalHeader from "../../components/PortalHeader";
import { apiFetch, post } from "../../lib/api";
import {
  Search,
  Filter,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  Shield,
  X,
  Send,
  User,
  Bot,
  ExternalLink,
  Laptop,
  KeyRound,
  Wifi,
} from "lucide-react";

const INITIAL_TICKETS = [
  {
    id: "TICK-4029",
    title: "Cannot connect to Cisco AnyConnect VPN after macOS Sonoma 14.5 update",
    category: "VPN & Network",
    status: "in_progress",
    priority: "high",
    createdAt: "2 hours ago",
    updatedAt: "25 mins ago",
    assignedTo: "Sarah Chen (Network Ops)",
    requester: "You",
    summary: "Receiving 'Posture assessment failed: gateway certificate untrusted' error message whenever attempting to connect to Corp-US-East gateway.",
    conversation: [
      {
        sender: "You",
        role: "user",
        time: "2 hours ago",
        text: "Hi, I just upgraded to macOS Sonoma 14.5 during lunch and now Cisco AnyConnect refuses to connect. It gives a gateway certificate warning.",
      },
      {
        sender: "ApexDesk AI",
        role: "ai",
        time: "1 hour 58 mins ago",
        text: "I scanned our SOP library and matched 'Corporate VPN Troubleshooting' [SOP-004]. Suggested action: please clear your keychain DNS cache and reinstall the root CA profile.",
      },
      {
        sender: "Sarah Chen (Network Ops)",
        role: "agent",
        time: "25 mins ago",
        text: "Hi! I see this is affecting Sonoma users today. I just pushed an updated MDM profile to your MacBook. Please restart AnyConnect and test again.",
      },
    ],
  },
  {
    id: "TICK-3914",
    title: "Figma Enterprise license invitation expired",
    category: "Software & Licenses",
    status: "resolved",
    priority: "medium",
    createdAt: "Yesterday",
    updatedAt: "Yesterday at 4:15 PM",
    assignedTo: "L1 Automated Provisioning",
    requester: "You",
    summary: "Requesting re-sending of the Figma Enterprise invitation link to joined team workspace.",
    conversation: [
      {
        sender: "You",
        role: "user",
        time: "Yesterday",
        text: "My Figma invite link expired before I was able to accept it over the weekend.",
      },
      {
        sender: "ApexDesk AI",
        role: "ai",
        time: "Yesterday",
        text: "Automatic Okta SCIM sync triggered. Invitation re-sent to your corporate inbox.",
      },
    ],
  },
  {
    id: "TICK-3820",
    title: "Request for external Dell 4K USB-C monitor and docking hub",
    category: "Hardware",
    status: "open",
    priority: "low",
    createdAt: "3 days ago",
    updatedAt: "3 days ago",
    assignedTo: "IT Logistics Queue",
    requester: "You",
    summary: "Standard ergonomic equipment requisition for new desk setup in Bldg B, 3rd Floor.",
    conversation: [
      {
        sender: "You",
        role: "user",
        time: "3 days ago",
        text: "Submitted equipment request form for dual Dell 27' 4K monitors.",
      },
    ],
  },
  {
    id: "TICK-3788",
    title: "Suspicious calendar invite with external tracking link",
    category: "Security Incident",
    status: "escalated",
    priority: "urgent",
    createdAt: "Nov 14",
    updatedAt: "Nov 14 at 11:20 AM",
    assignedTo: "SecOps Incident Response",
    requester: "You",
    summary: "Received unsolicited meeting invite pretending to be CEO executive assistant.",
    conversation: [
      {
        sender: "You",
        role: "user",
        time: "Nov 14",
        text: "Reporting suspicious meeting invite from unknown external Gmail address asking for wire info.",
      },
      {
        sender: "ApexDesk AI",
        role: "ai",
        time: "Nov 14",
        text: "Escalated to human Security Operations immediately. Quarantine rule enacted on domain.",
      },
    ],
  },
];

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyInput, setReplyInput] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [replyError, setReplyError] = useState("");

  const loadRealTickets = () => {
    setLoading(true);
    setLoadError("");
    apiFetch("/tickets")
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((t) => {
            const timeAgo = t.created_at ? formatTimeAgo(t.created_at) : "Recently";
            const persistedReplies = Array.isArray(t.notes)
              ? t.notes.map((n) => ({
                  sender: n.author || "Support Staff",
                  role: n.type === "ai" ? "ai" : "agent",
                  time: formatTimeAgo(n.time),
                  text: n.text || "",
                }))
              : [];

            return {
              id: "TICK-" + t.id,
              dbId: t.id,
              title: t.title,
              category: t.title.toLowerCase().includes("vpn") ? "Network" : t.title.toLowerCase().includes("password") || t.title.toLowerCase().includes("mfa") ? "Access" : "General IT",
              status: t.status,
              priority: t.priority,
              createdAt: timeAgo,
              updatedAt: timeAgo,
              assignedTo: t.assignee || "IT Triage Queue",
              requester: "You",
              summary: t.description || t.title,
              conversation: [
                {
                  sender: "You",
                  role: "user",
                  time: timeAgo,
                  text: t.description || t.title,
                },
                ...persistedReplies,
              ],
            };
          });

          setTickets(mapped);
        }
      })
      .catch((err) => {
        console.error("Failed to load user tickets:", err);
        setLoadError(`Could not load your tickets: ${err.message}`);
        setTickets([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRealTickets();
  }, []);

  const formatTimeAgo = (iso) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${Math.max(1, mins)} mins ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "Recently";
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesFilter = filterStatus === "all" || t.status === filterStatus;
    const matchesSearch =
      searchQuery === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "open":
        return { label: "Open", color: "#2563eb", bg: "#eff6ff" };
      case "in_progress":
        return { label: "In Progress", color: "#d97706", bg: "#fef3c7" };
      case "escalated":
        return { label: "Escalated to Agent", color: "#7c3aed", bg: "#f5f3ff" };
      case "resolved":
        return { label: "Resolved", color: "#059669", bg: "#ecfdf5" };
      default:
        return { label: status, color: "#64748b", bg: "#f1f5f9" };
    }
  };

  const getPriorityDot = (priority) => {
    switch (priority) {
      case "urgent":
        return "#dc2626";
      case "high":
        return "#ea580c";
      case "medium":
        return "#2563eb";
      default:
        return "#94a3b8";
    }
  };

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedTicket || replySending) return;
    const userText = replyInput.trim();
    const targetId = selectedTicket.id;
    setReplyInput("");
    setReplyError("");
    setReplySending(true);

    const userMsg = {
      sender: "You",
      role: "user",
      time: "Just now",
      text: userText,
    };

    const appendMsgs = (msgs, newStatus) => {
      setSelectedTicket((prev) =>
        prev && prev.id === targetId
          ? {
              ...prev,
              conversation: [...prev.conversation, ...msgs],
              status: newStatus || prev.status,
              updatedAt: "Just now",
            }
          : prev
      );
      setTickets((prev) =>
        prev.map((t) =>
          t.id === targetId
            ? {
                ...t,
                conversation: [...t.conversation, ...msgs],
                status: newStatus || t.status,
                updatedAt: "Just now",
              }
            : t
        )
      );
    };

    appendMsgs([userMsg]);

    try {
      const cleanSummary = (selectedTicket.summary || "")
        .replace(/^Requester:[^\n]*\n*/i, "")
        .trim();
      const contextualMessage = [
        `Ticket: ${selectedTicket.title}`,
        cleanSummary ? `Description: ${cleanSummary}` : "",
        `Question: ${userText}`,
      ]
        .filter(Boolean)
        .join("\n");

      const resp = await post("/chat", {
        session_id: "ticket-" + (selectedTicket.dbId || selectedTicket.id),
        message: contextualMessage,
        role: "user",
      });

      const aiMsg = {
        sender: "ApexDesk AI",
        role: "ai",
        time: "Just now",
        text: resp.reply,
        citations: resp.citations || [],
      };

      appendMsgs([aiMsg], resp.escalated ? "escalated" : undefined);
    } catch (err) {
      console.error("AI reply failed:", err);
      setReplyError(`Could not get AI reply: ${err.message}`);
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--portal-bg)", display: "flex", flexDirection: "column" }}>
      <PortalHeader />

      <main style={{ flex: 1, padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          
          {/* Page Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--portal-text-primary)", letterSpacing: "-0.02em", margin: "0 0 6px 0" }}>
                My Support Requests
              </h1>
              <p style={{ fontSize: "14px", color: "var(--portal-text-secondary)", margin: 0 }}>
                Track active requests, reply to IT technicians, and check real-time resolution updates.
              </p>
            </div>

            <Link
              href="/submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 20px",
                borderRadius: "12px",
                backgroundColor: "var(--portal-primary)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 4px 10px rgba(37, 99, 235, 0.24)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--portal-primary-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--portal-primary)")}
            >
              <PlusCircle size={16} />
              <span>Submit a Request</span>
            </Link>
          </div>

          {loadError && (
            <div
              style={{
                marginBottom: "18px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} />
                <span>{loadError} (showing cached fallback data)</span>
              </div>
              <button
                onClick={() => setLoadError("")}
                style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Controls: Search + Filter Tabs */}
          <div
            style={{
              backgroundColor: "var(--portal-card-bg)",
              borderRadius: "14px",
              border: "1px solid var(--portal-border)",
              padding: "16px 20px",
              marginBottom: "24px",
              boxShadow: "var(--portal-shadow-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flex: "1 1 280px",
                backgroundColor: "#f8fafc",
                borderRadius: "10px",
                padding: "8px 14px",
                border: "1px solid var(--portal-border)",
              }}
            >
              <Search size={16} color="#64748b" />
              <input
                type="text"
                placeholder="Search by ticket #, keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  outline: "none",
                  fontSize: "14px",
                  color: "var(--portal-text-primary)",
                  width: "100%",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {[
                { id: "all", label: "All Tickets" },
                { id: "open", label: "Open" },
                { id: "in_progress", label: "In Progress" },
                { id: "escalated", label: "Escalated" },
                { id: "resolved", label: "Resolved" },
              ].map((tab) => {
                const isActive = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      backgroundColor: isActive ? "#0f172a" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#475569",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket Card List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filteredTickets.length > 0 ? (
              filteredTickets.map((t) => {
                const badge = getStatusBadge(t.status);
                const dot = getPriorityDot(t.priority);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    style={{
                      backgroundColor: "var(--portal-card-bg)",
                      borderRadius: "14px",
                      border: "1px solid var(--portal-border)",
                      padding: "20px 24px",
                      boxShadow: "var(--portal-shadow-sm)",
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "20px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#94a3b8";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "var(--portal-shadow-md)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--portal-border)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "var(--portal-shadow-sm)";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                          {t.id}
                        </span>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: badge.color }} />
                          {badge.label}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--portal-text-muted)" }}>•</span>
                        <span style={{ fontSize: "12px", color: "var(--portal-text-muted)" }}>{t.category}</span>
                      </div>

                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--portal-text-primary)",
                          letterSpacing: "-0.01em",
                          margin: "0 0 6px 0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.title}
                      </h3>

                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--portal-text-secondary)",
                          margin: "0 0 10px 0",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {t.summary}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--portal-text-muted)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: dot }} />
                          <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--portal-text-secondary)" }}>
                            {t.priority}
                          </span>
                        </span>
                        <span>Updated {t.updatedAt}</span>
                        <span>•</span>
                        <span>Assignee: {t.assignedTo}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#64748b",
                          backgroundColor: "#f1f5f9",
                          padding: "6px 10px",
                          borderRadius: "8px",
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>{t.conversation.length}</span>
                      </div>
                      <ChevronRight size={18} color="#94a3b8" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  backgroundColor: "var(--portal-card-bg)",
                  borderRadius: "14px",
                  border: "1px dashed var(--portal-border)",
                  padding: "48px 24px",
                  textAlign: "center",
                }}
              >
                <Clock size={32} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--portal-text-primary)", margin: "0 0 6px 0" }}>
                  No requests found
                </h3>
                <p style={{ fontSize: "13px", color: "var(--portal-text-muted)", margin: "0 0 20px 0" }}>
                  There are no requests matching your current filter criteria.
                </p>
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setSearchQuery("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "#f1f5f9",
                    color: "var(--portal-text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ================= DETAIL MODAL / DRAWER ================= */}
      {selectedTicket && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setSelectedTicket(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              height: "100%",
              backgroundColor: "#ffffff",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 0.25s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--portal-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "#64748b" }}>
                    {selectedTicket.id}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      ...getStatusBadge(selectedTicket.status),
                    }}
                  >
                    {getStatusBadge(selectedTicket.status).label}
                  </span>
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--portal-text-primary)", margin: 0 }}>
                  {selectedTicket.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{
                  border: "none",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "8px",
                  padding: "8px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Meta Info */}
            <div
              style={{
                padding: "12px 24px",
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid var(--portal-border)",
                display: "flex",
                gap: "24px",
                fontSize: "12px",
                color: "var(--portal-text-secondary)",
              }}
            >
              <div>
                <strong>Assignee:</strong> {selectedTicket.assignedTo}
              </div>
              <div>
                <strong>Priority:</strong> {selectedTicket.priority}
              </div>
              <div>
                <strong>Category:</strong> {selectedTicket.category}
              </div>
            </div>

            {/* Conversation Timeline */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {selectedTicket.conversation.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isAi = msg.role === "ai";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "11px", color: "#94a3b8" }}>
                      {isAi ? <Bot size={12} color="#2563eb" /> : isUser ? <User size={12} /> : <Shield size={12} color="#059669" />}
                      <span style={{ fontWeight: 600, color: "#475569" }}>{msg.sender}</span>
                      {!isUser && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: isAi ? "#eef2ff" : "#ecfdf5",
                            color: isAi ? "#4338ca" : "#047857",
                          }}
                        >
                          {isAi ? "AI Reply" : "Human Agent Reply"}
                        </span>
                      )}
                      <span>• {msg.time}</span>
                    </div>

                    <div
                      style={{
                        maxWidth: "85%",
                        padding: "12px 16px",
                        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        backgroundColor: isUser ? "var(--portal-primary)" : isAi ? "#f1f5f9" : "#eff6ff",
                        color: isUser ? "#ffffff" : "var(--portal-text-primary)",
                        fontSize: "13.5px",
                        lineHeight: 1.5,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        border: isUser ? "none" : isAi ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {msg.text}
                      {isAi && msg.citations && msg.citations.length > 0 && (
                        <div
                          style={{
                            marginTop: "8px",
                            paddingTop: "8px",
                            borderTop: "1px solid #cbd5e1",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "5px",
                          }}
                        >
                          {msg.citations.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              title={c.snippet || ""}
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: "4px",
                                backgroundColor: "#eef2ff",
                                border: "1px solid #c7d2fe",
                                color: "#4338ca",
                              }}
                            >
                              {c.title}
                              {c.source
                                ? ` (${c.source}${c.section ? ` § ${c.section}` : ""})`
                                : c.section
                                ? ` § ${c.section}`
                                : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {replySending && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    backgroundColor: "#eef2ff",
                    border: "1px solid #c7d2fe",
                    color: "#4338ca",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    alignSelf: "flex-start",
                  }}
                >
                  <Bot size={14} className="pulse-dot" />
                  <span>ApexDesk AI is checking SOPs and typing a reply...</span>
                </div>
              )}
            </div>

            {replyError && (
              <div
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#fef2f2",
                  borderTop: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{replyError}</span>
                <button
                  onClick={() => setReplyError("")}
                  style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Reply Bar */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--portal-border)",
                backgroundColor: "#ffffff",
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                disabled={replySending}
                placeholder="Ask AI or send a follow-up message..."
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--portal-border)",
                  fontSize: "13.5px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={replySending}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  backgroundColor: "var(--portal-primary)",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  border: "none",
                  cursor: replySending ? "not-allowed" : "pointer",
                  opacity: replySending ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={14} />
                <span>{replySending ? "Waiting..." : "Reply"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
