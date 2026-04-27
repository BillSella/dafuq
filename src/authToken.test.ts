import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureOAuthTokensFromUrl,
  clearAuthTokens,
  getAccessTokenClaims,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken
} from "./authToken";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("authToken", () => {
  it("extracts normalized claims from JWT-like access token payload", () => {
    const payload = window.btoa(
      JSON.stringify({
        scope: "module:settings:read module:userSettings:read",
        roles: ["role:admin"],
        permissions: ["perm:write"]
      })
    );
    localStorage.setItem("dafuq_access_token", `header.${payload}.sig`);

    expect(getAccessTokenClaims()).toEqual([
      "module:settings:read",
      "module:userSettings:read",
      "role:admin",
      "perm:write"
    ]);
  });

  it("sets, gets, and clears tokens", () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");

    clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getAccessTokenClaims()).toEqual([]);
  });

  it("captures OAuth tokens from URL hash and clears hash", () => {
    window.history.replaceState(
      null,
      "",
      "/callback?x=1#access_token=abc&refresh_token=xyz&token_type=Bearer"
    );

    captureOAuthTokensFromUrl();

    expect(getAccessToken()).toBe("abc");
    expect(getRefreshToken()).toBe("xyz");
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/callback");
    expect(window.location.search).toBe("?x=1");
  });

  it("does nothing when hash has no auth tokens", () => {
    setAccessToken("existing-a");
    setRefreshToken("existing-r");
    window.history.replaceState(null, "", "/callback#state=ok");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    captureOAuthTokensFromUrl();

    expect(getAccessToken()).toBe("existing-a");
    expect(getRefreshToken()).toBe("existing-r");
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("returns empty claims when token payload is malformed", () => {
    localStorage.setItem("dafuq_access_token", "not-a-jwt");
    expect(getAccessTokenClaims()).toEqual([]);
  });

  it("normalizes claim formats from scope and scp fields", () => {
    const payload = window.btoa(
      JSON.stringify({
        scope: "module:settings:read module:settings:read",
        scp: ["module:userSettings:read", "", 12],
        roles: "role:viewer"
      })
    );
    localStorage.setItem("dafuq_access_token", `header.${payload}.sig`);

    expect(getAccessTokenClaims()).toEqual([
      "module:settings:read",
      "module:userSettings:read",
      "role:viewer"
    ]);
  });
});

