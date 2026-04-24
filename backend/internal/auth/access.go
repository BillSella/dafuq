package auth

import "context"

type ctxKey int

const accessClaimsCtxKey ctxKey = 2

// AccessContextClaims is the cross-provider identity attached after Bearer auth.
// WorkOS populates ClientID and SID; OIDC-style tokens typically set Subject only.
type AccessContextClaims struct {
	Subject  string
	ClientID string
	SID      string
}

// ContextWithAccessClaims attaches validated access claims to the request context.
func ContextWithAccessClaims(ctx context.Context, c *AccessContextClaims) context.Context {
	return context.WithValue(ctx, accessClaimsCtxKey, c)
}

// AccessClaimsFromContext returns claims set by BearerAuth middleware.
func AccessClaimsFromContext(ctx context.Context) (*AccessContextClaims, bool) {
	c, ok := ctx.Value(accessClaimsCtxKey).(*AccessContextClaims)
	return c, ok
}

// TokenValidator verifies bearer access tokens for the framework (WorkOS, Auth0, etc.).
type TokenValidator interface {
	ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error)
}
