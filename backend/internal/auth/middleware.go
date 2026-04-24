package auth

import (
	"net/http"
	"strings"
)

// BearerAuth requires a valid access token (JWT) on Authorization: Bearer <token>.
// The token is validated with the pluggable TokenValidator (WorkOS, OIDC, etc.).
func BearerAuth(v TokenValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, ok := bearerToken(r)
			if !ok || raw == "" {
				jsonErr(w, http.StatusUnauthorized, `{"error":"missing_or_invalid_authorization"}`)
				return
			}
			claims, err := v.ValidateAccessToken(r.Context(), raw)
			if err != nil {
				jsonErr(w, http.StatusUnauthorized, `{"error":"invalid_token"}`)
				return
			}
			ctx := ContextWithAccessClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func jsonErr(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body + "\n"))
}

func bearerToken(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", false
	}
	t := strings.TrimSpace(h[len(prefix):])
	return t, t != ""
}
