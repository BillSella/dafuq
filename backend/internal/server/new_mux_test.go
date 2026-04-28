package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestNewMuxAllowAuthLocalFlow(t *testing.T) {
	tmp := t.TempDir()
	staticDir := filepath.Join(tmp, "dist")
	if err := os.MkdirAll(staticDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<html>ok</html>"), 0o600); err != nil {
		t.Fatal(err)
	}

	cfgPath := filepath.Join(tmp, "routes.json")
	cfgJSON := `{
  "auth": {
    "listen": "/api/auth",
    "plugin": { "local": "allow" }
  },
  "routes": [
    {
      "listen": "/api/local/metrics/",
      "plugin": { "local": "local-metrics" }
    }
  ]
}`
	if err := os.WriteFile(cfgPath, []byte(cfgJSON), 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := config.Config{
		StaticDir:          staticDir,
		DashboardDataDir:   filepath.Join(tmp, "dashboards"),
		OrganizationID:     "acme",
		APIProxyConfigFile: cfgPath,
		AllowInsecureAuth:  true,
		AllowJWTSecret:     "test-secret",
		AllowSubject:       "test-user",
	}

	h, err := NewMux(cfg)
	if err != nil {
		t.Fatalf("new mux failed: %v", err)
	}

	healthReq := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	healthRec := httptest.NewRecorder()
	h.ServeHTTP(healthRec, healthReq)
	if healthRec.Code != http.StatusOK {
		t.Fatalf("expected health 200, got %d", healthRec.Code)
	}

	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginReq.Header.Set("Accept", "application/json")
	loginRec := httptest.NewRecorder()
	h.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected allow login 200, got %d", loginRec.Code)
	}

	spaReq := httptest.NewRequest(http.MethodGet, "/dashboards", nil)
	spaRec := httptest.NewRecorder()
	h.ServeHTTP(spaRec, spaReq)
	if spaRec.Code != http.StatusOK {
		t.Fatalf("expected spa fallback 200, got %d", spaRec.Code)
	}
}

