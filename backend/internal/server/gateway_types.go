package server

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

// APIProxyRoute is a normalized gateway entry (load balancer listen path, local plugin, or HTTP proxy).
type APIProxyRoute struct {
	ListenPath string   `json:"listen_path"`
	Backends   []string `json:"backends"`
	Plugin     string   `json:"plugin"`
}

func normalizeRoute(r *APIProxyRoute) error {
	r.ListenPath = strings.TrimSpace(r.ListenPath)
	r.Plugin = strings.TrimSpace(r.Plugin)
	if r.ListenPath == "" {
		return errors.New("listen (or endpoint, or listen_path) is required on the route")
	}
	if !strings.HasPrefix(r.ListenPath, "/") {
		return errors.New("listen path must start with /")
	}
	if !strings.HasSuffix(r.ListenPath, "/") {
		r.ListenPath += "/"
	}
	if r.Plugin != "" {
		if len(r.Backends) > 0 {
			return errors.New("a local plugin route cannot declare plugin.proxy (or legacy backends)")
		}
		return nil
	}

	if len(r.Backends) == 0 {
		return errors.New("at least one backend is required when plugin is not set")
	}
	for i := range r.Backends {
		s := strings.TrimSpace(r.Backends[i])
		u, err := url.Parse(s)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return fmt.Errorf("invalid backend URL %q", r.Backends[i])
		}
		r.Backends[i] = s
	}
	return nil
}
