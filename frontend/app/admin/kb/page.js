"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  Upload,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
} from "lucide-react";
import { adminFetch } from "../../../lib/api";

const MOCK_SOPS = [
  { file: "sop_01_password_reset.md", title: "Active Directory & Okta Password Reset SOP", category: "Access", chunks: 3, updated: "2 days ago" },
  { file: "sop_02_mfa_setup.md", title: "Multi-Factor Authentication (MFA) Setup & Replacement", category: "Access", chunks: 4, updated: "3 days ago" },
  { file: "sop_03_account_lockout.md", title: "Account Lockout & Brute-Force Resolution", category: "Security", chunks: 2, updated: "4 days ago" },
  { file: "sop_04_vpn_troubleshooting.md", title: "Corporate VPN & GlobalProtect Connectivity Troubleshooting", category: "Network", chunks: 5, updated: "Yesterday" },
  { file: "sop_05_wifi_access.md", title: "CorpNet 802.1X Wireless Profile Provisioning", category: "Network", chunks: 3, updated: "1 week ago" },
  { file: "sop_06_captive_portal.md", title: "Captive Portal Bypass & Hotel Wi-Fi Configuration", category: "Network", chunks: 2, updated: "2 weeks ago" },
  { file: "sop_07_dual_monitors.md", title: "Thunderbolt & USB-C Multi-Monitor Docking Setup", category: "Hardware", chunks: 3, updated: "5 days ago" },
  { file: "sop_08_bitlocker_recovery.md", title: "BitLocker Recovery Key Retrieval from Intune", category: "Security", chunks: 4, updated: "3 days ago" },
  { file: "sop_09_laptop_performance.md", title: "Thermal Throttling & Background Service CPU Fixes", category: "Hardware", chunks: 3, updated: "1 week ago" },
  { file: "sop_10_licensed_software.md", title: "Licensed Software Requisition Workflow", category: "SaaS", chunks: 3, updated: "4 days ago" },
  { file: "sop_11_company_portal.md", title: "Company Portal & Jamf Self-Service Application Deployments", category: "SaaS", chunks: 4, updated: "2 weeks ago" },
  { file: "sop_12_phishing_report.md", title: "Phishing Email Reporting & Triage Protocol", category: "Security", chunks: 3, updated: "Yesterday" },
  { file: "sop_13_lost_stolen_device.md", title: "Lost or Stolen Device Emergency Wipe Procedure", category: "Security", chunks: 4, updated: "1 month ago" },
  { file: "sop_14_mobile_mdm.md", title: "Microsoft Intune Mobile MDM Enrollment", category: "Security", chunks: 3, updated: "2 weeks ago" },
  { file: "sop_15_outlook_password.md", title: "Fixing Outlook 'Need Password' Modern Auth Loop", category: "Email", chunks: 3, updated: "5 days ago" },
  { file: "sop_16_teams_permissions.md", title: "Microsoft Teams & Zoom Camera / Microphone Permissions", category: "AV", chunks: 3, updated: "3 days ago" },
  { file: "sop_17_shared_mailbox.md", title: "Delegated Shared Mailbox Access in Exchange Online", category: "Email", chunks: 2, updated: "1 week ago" },
  { file: "sop_18_hardware_requisition.md", title: "Hardware Ergonomics & Accessory Procurement", category: "Hardware", chunks: 2, updated: "2 weeks ago" },
];

export default function AdminKBPage() {
  const [sops, setSops] = useState(MOCK_SOPS);
  const [searchQuery, setSearchQuery] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);

  const [reindexError, setReindexError] = useState("");

  useEffect(() => {
    adminFetch("/kb/docs")
      .then((res) => {
        if (res && res.documents && res.documents.length > 0) {
          const live = res.documents.map((d) => {
            const fname = d.filename.toLowerCase();
            const category =
              fname.includes("vpn") || fname.includes("wifi") || fname.includes("portal")
                ? "Network"
                : fname.includes("password") || fname.includes("mfa") || fname.includes("lockout")
                ? "Access"
                : fname.includes("monitor") || fname.includes("laptop") || fname.includes("hardware")
                ? "Hardware"
                : fname.includes("software") || fname.includes("company")
                ? "SaaS"
                : "Security";

            return {
              file: d.filename,
              title: d.title || d.filename.replace(".md", "").replaceAll("_", " "),
              category: category,
              chunks: d.chunks || 3,
              updated: "Vector Synced",
            };
          });
          setSops(live);
        }
      })
      .catch((err) => {
        console.warn("[AdminKB] Using local SOP list (backend unreached):", err.message);
      });
  }, []);

  const handleReindex = () => {
    setReindexing(true);
    setReindexDone(false);
    setReindexError("");
    adminFetch("/kb/reindex", { method: "POST" })
      .then(() => {
        setReindexDone(true);
        setTimeout(() => setReindexDone(false), 4000);
      })
      .catch((err) => {
        setReindexError(err.message || "Failed to re-index ChromaDB collection.");
        setTimeout(() => setReindexError(""), 5000);
      })
      .finally(() => setReindexing(false));
  };

  const filtered = sops.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", backgroundColor: "#ffffff" }}>
      {/* Header */}
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
            Knowledge Base &amp; Vector Index
          </h1>
          <p style={{ fontSize: "12.5px", color: "#64748b", margin: 0 }}>
            Standard Operating Procedures (SOPs) indexed into ChromaDB for RAG semantic search.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {reindexDone && (
            <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={14} />
              ChromaDB Synchronized!
            </span>
          )}
          {reindexError && (
            <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} />
              {reindexError}
            </span>
          )}

          <button
            onClick={handleReindex}
            disabled={reindexing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "6px",
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: reindexing ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={13} className={reindexing ? "pulse-dot" : ""} />
            <span>{reindexing ? "Re-indexing..." : "Re-index ChromaDB"}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: "1200px" }}>
        
        {/* Top Info Stat Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ padding: "16px 18px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Indexed SOP Files</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{sops.length} Documents</div>
          </div>
          <div style={{ padding: "16px 18px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>ChromaDB Chunks</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#4f46e5", marginTop: "4px" }}>55 Embeddings</div>
          </div>
          <div style={{ padding: "16px 18px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Embedding Model</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>gemini-embedding-001</div>
          </div>
        </div>

        {/* Search & Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              flex: "1 1 300px",
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search SOP by title, filename, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "12.5px", width: "100%", color: "#0f172a" }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div style={{ borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>SOP Title</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Filename</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Category</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Chunks</th>
                <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.1s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafbfc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FileText size={15} color="#4f46e5" />
                      <span>{s.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: "11.5px", color: "#64748b" }}>
                    {s.file}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#475569" }}>
                      {s.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                    {s.chunks} chunks
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", backgroundColor: "#ecfdf5", color: "#059669" }}>
                      Vector Synced
                    </span>
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
