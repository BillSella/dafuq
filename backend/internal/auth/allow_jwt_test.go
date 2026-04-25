package auth

import (
	"context"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestAllowValidatorRoundTrip(t *testing.T) {
	cfg := config.Config{
		AllowJWTSecret: "test-secret-key",
		AllowSubject:   "integration-user",
	}
	v, err := NewAllowValidator(cfg)
	if err != nil {
		t.Fatal(err)
	}
	at, err := v.IssueAccessToken()
	if err != nil {
		t.Fatal(err)
	}
	claims, err := v.ValidateAccessToken(context.Background(), at)
	if err != nil {
		t.Fatalf("validate access: %v", err)
	}
	if claims.Subject != "integration-user" {
		t.Fatalf("sub: %q", claims.Subject)
	}
	rt, err := v.IssueRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	if err := v.ValidateRefreshToken(context.Background(), rt); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if _, err := v.ValidateAccessToken(context.Background(), rt); err == nil {
		t.Fatal("refresh token must not validate as access")
	}
}

func TestAllowValidatorIssueForSubject(t *testing.T) {
	cfg := config.Config{
		AllowJWTSecret: "test-secret-key",
		AllowSubject:   "integration-user",
	}
	v, err := NewAllowValidator(cfg)
	if err != nil {
		t.Fatal(err)
	}
	at, err := v.IssueAccessTokenForSubject("alice")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := v.ValidateAccessToken(context.Background(), at)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != "alice" {
		t.Fatalf("subject = %q, want alice", claims.Subject)
	}
}
