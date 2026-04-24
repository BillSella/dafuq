package server

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/dafuq-framework/dafuq/backend/internal/api"
	"github.com/dafuq-framework/dafuq/backend/internal/auth"
	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

// NewMux builds the application router: /api/* then static SPA.
// Endpoints under /api/v1/ require Authorization: Bearer <WorkOS access token JWT>.
func NewMux(cfg config.Config) (http.Handler, error) {
	ctx := context.Background()
	client := usermanagement.NewClient(cfg.WorkOSAPIKey)
	v, err := auth.NewJWTValidator(ctx, client, cfg.WorkOSClientID, cfg.WorkOSJWTIssuer)
	if err != nil {
		return nil, err
	}
	ah := auth.NewHandler(cfg, client, v)

	apiV1 := http.NewServeMux()
	apiV1.HandleFunc("GET /metrics/sample-gauge", api.SampleGaugeValue)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", api.Health)
	routes, err := LoadAPIProxyRoutes(cfg.APIProxyConfigFile)
	if err != nil {
		return nil, err
	}
	if err := RegisterAPIRoutes(mux, v, routes, NewPluginRegistry()); err != nil {
		return nil, err
	}

	mux.Handle("/api/v1/", auth.BearerAuth(v)(http.StripPrefix("/api/v1", apiV1)))

	mux.HandleFunc("GET /api/auth/login", ah.Login)
	mux.HandleFunc("GET /api/auth/callback", ah.Callback)
	mux.HandleFunc("POST /api/auth/password", ah.Password)
	mux.HandleFunc("POST /api/auth/refresh", ah.Refresh)
	mux.HandleFunc("GET /api/auth/logout", ah.Logout)
	mux.HandleFunc("POST /api/auth/logout", ah.Logout)
	mux.HandleFunc("GET /api/auth/me", ah.Me)

	mux.HandleFunc("GET /{$}", spaIndex(cfg.StaticDir))
	mux.HandleFunc("GET /{path...}", spaOrFile(cfg.StaticDir))

	return logRequests(mux), nil
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.RequestURI())
		next.ServeHTTP(w, r)
	})
}

func spaIndex(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "..") {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		index := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(index); err != nil {
			http.Error(w, "frontend not built: run npm run build and point DAFUQ_STATIC_DIR at dist/", http.StatusServiceUnavailable)
			return
		}
		http.ServeFile(w, r, index)
	}
}

func spaOrFile(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		rel := strings.TrimPrefix(r.URL.Path, "/")
		if strings.Contains(rel, "..") {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		full := filepath.Join(staticDir, filepath.FromSlash(rel))
		st, err := os.Stat(full)
		if err != nil || st.IsDir() {
			index := filepath.Join(staticDir, "index.html")
			if _, err := os.Stat(index); err != nil {
				http.Error(w, "frontend not built: run npm run build and point DAFUQ_STATIC_DIR at dist/", http.StatusServiceUnavailable)
				return
			}
			http.ServeFile(w, r, index)
			return
		}
		http.ServeFile(w, r, full)
	}
}
