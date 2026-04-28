package config

import "testing"

func TestLoadAndEffectiveProxyBody(t *testing.T) {
	t.Setenv("WORKOS_API_KEY", "k")
	t.Setenv("WORKOS_CLIENT_ID", "c")
	t.Setenv("WORKOS_REDIRECT_URI", "https://example.com/cb")
	t.Setenv("DAFUQ_PROXY_MAX_BODY_BYTES", "4096")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}
	if cfg.WorkOSClientID != "c" {
		t.Fatalf("unexpected client id: %q", cfg.WorkOSClientID)
	}
	if cfg.EffectiveProxyMaxBody() != 4096 {
		t.Fatalf("expected proxy body 4096, got %d", cfg.EffectiveProxyMaxBody())
	}
}

func TestValidateForAuth(t *testing.T) {
	workos := Config{
		WorkOSAPIKey:    "k",
		WorkOSClientID:  "c",
		AuthRedirectURI: "https://example.com/cb",
	}
	if err := workos.ValidateForAuth(AuthWorkOSPlugin); err != nil {
		t.Fatalf("expected workos config valid, got %v", err)
	}

	allow := Config{AllowInsecureAuth: true, AllowJWTSecret: "secret"}
	if err := allow.ValidateForAuth(AuthAllowPlugin); err != nil {
		t.Fatalf("expected allow config valid, got %v", err)
	}

	proxy := Config{JWKSURL: "https://issuer/jwks", JWTIssuer: "https://issuer"}
	if err := proxy.ValidateForAuth(AuthProxyOrOIDC); err != nil {
		t.Fatalf("expected proxy config valid, got %v", err)
	}
}
