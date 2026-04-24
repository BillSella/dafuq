package auth

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

// PostLoginRedirectURL builds the post-login target for browser redirects
// (same rules as the WorkOS flow: path or full URL, respect X-Forwarded-Proto when relative).
func PostLoginRedirectURL(cfg config.Config, r *http.Request) (*url.URL, error) {
	raw := strings.TrimSpace(cfg.PostLoginRedirect)
	if raw == "" {
		raw = "/"
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return url.Parse(raw)
	}
	rel, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	if rel.Scheme != "" {
		return rel, nil
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
		scheme = p
	}
	return &url.URL{
		Scheme:   scheme,
		Host:     r.Host,
		Path:     rel.Path,
		RawPath:  rel.RawPath,
		RawQuery: rel.RawQuery,
	}, nil
}
