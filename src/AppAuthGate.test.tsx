import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./App", () => ({
  default: () => <div>app-shell</div>
}));

vi.mock("./components/auth/AuthLandingPage", () => ({
  AuthLandingPage: () => <div>auth-landing</div>
}));

const sessionMock = vi.hoisted(() => ({
  isAuthenticated: vi.fn<() => boolean>()
}));

vi.mock("./session/SessionContext", () => ({
  useSession: () => sessionMock
}));

import { AppAuthGate } from "./AppAuthGate";

afterEach(() => {
  cleanup();
});

describe("AppAuthGate", () => {
  it("renders auth landing when unauthenticated", () => {
    sessionMock.isAuthenticated.mockReturnValue(false);
    render(() => <AppAuthGate />);

    expect(screen.getByText("auth-landing")).toBeInTheDocument();
    expect(screen.queryByText("app-shell")).not.toBeInTheDocument();
  });

  it("renders app when authenticated", () => {
    sessionMock.isAuthenticated.mockReturnValue(true);
    render(() => <AppAuthGate />);

    expect(screen.getByText("app-shell")).toBeInTheDocument();
    expect(screen.queryByText("auth-landing")).not.toBeInTheDocument();
  });
});

