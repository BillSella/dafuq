package auth

import "context"

type ctxKey int

const claimsCtxKey ctxKey = 1

// ContextWithClaims attaches validated access-token claims to the request context.
func ContextWithClaims(ctx context.Context, c *WorkOSAccessClaims) context.Context {
	return context.WithValue(ctx, claimsCtxKey, c)
}

// ClaimsFromContext returns claims set by BearerAuth middleware.
func ClaimsFromContext(ctx context.Context) (*WorkOSAccessClaims, bool) {
	c, ok := ctx.Value(claimsCtxKey).(*WorkOSAccessClaims)
	return c, ok
}
