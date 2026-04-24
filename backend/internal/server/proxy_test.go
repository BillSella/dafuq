package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadAPIProxyRoutes(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"routes": []map[string]any{
			{
				"listen_path":   "/api/ext",
				"upstream_path": "/v1/data",
				"backends":      []string{"https://one.example.com", "https://two.example.com"},
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	routes, err := LoadAPIProxyRoutes(path)
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}
	if routes[0].ListenPath != "/api/ext/" {
		t.Fatalf("listen path was not normalized: %q", routes[0].ListenPath)
	}
	if routes[0].UpstreamPath != "/v1/data/" {
		t.Fatalf("upstream path was not normalized: %q", routes[0].UpstreamPath)
	}
}

func TestLoadAPIProxyRoutesWithPlugin(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"routes": []map[string]any{
			{
				"listen_path": "/api/local/metrics",
				"plugin":      "local-metrics",
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	routes, err := LoadAPIProxyRoutes(path)
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}
	if routes[0].ListenPath != "/api/local/metrics/" {
		t.Fatalf("listen path was not normalized: %q", routes[0].ListenPath)
	}
	if routes[0].Plugin != "local-metrics" {
		t.Fatalf("plugin was not loaded: %q", routes[0].Plugin)
	}
}

func TestFailoverProxyUsesNextBackendOn5xx(t *testing.T) {
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "primary down", http.StatusBadGateway)
	}))
	defer primary.Close()

	var gotPath, gotQuery, gotAuth string
	secondary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, "secondary")
	}))
	defer secondary.Close()

	h := newFailoverProxy(APIProxyRoute{
		ListenPath:   "/api/ext/",
		UpstreamPath: "/v1/",
		Backends:     []string{primary.URL, secondary.URL},
	})
	req := httptest.NewRequest(http.MethodGet, "/api/ext/widgets?id=9", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
	if gotPath != "/v1/widgets" {
		t.Fatalf("unexpected upstream path: %q", gotPath)
	}
	if gotQuery != "id=9" {
		t.Fatalf("unexpected query: %q", gotQuery)
	}
	if gotAuth != "Bearer test-token" {
		t.Fatalf("authorization header not forwarded: %q", gotAuth)
	}
}

func TestRouteHandlerWithPlugin(t *testing.T) {
	reg := NewPluginRegistry()
	route := APIProxyRoute{
		ListenPath: "/api/local/metrics/",
		Plugin:     "local-metrics",
	}
	h, err := routeHandler(route, reg)
	if err != nil {
		t.Fatalf("unexpected plugin handler error: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/local/metrics/sample-gauge", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestFailoverProxyReturnsBadGatewayWhenAllBackendsFail(t *testing.T) {
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusInternalServerError)
	}))
	defer down.Close()

	h := newFailoverProxy(APIProxyRoute{
		ListenPath:   "/api/ext/",
		UpstreamPath: "/",
		Backends:     []string{down.URL},
	})
	req := httptest.NewRequest(http.MethodGet, "/api/ext/x", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", rr.Code)
	}
}
