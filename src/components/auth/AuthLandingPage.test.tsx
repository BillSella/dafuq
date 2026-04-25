import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthLandingPage } from "./AuthLandingPage";

const mockFns = vi.hoisted(() => ({
  syncFromStorage: vi.fn(),
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn()
}));

vi.mock("../../session/SessionContext", () => ({
  useSession: () => ({
    isAuthenticated: () => false,
    syncFromStorage: mockFns.syncFromStorage,
    logIn: vi.fn(),
    logOut: vi.fn()
  })
}));

vi.mock("../../authToken", () => ({
  setAccessToken: mockFns.setAccessToken,
  setRefreshToken: mockFns.setRefreshToken
}));

vi.mock("../DafuqLogo", () => ({
  DafuqLogo: () => <div>logo</div>
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockFns.syncFromStorage.mockClear();
  mockFns.setAccessToken.mockClear();
  mockFns.setRefreshToken.mockClear();
});

describe("AuthLandingPage", () => {
  it("submits credentials and syncs session on successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "access-123", refresh_token: "refresh-123" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(() => <AuthLandingPage />);

    await fireEvent.input(screen.getByLabelText("Username"), {
      target: { value: "bill" }
    });
    await fireEvent.input(screen.getByLabelText("Password"), {
      target: { value: "secret" }
    });
    await fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockFns.setAccessToken).toHaveBeenCalledWith("access-123");
      expect(mockFns.setRefreshToken).toHaveBeenCalledWith("refresh-123");
      expect(mockFns.syncFromStorage).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Sign-in failed. Check credentials and try again.")).not.toBeInTheDocument();
  });

  it("shows credential error when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 })
    );

    render(() => <AuthLandingPage />);
    await fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Sign-in failed. Check credentials and try again.")).toBeInTheDocument();
    expect(mockFns.syncFromStorage).not.toHaveBeenCalled();
  });

  it("shows network error when auth request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    render(() => <AuthLandingPage />);
    await fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Unable to reach auth service. Try again.")).toBeInTheDocument();
    expect(mockFns.syncFromStorage).not.toHaveBeenCalled();
  });
});

