const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

function getToken() {
  // JWT example (edit to match your app)
  const token = localStorage.getItem("token");
  return token || null;
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const token = getToken();

  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && body !== null
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    const errPayload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
    const message =
      errPayload?.message ||
      errPayload?.error ||
      `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.payload = errPayload;
    throw error;
  }

  if (res.status === 204) return null;
  return isJson ? res.json() : res.text();
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) =>
    request(path, { ...options, method: "POST", body }),
  put: (path, body, options) =>
    request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: "PATCH", body }),
  del: (path, options) => request(path, { ...options, method: "DELETE" }),
};

export default api;
