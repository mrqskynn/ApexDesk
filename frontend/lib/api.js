// Thin client for the FastAPI backend. Base URL comes from NEXT_PUBLIC_API_URL.
const API = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export function normalizeRole(role) {
  const clean = (role || "").trim().toLowerCase();
  if (clean === "user") return "customer";
  return clean;
}

function setAuthCookies(user) {
  if (typeof document === "undefined") return;
  if (user && user.token && user.role) {
    const role = normalizeRole(user.role);
    document.cookie = `auth_role=${encodeURIComponent(role)}; path=/; SameSite=Lax; max-age=604800`;
    document.cookie = `auth_token=${encodeURIComponent(user.token)}; path=/; SameSite=Lax; max-age=604800`;
  } else {
    document.cookie = "auth_role=; path=/; SameSite=Lax; max-age=0";
    document.cookie = "auth_token=; path=/; SameSite=Lax; max-age=0";
  }
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.token) return null;
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (typeof window === "undefined") return;
  if (user && user.token) {
    const normalized = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: normalizeRole(user.role),
      token: user.token,
    };
    sessionStorage.setItem("auth_user", JSON.stringify(normalized));
    sessionStorage.removeItem("admin_pw");
    setAuthCookies(normalized);
  } else {
    sessionStorage.removeItem("auth_user");
    sessionStorage.removeItem("admin_pw");
    setAuthCookies(null);
  }
}

export function logout() {
  setCurrentUser(null);
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export async function loginApi({ username, password, role }) {
  try {
    const res = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role: normalizeRole(role) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Authentication failed (${res.status}).`);
    }
    return res.json();
  } catch (err) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Unable to reach backend API at " +
          API +
          ". Please ensure the FastAPI server is running.",
      );
    }
    throw err;
  }
}

export async function apiFetch(path, opts = {}) {
  const user = getCurrentUser();
  const headers = { ...(opts.headers || {}) };
  if (user?.token) {
    headers["Authorization"] = `Bearer ${user.token}`;
    headers["X-Role"] = user.role;
  }

  try {
    const res = await fetch(API + path, {
      ...opts,
      headers,
    });
    if (res.status === 403 || res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail ||
          `Forbidden (${res.status}): insufficient permissions for this resource.`,
      );
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail || `Request failed (${res.status} ${res.statusText})`,
      );
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json().catch(() => ({}));
    }
    return await res.text();
  } catch (err) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Unable to connect to FastAPI backend at " +
          API +
          ". Please ensure the backend server is running.",
      );
    }
    throw err;
  }
}

export async function post(path, body) {
  return apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function adminFetch(path, opts = {}) {
  return apiFetch(path, opts);
}

export async function adminPatch(path, body) {
  return apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPut(path, body) {
  return apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path) {
  return apiFetch(path, {
    method: "DELETE",
  });
}
