"use client";

import { useState } from "react";
import Link from "next/link";
import PortalHeader from "../components/PortalHeader";
import {
  Search,
  KeyRound,
  Wifi,
  Laptop,
  Layers,
  Mail,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { post } from "../lib/api";

const CATEGORIES = [
  {
    id: "access",
    title: "Account & Access",
    desc: "Single Sign-On (SSO), Active Directory passwords, MFA token resets, and account unlock procedures.",
    icon: KeyRound,
    badge: "3 SOPs",
    color: "#2563eb",
    bg: "#eff6ff",
    articles: ["Password Reset Guide", "MFA Setup & Authenticator", "Account Lockout Resolution"],
  },
  {
    id: "vpn",
    title: "VPN & Remote Connectivity",
    desc: "GlobalProtect and Cisco VPN setup, DNS cache flushing, gateway selection, and home router firewall tips.",
    icon: Wifi,
    badge: "2 SOPs",
    color: "#0891b2",
    bg: "#ecfeff",
    articles: ["Corporate VPN Troubleshooting", "CorpNet Wi-Fi 802.1X Access", "Captive Portal Bypass"],
  },
  {
    id: "hardware",
    title: "Hardware & Workstations",
    desc: "Docking stations, external multi-monitors, MacBook & Windows laptop thermal throttling, and battery health.",
    icon: Laptop,
    badge: "4 SOPs",
    color: "#7c3aed",
    bg: "#f5f3ff",
    articles: ["Dual-Monitor Docking Setup", "BitLocker Recovery Keys", "Slow Laptop Performance Fix"],
  },
  {
    id: "software",
    title: "Software & SaaS Requests",
    desc: "Company Portal and Jamf Self-Service apps, Adobe Creative Cloud, Figma, JetBrains, and Slack licenses.",
    icon: Layers,
    badge: "3 SOPs",
    color: "#ea580c",
    bg: "#fff7ed",
    articles: ["Requesting Licensed Software", "Company Portal Installations", "SharePoint Permissions"],
  },
  {
    id: "email",
    title: "Email, Teams & Calendar",
    desc: "Outlook desktop profile caching, Microsoft Teams microphone & webcam permissions, and shared mailboxes.",
    icon: Mail,
    badge: "3 SOPs",
    color: "#059669",
    bg: "#ecfdf5",
    articles: ["Fixing Outlook Need Password", "Teams / Zoom Audio Permissions", "Adding Shared Mailbox"],
  },
  {
    id: "security",
    title: "Security & Device Compliance",
    desc: "Reporting phishing scams, Intune MDM compliance, lost or stolen hardware, and emergency device wipes.",
    icon: ShieldAlert,
    badge: "3 SOPs",
    color: "#dc2626",
    bg: "#fef2f2",
    articles: ["Reporting Phishing Emails", "Lost / Stolen Laptop Urgent SOP", "Intune Mobile MDM Setup"],
  },
];

export default function HelpCenterHome() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState("all");

  // AI Assistant Chat Widget State
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your AI-HAS IT Assistant. You can describe any IT problem, request a password reset, or ask how to connect to company tools.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const filteredCategories =
    searchQuery.trim() === ""
      ? CATEGORIES
      : CATEGORIES.filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.articles.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
        );

  async function handleSendChat(e) {
    e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || isTyping) return;

    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setIsTyping(true);

    try {
      const sessionId = "portal-" + (typeof window !== "undefined" ? window.sessionStorage?.getItem("sid") || "demo" : "demo");
      const resp = await post("/chat", {
        session_id: sessionId,
        message: prompt,
        role: "user",
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resp.reply,
          citations: resp.citations,
          action_taken: resp.action_taken,
          escalated: resp.escalated,
          latency_ms: resp.latency_ms,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error connecting to the IT Helpdesk backend: " + err.message,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", paddingBottom: "100px" }}>
      <PortalHeader />

      {/* Screen 1: Full-width Hero Banner with large centered search */}
      <section
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
          borderBottom: "1px solid #e2e8f0",
          padding: "72px 24px 64px 24px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative background circles */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "680px",
            height: "380px",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, rgba(255, 255, 255, 0) 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: "780px", margin: "0 auto", position: "relative" }}>
          {/* Status pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "999px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                display: "inline-block",
              }}
              className="pulse-dot"
            />
            <span>AI-HAS L1 Helpdesk Online &bull; Mean Resolution 14m</span>
          </div>

          <h1
            style={{
              fontSize: "44px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: "16px",
            }}
          >
            How can we help you today?
          </h1>

          <p
            style={{
              fontSize: "18px",
              color: "#64748b",
              lineHeight: 1.5,
              marginBottom: "36px",
              fontWeight: 400,
            }}
          >
            Instant self-service answers from 18 verified IT SOPs, automated password resets, and direct ticketing.
          </p>

          {/* Large, Centered Search Input */}
          <div
            style={{
              position: "relative",
              maxWidth: "680px",
              margin: "0 auto",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
              borderRadius: "16px",
              transition: "box-shadow 0.2s ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Search size={22} />
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for articles, guides, or describe your issue (e.g. VPN, MFA, Outlook)..."
              style={{
                width: "100%",
                padding: "20px 140px 20px 58px",
                fontSize: "16px",
                border: "1px solid #cbd5e1",
                borderRadius: "16px",
                outline: "none",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                transition: "border-color 0.18s ease, box-shadow 0.18s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#cbd5e1";
                e.target.style.boxShadow = "none";
              }}
            />

            <button
              onClick={() => setChatOpen(true)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "10px 18px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            >
              <Sparkles size={16} />
              <span>Ask AI</span>
            </button>
          </div>

          {/* Quick topic pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>Popular:</span>
            {["Password Reset", "VPN Connection", "MFA Setup", "Slow Laptop", "Docking Station"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#475569",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#eff6ff";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                  e.currentTarget.style.color = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.color = "#475569";
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Screen 1: 3-Column Grid of Category Cards with Subtle Icons & Hover Lift Effects */}
      <section style={{ maxWidth: "1160px", margin: "48px auto 0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Explore Help Categories
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
              Browse through our standard operating procedures and self-help articles.
            </p>
          </div>

          <Link
            href="/submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#2563eb",
              textDecoration: "none",
            }}
          >
            <span>Can't find it? Submit a Request</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* 3-Column Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "28px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow =
                    "0 14px 28px -6px rgba(0, 0, 0, 0.08), 0 6px 12px -4px rgba(0, 0, 0, 0.03)";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "18px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        backgroundColor: cat.bg,
                        color: cat.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={24} />
                    </div>

                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                      }}
                    >
                      {cat.badge}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: "8px",
                    }}
                  >
                    {cat.title}
                  </h3>

                  <p
                    style={{
                      fontSize: "14px",
                      color: "#64748b",
                      lineHeight: 1.5,
                      marginBottom: "20px",
                    }}
                  >
                    {cat.desc}
                  </p>
                </div>

                {/* Article quick links */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: "8px" }}>
                    Top Guides
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                    {cat.articles.map((art) => (
                      <li
                        key={art}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery(art);
                          setChatOpen(true);
                        }}
                        style={{
                          fontSize: "13px",
                          color: "#334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#2563eb")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <FileText size={13} color="#94a3b8" />
                          {art}
                        </span>
                        <ChevronRight size={14} color="#cbd5e1" />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Floating Action Button for Instant AI Assistant (Intercom / Zendesk style) */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "fixed",
          bottom: "84px",
          right: "24px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 20px",
          borderRadius: "999px",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#ffffff",
          border: "none",
          fontWeight: 600,
          fontSize: "14px",
          cursor: "pointer",
          boxShadow: "0 10px 25px -4px rgba(37, 99, 235, 0.45), 0 4px 6px -2px rgba(37, 99, 235, 0.2)",
          transition: "transform 0.18s ease, box-shadow 0.18s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Bot size={20} />
        <span>Ask AI Assistant</span>
      </button>

      {/* Live AI Drawer / Chat Box */}
      {chatOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            bottom: "144px",
            right: "24px",
            width: "390px",
            maxHeight: "560px",
            backgroundColor: "#ffffff",
            borderRadius: "18px",
            border: "1px solid #cbd5e1",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1001,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #1e293b, #0f172a)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(37, 99, 235, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>AI Helpdesk Bot</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>Answers grounded on 18 SOPs</div>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              &times;
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "380px",
              backgroundColor: "#f8fafc",
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  backgroundColor: m.role === "user" ? "#2563eb" : "#ffffff",
                  color: m.role === "user" ? "#ffffff" : "#0f172a",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  fontSize: "13px",
                  lineHeight: 1.45,
                  boxShadow: m.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
                  border: m.role === "user" ? "none" : "1px solid #e2e8f0",
                }}
              >
                <div>{m.content}</div>

                {/* Citations Preview */}
                {m.citations && m.citations.length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "6px",
                      borderTop: "1px solid #f1f5f9",
                      fontSize: "11px",
                      color: "#475569",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#2563eb" }}>Sources cited:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {m.citations.map((c, cIdx) => (
                        <span
                          key={cIdx}
                          title={c.snippet || ""}
                          style={{
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1d4ed8",
                            fontWeight: 600,
                            fontSize: "10.5px",
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
                  </div>
                )}

                {/* Metadata */}
                {m.latency_ms && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{m.latency_ms} ms</span>
                    {m.action_taken && <span>&bull; Action: {m.action_taken}</span>}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#ffffff",
                  padding: "10px 14px",
                  borderRadius: "14px",
                  fontSize: "12px",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={14} color="#2563eb" />
                <span>Searching knowledge base &amp; thinking...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSendChat}
            style={{
              padding: "12px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask an IT question..."
              style={{
                flex: 1,
                padding: "10px 12px",
                fontSize: "13px",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isTyping}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
