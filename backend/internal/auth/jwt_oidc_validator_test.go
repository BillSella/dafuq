package auth

import (
	"context"
	"testing"
)

func TestNewOIDCValidatorRequiresConfig(t *testing.T) {
	if _, err := NewOIDCValidator(context.Background(), "", "issuer", "aud"); err == nil {
		t.Fatalf("expected jwks url required error")
	}
	if _, err := NewOIDCValidator(context.Background(), "https://example.com/jwks", "", "aud"); err == nil {
		t.Fatalf("expected issuer required error")
	}
}
