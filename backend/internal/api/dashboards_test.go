package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

func TestDashboardStorePutGet(t *testing.T) {
	dir := t.TempDir()
	s := NewDashboardStore(dir)
	const sub = "user_01HABC"

	req := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(
		`{"version":1,"dashboards":[{"id":"d1","name":"N","widgets":[]}]}`))
	ctx := auth.ContextWithAccessClaims(req.Context(), &auth.AccessContextClaims{Subject: sub})
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	s.handlePut(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("PUT: %d %s", rr.Code, rr.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodGet, "/dashboards", nil)
	req2 = req2.WithContext(ctx)
	rr2 := httptest.NewRecorder()
	s.handleGet(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("GET: %d", rr2.Code)
	}
	if !strings.Contains(rr2.Body.String(), "d1") {
		t.Fatalf("unexpected body: %s", rr2.Body.String())
	}
	path, _ := s.pathForSubject(sub)
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}

func TestFilenameForSubject(t *testing.T) {
	name := filenameForSubject("user_01ABC")
	if !strings.HasSuffix(name, ".json") || !strings.Contains(name, "user") {
		t.Fatal(name)
	}
}
