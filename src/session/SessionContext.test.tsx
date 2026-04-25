import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createMemo } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./SessionContext";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function SessionProbe() {
  const session = useSession();
  const authText = createMemo(() => (session.isAuthenticated() ? "yes" : "no"));
  return (
    <div>
      <div data-testid="auth-state">{authText()}</div>
      <button type="button" onClick={() => session.syncFromStorage()}>
        sync
      </button>
      <button type="button" onClick={() => session.logOut()}>
        logout
      </button>
    </div>
  );
}

describe("SessionContext", () => {
  it("throws when hook is used outside provider", () => {
    expect(() => render(() => <SessionProbe />)).toThrowError(
      "useSession() must be used under <SessionProvider>"
    );
  });

  it("initializes auth from storage and syncs when requested", async () => {
    localStorage.setItem("dafuq_access_token", "token-1");
    render(() => (
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>
    ));

    expect(screen.getByTestId("auth-state")).toHaveTextContent("yes");

    localStorage.removeItem("dafuq_access_token");
    await fireEvent.click(screen.getByRole("button", { name: "sync" }));
    expect(screen.getByTestId("auth-state")).toHaveTextContent("no");
  });

  it("logout clears auth/dashboard storage and posts logout", async () => {
    localStorage.setItem("dafuq_access_token", "token-a");
    localStorage.setItem("dafuq_refresh_token", "token-r");
    localStorage.setItem("dashboard:index", JSON.stringify(["d1"]));
    localStorage.setItem("dashboard:d1.json", JSON.stringify({ id: "d1" }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    render(() => (
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>
    ));

    await fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(screen.getByTestId("auth-state")).toHaveTextContent("no");
    expect(localStorage.getItem("dafuq_access_token")).toBeNull();
    expect(localStorage.getItem("dafuq_refresh_token")).toBeNull();
    expect(localStorage.getItem("dashboard:index")).toBeNull();
    expect(localStorage.getItem("dashboard:d1.json")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });
});

