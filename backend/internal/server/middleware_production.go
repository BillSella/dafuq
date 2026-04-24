package server

import (
	"log"
	"net/http"
	"runtime/debug"
)

// withProductionMiddleware adds panic recovery and minimal security headers suitable
// for serving the API and static assets together.
func withProductionMiddleware(next http.Handler) http.Handler {
	return securityHeaders(recoverPanic(next))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// Allow same-origin framing for typical SPA embeds; tighten if you never iframe the app.
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		next.ServeHTTP(w, r)
	})
}

func recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("panic: %v\n%s", err, debug.Stack())
				// If headers already sent, Error may be a no-op; still safe for typical handlers.
				if w.Header().Get("Content-Type") == "" {
					w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				}
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
