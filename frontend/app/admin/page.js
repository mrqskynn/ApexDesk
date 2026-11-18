"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
      Redirecting to Admin Overview Dashboard...
    </div>
  );
}
