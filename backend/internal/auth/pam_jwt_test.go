package auth

import (
	"context"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestPAMValidatorTokenLifecycle(t *testing.T) {
	v, err := NewPAMValidator(config.Config{PAMJWTSecret: "signing-secret-for-test"})
	if err != nil {
		t.Fatal(err)
	}
	at, err := v.IssueAccessTokenForSubject("alice")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := v.ValidateAccessToken(context.Background(), at)
	if err != nil {
		t.Fatalf("access: %v", err)
	}
	if claims.Subject != "alice" {
		t.Fatalf("sub %q", claims.Subject)
	}
	rt, err := v.IssueRefreshTokenForSubject("alice")
	if err != nil {
		t.Fatal(err)
	}
	sub, err := v.ValidateRefreshToken(context.Background(), rt)
	if err != nil || sub != "alice" {
		t.Fatalf("refresh: %v %q", err, sub)
	}
	if _, err := v.ValidateAccessToken(context.Background(), rt); err == nil {
		t.Fatal("refresh token must not be valid as access")
	}
}
