package config

import (
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Config holds server and WorkOS settings loaded from the environment.
type Config struct {
	Addr               string
	TLSCertFile        string
	TLSKeyFile         string
	StaticDir          string
	DashboardDataDir   string
	BackendAPIBaseURL  string
	APIProxyConfigFile string
	WorkOSAPIKey       string
	WorkOSClientID     string
	AuthRedirectURI    string
	PostLoginRedirect  string
	WorkOSJWTIssuer    string
	// OIDC / generic JWT validation (Auth0, etc.) when auth routes are proxied.
	JWKSURL     string
	JWTIssuer   string
	JWTAudience string
	// Dev "allow" auth plugin (see DAFUQ_ALLOW_INSECURE_AUTH) — not for production.
	AllowInsecureAuth bool
	AllowJWTSecret    string
	AllowSubject      string
	// PAM in-process auth (Linux + libc PAM) — "plugin": { "local": "pam" }.
	PAMJWTSecret string
	PAMService   string

	// HTTP server (production) — use zero values only before Load; Load sets defaults.
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ShutdownTimeout   time.Duration
	// Max body read for gateway HTTP proxy routes (0 = [DefaultProxyMaxBodyBytes]).
	ProxyMaxBodyBytes int64
}

// DefaultProxyMaxBodyBytes is the cap on request bodies forwarded to upstream proxy backends.
const DefaultProxyMaxBodyBytes = 10 << 20

func getenv(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

// Load reads configuration from environment variables.
func Load() (Config, error) {
	cfg := Config{
		Addr:               getenv("DAFUQ_ADDR", ""),
		TLSCertFile:        getenv("DAFUQ_TLS_CERT_FILE", ""),
		TLSKeyFile:         getenv("DAFUQ_TLS_KEY_FILE", ""),
		StaticDir:          getenv("DAFUQ_STATIC_DIR", "../dist"),
		DashboardDataDir:   getenv("DAFUQ_DASHBOARD_DATA_DIR", "data/dashboards"),
		BackendAPIBaseURL:  strings.TrimRight(strings.TrimSpace(os.Getenv("DAFUQ_BACKEND_API_BASE_URL")), "/"),
		APIProxyConfigFile: strings.TrimSpace(os.Getenv("DAFUQ_API_PROXY_CONFIG_FILE")),
		WorkOSAPIKey:       strings.TrimSpace(os.Getenv("WORKOS_API_KEY")),
		WorkOSClientID:     strings.TrimSpace(os.Getenv("WORKOS_CLIENT_ID")),
		AuthRedirectURI:    strings.TrimSpace(os.Getenv("WORKOS_REDIRECT_URI")),
		PostLoginRedirect:  getenv("DAFUQ_POST_LOGIN_REDIRECT", "/"),
		WorkOSJWTIssuer:    strings.TrimSpace(os.Getenv("DAFUQ_WORKOS_JWT_ISSUER")),
		JWKSURL:            strings.TrimSpace(os.Getenv("DAFUQ_JWKS_URL")),
		JWTIssuer:          strings.TrimSpace(os.Getenv("DAFUQ_JWT_ISSUER")),
		JWTAudience:        strings.TrimSpace(os.Getenv("DAFUQ_JWT_AUDIENCE")),
		AllowInsecureAuth:  envTruthy("DAFUQ_ALLOW_INSECURE_AUTH"),
		AllowJWTSecret:     getenv("DAFUQ_ALLOW_JWT_SECRET", "dafuq-insecure-allow-jwt-key-change-in-production"),
		AllowSubject:       strings.TrimSpace(os.Getenv("DAFUQ_ALLOW_SUBJECT")),
		PAMJWTSecret:       strings.TrimSpace(os.Getenv("DAFUQ_PAM_JWT_SECRET")),
		PAMService:         strings.TrimSpace(os.Getenv("DAFUQ_PAM_SERVICE")),
	}
	if strings.TrimSpace(cfg.AllowSubject) == "" {
		cfg.AllowSubject = "test-user"
	}
	if cfg.Addr == "" {
		if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
			cfg.Addr = ":8443"
		} else {
			cfg.Addr = ":8080"
		}
	}
	var err error
	cfg.ReadHeaderTimeout, err = parseDurationEnv("DAFUQ_HTTP_READ_HEADER_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}
	cfg.ReadTimeout, err = parseDurationEnv("DAFUQ_HTTP_READ_TIMEOUT", 1*time.Minute)
	if err != nil {
		return Config{}, err
	}
	cfg.WriteTimeout, err = parseDurationEnv("DAFUQ_HTTP_WRITE_TIMEOUT", 1*time.Minute)
	if err != nil {
		return Config{}, err
	}
	cfg.IdleTimeout, err = parseDurationEnv("DAFUQ_HTTP_IDLE_TIMEOUT", 2*time.Minute)
	if err != nil {
		return Config{}, err
	}
	cfg.ShutdownTimeout, err = parseDurationEnv("DAFUQ_HTTP_SHUTDOWN_TIMEOUT", 30*time.Second)
	if err != nil {
		return Config{}, err
	}
	cfg.ProxyMaxBodyBytes, err = parseInt64EnvBytes("DAFUQ_PROXY_MAX_BODY_BYTES", 0)
	if err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func parseDurationEnv(key string, def time.Duration) (time.Duration, error) {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return def, nil
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: use a Go duration (e.g. 60s, 2m): %w", key, err)
	}
	return d, nil
}

// parseInt64EnvBytes returns def if unset. Use 0 def with caller applying DefaultProxyMaxBodyBytes.
func parseInt64EnvBytes(key string, def int64) (int64, error) {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return def, nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", key, err)
	}
	if v < 0 {
		return 0, fmt.Errorf("invalid %s: must be non-negative", key)
	}
	return v, nil
}

// EffectiveProxyMaxBody returns the cap on proxy upstream request bodies.
func (c Config) EffectiveProxyMaxBody() int64 {
	if c.ProxyMaxBodyBytes > 0 {
		return c.ProxyMaxBodyBytes
	}
	return DefaultProxyMaxBodyBytes
}

// UseWorkOSAuth is true when the in-process "workos" auth plugin is in use
// and WorkOS credentials are required. Determined in server from gateway file.
type AuthDriver string

const (
	AuthWorkOSPlugin AuthDriver = "workos"
	AuthProxyOrOIDC  AuthDriver = "proxy"
	AuthAllowPlugin  AuthDriver = "allow"
	AuthPAMPlugin    AuthDriver = "pam"
)

// ValidateForAuth enforces required env for the chosen driver.
func (c Config) ValidateForAuth(d AuthDriver) error {
	if d == AuthWorkOSPlugin {
		if c.WorkOSAPIKey == "" {
			return fmt.Errorf("WORKOS_API_KEY is required for auth plugin workos")
		}
		if c.WorkOSClientID == "" {
			return fmt.Errorf("WORKOS_CLIENT_ID is required for auth plugin workos")
		}
		if c.AuthRedirectURI == "" {
			return fmt.Errorf("WORKOS_REDIRECT_URI is required for auth plugin workos (e.g. https://localhost:8443/api/auth/callback)")
		}
		return nil
	}
	if d == AuthAllowPlugin {
		if !c.AllowInsecureAuth {
			return fmt.Errorf("auth plugin allow requires DAFUQ_ALLOW_INSECURE_AUTH=true (testing only, never in production with real data)")
		}
		if strings.TrimSpace(c.AllowJWTSecret) == "" {
			return fmt.Errorf("DAFUQ_ALLOW_JWT_SECRET is required for auth plugin allow")
		}
		return nil
	}
	if d == AuthPAMPlugin {
		if runtime.GOOS != "linux" {
			return fmt.Errorf("auth plugin pam requires Linux (PAM is not available on %s)", runtime.GOOS)
		}
		if strings.TrimSpace(c.PAMJWTSecret) == "" {
			return fmt.Errorf("DAFUQ_PAM_JWT_SECRET is required for auth plugin pam (HMAC secret for access/refresh tokens after PAM success)")
		}
		return nil
	}
	if d == AuthProxyOrOIDC {
		if c.JWKSURL == "" {
			return fmt.Errorf("DAFUQ_JWKS_URL is required when auth is served by proxy (OIDC JWKS for API tokens)")
		}
		if c.JWTIssuer == "" {
			return fmt.Errorf("DAFUQ_JWT_ISSUER is required when auth is served by proxy")
		}
		return nil
	}
	return fmt.Errorf("unknown or unsupported auth driver: %q", d)
}

// UseTLS reports whether TLS certificates are configured.
func (c Config) UseTLS() bool {
	return c.TLSCertFile != "" && c.TLSKeyFile != ""
}

// CookieSecure matches typical production HTTPS; can be overridden for local HTTP.
func (c Config) CookieSecure() bool {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("DAFUQ_COOKIE_SECURE"))); v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return c.UseTLS()
}
