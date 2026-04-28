package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeTokenValidator struct {
	claims *AccessContextClaims
	err    error
}

func (f fakeTokenValidator) ValidateAccessToken(context.Context, string) (*AccessContextClaims, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.claims, nil
}

func TestBearerTokenHelper(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer token-123")
	token, ok := bearerToken(req)
	if !ok || token != "token-123" {
		t.Fatalf("expected token extraction to succeed, got ok=%v token=%q", ok, token)
	}
}

func TestBearerAuthMissingAuthorization(t *testing.T) {
	h := BearerAuth(fakeTokenValidator{claims: &AccessContextClaims{Subject: "u"}})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatalf("next handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/x", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestBearerAuthInvalidToken(t *testing.T) {
	h := BearerAuth(fakeTokenValidator{err: errors.New("bad token")})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatalf("next handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/x", nil)
	req.Header.Set("Authorization", "Bearer bad")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestBearerAuthAttachesClaimsContext(t *testing.T) {
	expected := &AccessContextClaims{Subject: "user-42", ClientID: "client-a"}
	var got *AccessContextClaims
	h := BearerAuth(fakeTokenValidator{claims: expected})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := AccessClaimsFromContext(r.Context())
		if !ok {
			t.Fatalf("expected claims on context")
		}
		got = claims
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/x", nil)
	req.Header.Set("Authorization", "Bearer token")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if got == nil || got.Subject != expected.Subject || got.ClientID != expected.ClientID {
		t.Fatalf("unexpected claims: %#v", got)
	}
}
