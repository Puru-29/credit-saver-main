export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  message: string;
  user: AuthUser;
  token?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace(
  /\/$/,
  "",
);
const TOKEN_KEY = "nyaysetu.auth-token";

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export function getAuthToken() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY);
}

function saveAuthToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  { method = "GET", token, body }: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AuthApiError(
      "Could not reach the NyaySetu API. Check that the backend is running.",
      0,
    );
  }

  let result: (Partial<T> & { message?: string }) | null;
  try {
    result = (await response.json()) as Partial<T> & { message?: string };
  } catch {
    if (response.ok) {
      throw new AuthApiError("The API returned an invalid response.", 502);
    }
    result = null;
  }
  if (!response.ok) {
    throw new AuthApiError(
      result?.message || `The request failed with status ${response.status}.`,
      response.status,
    );
  }

  return result as T;
}

async function authenticate(path: "/auth/login" | "/auth/register", body: unknown) {
  const response = await request<AuthResponse>(path, { method: "POST", body });
  if (!response.token)
    throw new AuthApiError("The API did not return an authentication token.", 502);
  saveAuthToken(response.token);
  return response.user;
}

export function login(email: string, password: string) {
  return authenticate("/auth/login", { email, password });
}

export function register(name: string, email: string, password: string) {
  return authenticate("/auth/register", { name, email, password });
}

export async function getCurrentUser(token: string) {
  const response = await request<AuthResponse>("/auth/me", { token });
  return response.user;
}

export async function updateCurrentUser(token: string, name: string) {
  const response = await request<AuthResponse>("/auth/me", {
    method: "PATCH",
    token,
    body: { name },
  });
  return response.user;
}
