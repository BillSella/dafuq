package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds server and WorkOS settings loaded from the environment.
type Config struct {
	Addr               string
	TLSCertFile        string
	TLSKeyFile         string
	StaticDir          string
	BackendAPIBaseURL  string
	APIProxyConfigFile string
	WorkOSAPIKey       string
	WorkOSClientID     string
	AuthRedirectURI    string
	PostLoginRedirect  string
	WorkOSJWTIssuer    string
}

func getenv(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// Load reads configuration from environment variables.
func Load() (Config, error) {
	cfg := Config{
		Addr:               getenv("DAFUQ_ADDR", ""),
		TLSCertFile:        getenv("DAFUQ_TLS_CERT_FILE", ""),
		TLSKeyFile:         getenv("DAFUQ_TLS_KEY_FILE", ""),
		StaticDir:          getenv("DAFUQ_STATIC_DIR", "../dist"),
		BackendAPIBaseURL:  strings.TrimRight(strings.TrimSpace(os.Getenv("DAFUQ_BACKEND_API_BASE_URL")), "/"),
		APIProxyConfigFile: strings.TrimSpace(os.Getenv("DAFUQ_API_PROXY_CONFIG_FILE")),
		WorkOSAPIKey:       strings.TrimSpace(os.Getenv("WORKOS_API_KEY")),
		WorkOSClientID:     strings.TrimSpace(os.Getenv("WORKOS_CLIENT_ID")),
		AuthRedirectURI:    strings.TrimSpace(os.Getenv("WORKOS_REDIRECT_URI")),
		PostLoginRedirect:  getenv("DAFUQ_POST_LOGIN_REDIRECT", "/"),
		WorkOSJWTIssuer:    strings.TrimSpace(os.Getenv("DAFUQ_WORKOS_JWT_ISSUER")),
	}
	if cfg.Addr == "" {
		if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
			cfg.Addr = ":8443"
		} else {
			cfg.Addr = ":8080"
		}
	}
	if cfg.WorkOSAPIKey == "" {
		return Config{}, fmt.Errorf("WORKOS_API_KEY is required")
	}
	if cfg.WorkOSClientID == "" {
		return Config{}, fmt.Errorf("WORKOS_CLIENT_ID is required")
	}
	if cfg.AuthRedirectURI == "" {
		return Config{}, fmt.Errorf("WORKOS_REDIRECT_URI is required (e.g. https://localhost:8443/api/auth/callback)")
	}
	return cfg, nil
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
