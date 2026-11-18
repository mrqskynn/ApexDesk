"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalHeader from "../../components/PortalHeader";
import { getCurrentUser, post } from "../../lib/api";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Laptop,
  KeyRound,
  Wifi,
  Shield,
  Layers,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";

export default function SubmitRequestPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "Engineering",
    category: "access",
    priority: "medium",
    subject: "",
    description: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.username || "",
      }));
    }
  }, []);

  const priorityOptions = [
    { id: "low", label: "Low", desc: "General question or non-urgent setup", badgeColor: "#64748b", bg: "#f1f5f9" },
    { id: "medium", label: "Medium", desc: "Work is hindered but workarounds exist", badgeColor: "#2563eb", bg: "#eff6ff" },
    { id: "high", label: "High", desc: "Significant business or productivity impact", badgeColor: "#d97706", bg: "#fef3c7" },
    { id: "urgent", label: "Urgent", desc: "Critical blockage / security incident", badgeColor: "#dc2626", bg: "#fee2e2" },
  ];

  const categories = [
    { id: "access", label: "Account & Access (SSO, Passwords)", icon: KeyRound },
    { id: "vpn", label: "VPN & Network Connectivity", icon: Wifi },
    { id: "hardware", label: "Hardware, Mac & Peripherals", icon: Laptop },
    { id: "software", label: "Software Licenses & Applications", icon: Layers },
    { id: "security", label: "Security & Phishing Incidents", icon: Shield },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) return;

    setLoading(true);
    setErrorMsg("");
    try {
      const fullDesc = `Requester: ${formData.name} <${formData.email}>\nDepartment: ${formData.department} | Category: ${formData.category}\n\n${formData.description}`;
      const res = await post("/tickets", {
        title: formData.subject,
        description: fullDesc,
        priority: formData.priority,
      });

      const generatedId = "TICK-" + res.id;
      setCreatedTicketId(generatedId);

      // Save user submission reference to sessionStorage for live reflection in My Tickets
      if (typeof window !== "undefined") {
        const localList = JSON.parse(window.sessionStorage.getItem("user_tickets") || "[]");
        localList.unshift({
          id: res.id,
          customId: generatedId,
          title: res.title,
          priority: res.priority,
          status: res.status,
          created_at: res.created_at,
          category: formData.category,
          summary: formData.description,
        });
        window.sessionStorage.setItem("user_tickets", JSON.stringify(localList));
      }

      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit ticket. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--portal-bg)", display: "flex", flexDirection: "column" }}>
      <PortalHeader />

      <main style={{ flex: 1, padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          
          {/* Breadcrumb Navigation */}
          <div style={{ marginBottom: "24px" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: "var(--portal-text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--portal-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--portal-text-secondary)")}
            >
              <ArrowLeft size={16} />
              <span>Back to Help Center</span>
            </Link>
          </div>

          {!submitted ? (
            /* =================== SUBMISSION FORM =================== */
            <div
              style={{
                backgroundColor: "var(--portal-card-bg)",
                borderRadius: "16px",
                border: "1px solid var(--portal-border)",
                boxShadow: "var(--portal-shadow-lg)",
                padding: "36px 32px",
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: "28px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", backgroundColor: "#eff6ff", color: "#2563eb", fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>
                  <Sparkles size={13} />
                  <span>ApexDesk Automated Routing</span>
                </div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--portal-text-primary)", letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
                  Submit a Support Request
                </h1>
                <p style={{ fontSize: "14px", color: "var(--portal-text-secondary)", lineHeight: 1.5, margin: 0 }}>
                  Need help from IT? Fill out the details below. Our AI triage system will immediately analyze your issue against our SOPs and assign a specialist if needed.
                </p>
                {errorMsg && (
                  <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Contact Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Marcus Vance"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--portal-border)",
                        fontSize: "14px",
                        color: "var(--portal-text-primary)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--portal-primary)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--portal-border)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="marcus.vance@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--portal-border)",
                        fontSize: "14px",
                        color: "var(--portal-text-primary)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--portal-primary)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--portal-border)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                {/* Department & Category */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                      Department
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--portal-border)",
                        fontSize: "14px",
                        color: "var(--portal-text-primary)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option>Engineering</option>
                      <option>Product &amp; Design</option>
                      <option>Sales &amp; Marketing</option>
                      <option>Operations &amp; HR</option>
                      <option>Finance &amp; Legal</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--portal-border)",
                        fontSize: "14px",
                        color: "var(--portal-text-primary)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority Selection Cards */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "8px" }}>
                    Urgency &amp; Impact
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    {priorityOptions.map((opt) => {
                      const isSelected = formData.priority === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setFormData({ ...formData, priority: opt.id })}
                          style={{
                            padding: "12px 10px",
                            borderRadius: "12px",
                            border: `2px solid ${isSelected ? opt.badgeColor : "var(--portal-border)"}`,
                            backgroundColor: isSelected ? opt.bg : "#ffffff",
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: isSelected ? opt.badgeColor : "var(--portal-text-primary)",
                              marginBottom: "2px",
                            }}
                          >
                            {opt.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--portal-text-muted)", lineHeight: 1.2 }}>
                            {opt.id === "urgent" ? "Blocker" : opt.id === "high" ? "High" : opt.id === "medium" ? "Standard" : "Low"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                    Subject / Summary
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cannot connect to Cisco AnyConnect VPN after OS update"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--portal-border)",
                      fontSize: "14px",
                      color: "var(--portal-text-primary)",
                      backgroundColor: "#ffffff",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--portal-primary)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--portal-border)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)", marginBottom: "6px" }}>
                    Detailed Description
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Please include error messages, steps taken, or device serial number if applicable..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--portal-border)",
                      fontSize: "14px",
                      lineHeight: 1.5,
                      color: "var(--portal-text-primary)",
                      backgroundColor: "#ffffff",
                      outline: "none",
                      resize: "vertical",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--portal-primary)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--portal-border)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Mock Attachment Dropzone */}
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: "12px",
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--portal-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
                >
                  <Paperclip size={20} color="#64748b" style={{ margin: "0 auto 6px" }} />
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--portal-text-primary)" }}>
                    Attach screenshots or logs (optional)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--portal-text-muted)", marginTop: "2px" }}>
                    Drag &amp; drop files here, or click to browse (up to 25MB)
                  </div>
                </div>

                {/* Submit Button */}
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
                    padding: "14px",
                    borderRadius: "12px",
                    backgroundColor: "var(--portal-primary)",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: 600,
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.28)",
                    transition: "all 0.15s ease",
                    opacity: loading ? 0.8 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "var(--portal-primary-hover)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "var(--portal-primary)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  <Send size={16} />
                  <span>{loading ? "Submitting Request..." : "Submit Ticket to IT"}</span>
                </button>
              </form>
            </div>
          ) : (
            /* =================== SUCCESS CONFIRMATION =================== */
            <div
              style={{
                backgroundColor: "var(--portal-card-bg)",
                borderRadius: "16px",
                border: "1px solid var(--portal-border)",
                boxShadow: "var(--portal-shadow-xl)",
                padding: "48px 36px",
                textAlign: "center",
                animation: "fadeIn 0.35s ease-out",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.2)",
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "12px",
                }}
              >
                {createdTicketId}
              </span>

              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--portal-text-primary)", letterSpacing: "-0.02em", margin: "0 0 10px 0" }}>
                Request Submitted Successfully
              </h2>

              <p style={{ fontSize: "15px", color: "var(--portal-text-secondary)", lineHeight: 1.6, maxWidth: "460px", margin: "0 auto 28px" }}>
                We received your ticket regarding <strong>&quot;{formData.subject}&quot;</strong>. A notification has been sent to your email, and our L1 AI triage is assessing matching SOPs.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "24px",
                  padding: "16px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid var(--portal-border)",
                  marginBottom: "32px",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "11px", color: "var(--portal-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Expected First Response
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--portal-text-primary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <Clock size={14} color="#2563eb" />
                    <span>Under 15 minutes</span>
                  </div>
                </div>
                <div style={{ width: "1px", height: "30px", backgroundColor: "#cbd5e1" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "11px", color: "var(--portal-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Assigned Queue
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--portal-text-primary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <Shield size={14} color="#059669" />
                    <span>L1 IT Service Desk</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <Link
                  href="/my-tickets"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 24px",
                    borderRadius: "10px",
                    backgroundColor: "var(--portal-primary)",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  <FileText size={16} />
                  <span>View in My Tickets</span>
                </Link>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({
                      name: "",
                      email: "",
                      department: "Engineering",
                      category: "access",
                      priority: "medium",
                      subject: "",
                      description: "",
                    });
                  }}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "10px",
                    backgroundColor: "#f1f5f9",
                    color: "var(--portal-text-secondary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Submit Another
                </button>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
