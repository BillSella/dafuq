package auth

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestValidateOAuthState(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	rr := httptest.NewRecorder()
	h.setOAuthStateCookie(rr, "abc123")

	req := httptest.NewRequest("GET", "/api/auth/callback?code=x&state=abc123", nil)
	for _, c := range rr.Result().Cookies() {
		req.AddCookie(c)
	}
	if err := h.validateOAuthState(req); err != nil {
		t.Fatalf("expected valid state, got error: %v", err)
	}
}

func TestValidateOAuthStateMismatch(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	rr := httptest.NewRecorder()
	h.setOAuthStateCookie(rr, "expected")

	req := httptest.NewRequest("GET", "/api/auth/callback?code=x&state=actual", nil)
	for _, c := range rr.Result().Cookies() {
		req.AddCookie(c)
	}
	if err := h.validateOAuthState(req); err == nil {
		t.Fatal("expected mismatch error, got nil")
	}
}

func TestDecodeStrictJSONBodyRejectsUnknownAndExtra(t *testing.T) {
	t.Run("unknown field", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/password", strings.NewReader(`{"email":"a@b.com","password":"x","unexpected":1}`))
		rr := httptest.NewRecorder()
		var body passwordBody
		if err := decodeStrictJSONBody(rr, req, &body); err == nil {
			t.Fatal("expected unknown field error")
		}
	})

	t.Run("multiple json objects", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/password", strings.NewReader(`{"email":"a@b.com","password":"x"}{"email":"c@d.com","password":"y"}`))
		rr := httptest.NewRecorder()
		var body passwordBody
		if err := decodeStrictJSONBody(rr, req, &body); err == nil {
			t.Fatal("expected extra content error")
		}
	})
}

func TestAllowPasswordAttemptRateLimit(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	ip := "1.2.3.4"
	now := time.Now()

	for i := 0; i < passwordRateLimit; i++ {
		if !h.allowPasswordAttempt(ip, now) {
			t.Fatalf("attempt %d should have been allowed", i+1)
		}
	}
	if h.allowPasswordAttempt(ip, now) {
		t.Fatal("expected attempt over limit to be rejected")
	}
}

func TestAllowPasswordAttemptWindowExpires(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	ip := "1.2.3.4"
	start := time.Now()

	for i := 0; i < passwordRateLimit; i++ {
		if !h.allowPasswordAttempt(ip, start) {
			t.Fatalf("attempt %d should have been allowed", i+1)
		}
	}
	if h.allowPasswordAttempt(ip, start) {
		t.Fatal("expected attempt over limit to be rejected")
	}
	if !h.allowPasswordAttempt(ip, start.Add(passwordRateWindow+time.Second)) {
		t.Fatal("expected new window to allow attempts again")
	}
}
