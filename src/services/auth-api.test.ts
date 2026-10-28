import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
  login,
  updateCurrentUser,
} from "@/services/auth-api";

const user = {
  id: "fictional-test-user",
  name: "Example User",
  email: "example@example.test",
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("authenticated profile API client", () => {
  it("authenticates against the backend and keeps the returned token in session storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Login successful", user, token: "test-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(login(user.email, "fictional-password")).resolves.toEqual(user);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: user.email, password: "fictional-password" }),
      }),
    );
    expect(getAuthToken()).toBe("test-token");
  });

  it("fetches the authenticated user with a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Authenticated user", user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser("test-token")).resolves.toEqual(user);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("updates only the permitted name through the authenticated profile endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Profile updated", user: { ...user, name: "Updated User" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateCurrentUser("test-token", "Updated User")).resolves.toEqual({
      ...user,
      name: "Updated User",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/me",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({ name: "Updated User" }),
      }),
    );
  });

  it("surfaces API errors without fabricating profile data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid or expired token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(getCurrentUser("test-token")).rejects.toThrow("Invalid or expired token");
  });

  it("rejects a successful response that does not contain valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));

    await expect(getCurrentUser("test-token")).rejects.toThrow(
      "The API returned an invalid response.",
    );
  });
});
