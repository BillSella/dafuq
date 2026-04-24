package server

import (
	"context"
	"fmt"
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
// Endpoints under /api/v1/ require Authorization: Bearer <access token> validated
// by the pluggable token validator (WorkOS JWT, OIDC JWKS, etc. per config / gateway file).
// Use [WithPluginRegistry] to supply extra or custom [Plugin] implementations.
func NewMux(cfg config.Config, opts ...MuxOption) (http.Handler, error) {
	mc := newMuxConfig(opts)
	plugins := mc.plugins
	if plugins == nil {
		plugins = NewPluginRegistry()
	}

	ctx := context.Background()
	authRoute, dataRoutes, err := LoadGatewayConfig(cfg.APIProxyConfigFile)
	if err != nil {
		return nil, err
	}
	drv := authDriverForRoute(authRoute)
	if err := cfg.ValidateForAuth(drv); err != nil {
		return nil, err
	}
	var client *usermanagement.Client
	tv, err := newTokenValidator(ctx, cfg, drv, &client)
	if err != nil {
		return nil, err
	}

	var workH *auth.Handler
	var allowH *auth.AllowHandler
	var pamH *auth.PAMHandler
	switch drv {
	case config.AuthWorkOSPlugin:
		workH = auth.NewHandler(cfg, client, tv)
	case config.AuthAllowPlugin:
		av, ok := tv.(*auth.AllowValidator)
		if !ok {
			return nil, fmt.Errorf("internal: allow auth requires *auth.AllowValidator")
		}
		allowH = auth.NewAllowHandler(cfg, av)
	case config.AuthPAMPlugin:
		pv, ok := tv.(*auth.PAMValidator)
		if !ok {
			return nil, fmt.Errorf("internal: pam auth requires *auth.PAMValidator")
		}
		pamH = auth.NewPAMHandler(cfg, pv)
	}

	apiV1 := http.NewServeMux()
	apiV1.HandleFunc("GET /metrics/sample-gauge", api.SampleGaugeValue)
	dashStore := api.NewDashboardStore(cfg.DashboardDataDir)
	api.RegisterDashboardRoutes(apiV1, dashStore)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", api.Health)
	if err := RegisterAPIRoutes(mux, tv, dataRoutes, plugins, cfg.EffectiveProxyMaxBody()); err != nil {
		return nil, err
	}

	mux.Handle("/api/v1/", auth.BearerAuth(tv)(http.StripPrefix("/api/v1", apiV1)))

	if err := registerAuthRoutes(mux, authRoute, workH, allowH, pamH, cfg.EffectiveProxyMaxBody()); err != nil {
		return nil, err
	}

	mux.HandleFunc("GET /{$}", spaIndex(cfg.StaticDir))
	mux.HandleFunc("GET /{path...}", spaOrFile(cfg.StaticDir))

	return withProductionMiddleware(logRequests(mux)), nil
}

func authDriverForRoute(r *APIProxyRoute) config.AuthDriver {
	if strings.EqualFold(r.Plugin, "allow") {
		return config.AuthAllowPlugin
	}
	if strings.EqualFold(r.Plugin, "pam") {
		return config.AuthPAMPlugin
	}
	if strings.EqualFold(r.Plugin, "workos") {
		return config.AuthWorkOSPlugin
	}
	if len(r.Backends) > 0 {
		return config.AuthProxyOrOIDC
	}
	// Normalized gateway auth routes always set plugin or backends; this is a safety fallback.
	return config.AuthWorkOSPlugin
}

func isWorkOSAuthRoute(r *APIProxyRoute) bool {
	return strings.EqualFold(r.Plugin, "workos")
}

func isAllowAuthRoute(r *APIProxyRoute) bool {
	return strings.EqualFold(r.Plugin, "allow")
}

func isPAMAuthRoute(r *APIProxyRoute) bool {
	return strings.EqualFold(r.Plugin, "pam")
}

// newTokenValidator builds a TokenValidator. If outClient is non-nil and driver is
// WorkOS, the WorkOS API client is stored in *outClient for the auth handler.
func newTokenValidator(ctx context.Context, cfg config.Config, drv config.AuthDriver, outClient **usermanagement.Client) (auth.TokenValidator, error) {
	switch drv {
	case config.AuthWorkOSPlugin:
		c := usermanagement.NewClient(cfg.WorkOSAPIKey)
		if outClient != nil {
			*outClient = c
		}
		return auth.NewJWTValidator(ctx, c, cfg.WorkOSClientID, cfg.WorkOSJWTIssuer)
	case config.AuthAllowPlugin:
		return auth.NewAllowValidator(cfg)
	case config.AuthPAMPlugin:
		return auth.NewPAMValidator(cfg)
	case config.AuthProxyOrOIDC:
		return auth.NewOIDCValidator(ctx, cfg.JWKSURL, cfg.JWTIssuer, cfg.JWTAudience)
	default:
		return nil, fmt.Errorf("invalid auth driver %q", drv)
	}
}

func registerAuthRoutes(mux *http.ServeMux, route *APIProxyRoute, workos *auth.Handler, allow *auth.AllowHandler, pam *auth.PAMHandler, maxProxyBody int64) error {
	if isWorkOSAuthRoute(route) {
		if workos == nil {
			return fmt.Errorf("workos auth requires handler")
		}
		p := strings.TrimRight(strings.TrimSpace(route.ListenPath), "/")
		if p == "" {
			return fmt.Errorf("auth listen path is empty")
		}
		mux.HandleFunc("GET "+p+"/login", workos.Login)
		mux.HandleFunc("GET "+p+"/callback", workos.Callback)
		mux.HandleFunc("POST "+p+"/password", workos.Password)
		mux.HandleFunc("POST "+p+"/refresh", workos.Refresh)
		mux.HandleFunc("GET "+p+"/logout", workos.Logout)
		mux.HandleFunc("POST "+p+"/logout", workos.Logout)
		mux.HandleFunc("GET "+p+"/me", workos.Me)
		return nil
	}
	if isAllowAuthRoute(route) {
		if allow == nil {
			return fmt.Errorf("allow auth requires handler")
		}
		p := strings.TrimRight(strings.TrimSpace(route.ListenPath), "/")
		if p == "" {
			return fmt.Errorf("auth listen path is empty")
		}
		mux.HandleFunc("GET "+p+"/login", allow.Login)
		mux.HandleFunc("GET "+p+"/callback", allow.Callback)
		mux.HandleFunc("POST "+p+"/password", allow.Password)
		mux.HandleFunc("POST "+p+"/refresh", allow.Refresh)
		mux.HandleFunc("GET "+p+"/logout", allow.Logout)
		mux.HandleFunc("POST "+p+"/logout", allow.Logout)
		mux.HandleFunc("GET "+p+"/me", allow.Me)
		return nil
	}
	if isPAMAuthRoute(route) {
		if pam == nil {
			return fmt.Errorf("pam auth requires handler")
		}
		p := strings.TrimRight(strings.TrimSpace(route.ListenPath), "/")
		if p == "" {
			return fmt.Errorf("auth listen path is empty")
		}
		mux.HandleFunc("GET "+p+"/login", pam.Login)
		mux.HandleFunc("GET "+p+"/callback", pam.Callback)
		mux.HandleFunc("POST "+p+"/password", pam.Password)
		mux.HandleFunc("POST "+p+"/refresh", pam.Refresh)
		mux.HandleFunc("GET "+p+"/logout", pam.Logout)
		mux.HandleFunc("POST "+p+"/logout", pam.Logout)
		mux.HandleFunc("GET "+p+"/me", pam.Me)
		return nil
	}
	if len(route.Backends) == 0 {
		return fmt.Errorf("auth: set plugin local to \"workos\", \"allow\", or \"pam\", or use plugin proxy for an external BFF")
	}
	if route.Plugin != "" {
		return fmt.Errorf("auth: cannot combine plugin %q with plugin.proxy; use one auth mode", route.Plugin)
	}
	mux.Handle(route.ListenPath, newFailoverProxy(*route, maxProxyBody))
	return nil
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
			http.Error(w, "frontend not built: run npm run build and set --static-dir to dist/", http.StatusServiceUnavailable)
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
				http.Error(w, "frontend not built: run npm run build and set --static-dir to dist/", http.StatusServiceUnavailable)
				return
			}
			http.ServeFile(w, r, index)
			return
		}
		http.ServeFile(w, r, full)
	}
}
