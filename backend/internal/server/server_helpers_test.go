package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestAuthDriverSelection(t *testing.T) {
	if got := authDriverForRoute(&APIProxyRoute{Plugin: "allow"}); got != config.AuthAllowPlugin {
		t.Fatalf("expected allow driver, got %q", got)
	}
	if got := authDriverForRoute(&APIProxyRoute{Plugin: "pam"}); got != config.AuthPAMPlugin {
		t.Fatalf("expected pam driver, got %q", got)
	}
	if got := authDriverForRoute(&APIProxyRoute{Plugin: "workos"}); got != config.AuthWorkOSPlugin {
		t.Fatalf("expected workos driver, got %q", got)
	}
	if got := authDriverForRoute(&APIProxyRoute{Backends: []string{"https://example.com"}}); got != config.AuthProxyOrOIDC {
		t.Fatalf("expected proxy driver, got %q", got)
	}
}

func TestAuthRouteHelperPredicates(t *testing.T) {
	if !isWorkOSAuthRoute(&APIProxyRoute{Plugin: "workos"}) {
		t.Fatalf("expected workos predicate true")
	}
	if !isAllowAuthRoute(&APIProxyRoute{Plugin: "allow"}) {
		t.Fatalf("expected allow predicate true")
	}
	if !isPAMAuthRoute(&APIProxyRoute{Plugin: "pam"}) {
		t.Fatalf("expected pam predicate true")
	}
}

func TestSpaOrFileServesIndexFallback(t *testing.T) {
	dir := t.TempDir()
	index := filepath.Join(dir, "index.html")
	if err := os.WriteFile(index, []byte("<html>ok</html>"), 0o600); err != nil {
		t.Fatalf("write index failed: %v", err)
	}

	h := spaOrFile(dir)
	req := httptest.NewRequest(http.MethodGet, "/non-existent-route", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestSpaOrFileRejectsAPIPaths(t *testing.T) {
	h := spaOrFile(t.TempDir())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for api path, got %d", rec.Code)
	}
}

func TestLogRequestsPassthrough(t *testing.T) {
	h := logRequests(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected passthrough status, got %d", rec.Code)
	}
}

func TestSpaIndexMissingBuildAndPathValidation(t *testing.T) {
	h := spaIndex(t.TempDir())

	badReq := httptest.NewRequest(http.MethodGet, "/../x", nil)
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid path, got %d", badRec.Code)
	}

	missingReq := httptest.NewRequest(http.MethodGet, "/", nil)
	missingRec := httptest.NewRecorder()
	h.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when index.html missing, got %d", missingRec.Code)
	}
}
