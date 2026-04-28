package auth

import (
	"context"
	"testing"
)

func TestAccessClaimsContextRoundTrip(t *testing.T) {
	base := context.Background()
	if claims, ok := AccessClaimsFromContext(base); ok || claims != nil {
		t.Fatalf("expected no claims in base context")
	}

	expected := &AccessContextClaims{Subject: "user-1", ClientID: "client-1", SID: "sid-1"}
	ctx := ContextWithAccessClaims(base, expected)
	got, ok := AccessClaimsFromContext(ctx)
	if !ok {
		t.Fatalf("expected claims to be present")
	}
	if got.Subject != expected.Subject || got.ClientID != expected.ClientID || got.SID != expected.SID {
		t.Fatalf("unexpected claims: %#v", got)
	}
}
