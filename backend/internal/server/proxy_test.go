package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

// WorkOS in-process auth block for tests that only exercise data routes.
var testWorkOSAuthBlock = map[string]any{
	"listen": "/api/auth",
	"plugin": map[string]any{"local": "workos"},
}

func TestLoadGatewayConfigEmptyPathRequiresFile(t *testing.T) {
	_, _, err := LoadGatewayConfig("")
	if !errors.Is(err, ErrAPIProxyConfigPathRequired) {
		t.Fatalf("expected ErrAPIProxyConfigPathRequired, got %v", err)
	}
}

func TestLoadGatewayConfigListenFieldAliasesEndpoint(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"auth": testWorkOSAuthBlock,
		"routes": []map[string]any{
			{
				"endpoint": "/api/legacy-endpoint",
				"plugin":   map[string]any{"local": "local-metrics"},
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	_, routes, err := LoadGatewayConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(routes) != 1 || routes[0].ListenPath != "/api/legacy-endpoint/" {
		t.Fatalf("expected endpoint alias, got %#v", routes[0])
	}
}

func TestLoadGatewayConfigRoutesV2(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"auth": testWorkOSAuthBlock,
		"routes": []map[string]any{
			{
				"listen": "/api/ext",
				"plugin": map[string]any{
					"proxy": []string{"https://one.example.com/v1/data", "https://two.example.com/v1/data"},
				},
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	auth, routes, err := LoadGatewayConfig(path)
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if auth == nil || !strings.EqualFold(auth.Plugin, "workos") {
		t.Fatalf("expected default or explicit workos auth, got %#v", auth)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}
	if routes[0].ListenPath != "/api/ext/" {
		t.Fatalf("listen path was not normalized: %q", routes[0].ListenPath)
	}
	if routes[0].Plugin != "" {
		t.Fatalf("expected proxy route, not local plugin")
	}
	if len(routes[0].Backends) != 2 || !strings.HasSuffix(routes[0].Backends[0], "/v1/data") {
		t.Fatalf("unexpected backends: %#v", routes[0].Backends)
	}
}

func TestLoadGatewayConfigRoutesLegacy(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"auth": testWorkOSAuthBlock,
		"routes": []map[string]any{
			{
				"listen_path": "/api/ext",
				"backends":    []string{"https://one.example.com/v1/data", "https://two.example.com/v1/data"},
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	_, routes, err := LoadGatewayConfig(path)
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if len(routes) != 1 || routes[0].ListenPath != "/api/ext/" || len(routes[0].Backends) != 2 {
		t.Fatalf("unexpected route: %#v", routes[0])
	}
}

func TestLoadGatewayConfigWithPluginV2(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"auth": testWorkOSAuthBlock,
		"routes": []map[string]any{
			{
				"listen": "/api/local/metrics",
				"plugin": map[string]any{
					"local": "local-metrics",
				},
			},
		},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	_, routes, err := LoadGatewayConfig(path)
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

func TestLoadGatewayConfigPluginStringLegacy(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"auth": testWorkOSAuthBlock,
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
	_, routes, err := LoadGatewayConfig(path)
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if len(routes) != 1 || routes[0].Plugin != "local-metrics" {
		t.Fatalf("unexpected route: %#v", routes[0])
	}
}

func TestLoadGatewayFileExample(t *testing.T) {
	path := filepath.Join("..", "..", "api-proxy-routes.example.json")
	auth, routes, err := LoadGatewayConfig(path)
	if err != nil {
		t.Fatalf("load example: %v", err)
	}
	if auth == nil || !strings.EqualFold(auth.Plugin, "workos") || auth.ListenPath != "/api/auth/" {
		t.Fatalf("auth: %#v", auth)
	}
	if len(routes) != 3 {
		t.Fatalf("expected 3 data routes, got %d", len(routes))
	}
}

func TestLoadGatewayConfigMissingAuthKey(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b, _ := json.Marshal(map[string]any{
		"routes": []map[string]any{},
	})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	_, _, err := LoadGatewayConfig(path)
	if err == nil {
		t.Fatal("expected error for missing auth")
	}
}

func TestLoadGatewayConfigAuthNull(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "routes.json")
	b := []byte(`{"auth":null,"routes":[]}`)
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	_, _, err := LoadGatewayConfig(path)
	if err == nil {
		t.Fatal("expected error for auth: null")
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
		ListenPath: "/api/ext/",
		Backends:   []string{primary.URL + "/v1", secondary.URL + "/v1"},
	}, config.DefaultProxyMaxBodyBytes)
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
	h, err := routeHandler(route, reg, config.DefaultProxyMaxBodyBytes)
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
		ListenPath: "/api/ext/",
		Backends:   []string{down.URL},
	}, config.DefaultProxyMaxBodyBytes)
	req := httptest.NewRequest(http.MethodGet, "/api/ext/x", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", rr.Code)
	}
}
