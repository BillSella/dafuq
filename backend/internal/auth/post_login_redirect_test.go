package auth

import (
	"net/http/httptest"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestPostLoginRedirectURL_DefaultPath(t *testing.T) {
	req := httptest.NewRequest("GET", "https://example.com/api/auth/callback", nil)
	u, err := PostLoginRedirectURL(config.Config{}, req)
	if err != nil {
		t.Fatalf("expected default redirect url, got error %v", err)
	}
	if u.Path != "/" {
		t.Fatalf("expected default path '/', got %q", u.Path)
	}
}

func TestPostLoginRedirectURL_AllowsAbsolute(t *testing.T) {
	req := httptest.NewRequest("GET", "https://example.com/api/auth/callback", nil)
	cfg := config.Config{PostLoginRedirect: "https://ui.example.com/app"}
	u, err := PostLoginRedirectURL(cfg, req)
	if err != nil {
		t.Fatalf("expected absolute redirect to parse, got %v", err)
	}
	if u.Host != "ui.example.com" {
		t.Fatalf("unexpected host: %q", u.Host)
	}
}
