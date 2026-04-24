package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/api"
	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

type APIProxyRoute struct {
	ListenPath   string   `json:"listen_path"`
	UpstreamPath string   `json:"upstream_path"`
	Backends     []string `json:"backends"`
	Plugin       string   `json:"plugin"`
}

type apiProxyFile struct {
	Routes []APIProxyRoute `json:"routes"`
}

func LoadAPIProxyRoutes(path string) ([]APIProxyRoute, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var f apiProxyFile
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if len(f.Routes) == 0 {
		return nil, fmt.Errorf("no routes configured in %s", path)
	}
	for i := range f.Routes {
		r := &f.Routes[i]
		if err := normalizeRoute(r); err != nil {
			return nil, fmt.Errorf("route %d: %w", i, err)
		}
	}
	return f.Routes, nil
}

func normalizeRoute(r *APIProxyRoute) error {
	r.ListenPath = strings.TrimSpace(r.ListenPath)
	r.UpstreamPath = strings.TrimSpace(r.UpstreamPath)
	r.Plugin = strings.TrimSpace(r.Plugin)
	if r.ListenPath == "" {
		return errors.New("listen_path is required")
	}
	if !strings.HasPrefix(r.ListenPath, "/") {
		return errors.New("listen_path must start with /")
	}
	if !strings.HasSuffix(r.ListenPath, "/") {
		r.ListenPath += "/"
	}
	if r.Plugin != "" {
		if len(r.Backends) > 0 {
			return errors.New("plugin routes cannot declare backends")
		}
		return nil
	}

	if r.UpstreamPath == "" {
		r.UpstreamPath = "/"
	}
	if !strings.HasPrefix(r.UpstreamPath, "/") {
		return errors.New("upstream_path must start with /")
	}
	if !strings.HasSuffix(r.UpstreamPath, "/") {
		r.UpstreamPath += "/"
	}
	if len(r.Backends) == 0 {
		return errors.New("at least one backend is required when plugin is not set")
	}
	for i := range r.Backends {
		r.Backends[i] = strings.TrimRight(strings.TrimSpace(r.Backends[i]), "/")
		u, err := url.Parse(r.Backends[i])
		if err != nil || u.Scheme == "" || u.Host == "" {
			return fmt.Errorf("invalid backend URL %q", r.Backends[i])
		}
	}
	return nil
}

type PluginRegistry struct {
	handlers map[string]http.Handler
}

func NewPluginRegistry() *PluginRegistry {
	m := http.NewServeMux()
	m.HandleFunc("GET /sample-gauge", api.SampleGaugeValue)
	return &PluginRegistry{
		handlers: map[string]http.Handler{
			"local-metrics": m,
		},
	}
}

func (r *PluginRegistry) Register(name string, handler http.Handler) {
	if r.handlers == nil {
		r.handlers = map[string]http.Handler{}
	}
	r.handlers[strings.TrimSpace(name)] = handler
}

func (r *PluginRegistry) Handler(name string) (http.Handler, bool) {
	h, ok := r.handlers[strings.TrimSpace(name)]
	return h, ok
}

func RegisterAPIRoutes(mux *http.ServeMux, v *auth.JWTValidator, routes []APIProxyRoute, plugins *PluginRegistry) error {
	for _, route := range routes {
		route := route
		h, err := routeHandler(route, plugins)
		if err != nil {
			return err
		}
		mux.Handle(route.ListenPath, auth.BearerAuth(v)(h))
	}
	return nil
}

func routeHandler(route APIProxyRoute, plugins *PluginRegistry) (http.Handler, error) {
	if route.Plugin != "" {
		if plugins == nil {
			return nil, errors.New("plugin registry is required for plugin routes")
		}
		h, ok := plugins.Handler(route.Plugin)
		if !ok {
			return nil, fmt.Errorf("unknown plugin %q for route %q", route.Plugin, route.ListenPath)
		}
		return http.StripPrefix(route.ListenPath[:len(route.ListenPath)-1], h), nil
	}
	return newFailoverProxy(route), nil
}

func newFailoverProxy(route APIProxyRoute) http.Handler {
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   5 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   5 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "failed to read request body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		lastStatus := http.StatusBadGateway
		var lastErr error
		for _, backend := range route.Backends {
			resp, status, err := proxyOnce(client, backend, route, r, body)
			if err != nil {
				lastErr = err
				lastStatus = status
				continue
			}
			defer resp.Body.Close()
			copyHeader(w.Header(), resp.Header)
			w.WriteHeader(resp.StatusCode)
			_, _ = io.Copy(w, resp.Body)
			return
		}
		if lastErr != nil {
			http.Error(w, "upstream proxy failed: "+lastErr.Error(), lastStatus)
			return
		}
		http.Error(w, "no healthy upstream backends", http.StatusBadGateway)
	})
}

func proxyOnce(client *http.Client, backend string, route APIProxyRoute, in *http.Request, body []byte) (*http.Response, int, error) {
	u, err := url.Parse(backend)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	targetPath := strings.TrimPrefix(in.URL.Path, route.ListenPath)
	targetPath = route.UpstreamPath + targetPath
	u.Path = singleJoiningSlash(u.Path, targetPath)
	u.RawQuery = in.URL.RawQuery

	req, err := http.NewRequestWithContext(in.Context(), in.Method, u.String(), bytes.NewReader(body))
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	copyHeader(req.Header, in.Header)
	req.Host = u.Host
	req.Header.Del("Connection")
	req.Header.Del("Proxy-Connection")
	req.Header.Del("Keep-Alive")
	req.Header.Del("Transfer-Encoding")
	req.Header.Del("Upgrade")
	req.Header.Del("Proxy-Authenticate")
	req.Header.Del("Proxy-Authorization")
	req.Header.Del("Te")
	req.Header.Del("Trailer")
	req.Header.Del("Accept-Encoding")

	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	if resp.StatusCode >= 500 {
		_ = resp.Body.Close()
		return nil, http.StatusBadGateway, fmt.Errorf("backend %s returned %d", backend, resp.StatusCode)
	}
	return resp, http.StatusBadGateway, nil
}

func copyHeader(dst, src http.Header) {
	for k := range dst {
		dst.Del(k)
	}
	for k, vv := range src {
		if slices.Contains([]string{
			"Connection", "Proxy-Connection", "Keep-Alive", "Transfer-Encoding", "Upgrade",
			"Proxy-Authenticate", "Proxy-Authorization", "Te", "Trailer",
		}, k) {
			continue
		}
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	default:
		return a + b
	}
}
