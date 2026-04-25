package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

func TestDashboardStorePutGet(t *testing.T) {
	dir := t.TempDir()
	s := NewDashboardStore(dir, "acme")
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
	userDir, _ := s.userDirForSubject(sub)
	dashboardDir := filepath.Join(userDir, "d1")
	entries, err := os.ReadDir(dashboardDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || !strings.HasSuffix(entries[0].Name(), ".json") {
		t.Fatalf("expected one version file under %s, got %d", dashboardDir, len(entries))
	}
	if !strings.Contains(userDir, string(os.PathSeparator)+"acme"+string(os.PathSeparator)+"users"+string(os.PathSeparator)) {
		t.Fatalf("expected org/users path, got %s", userDir)
	}
}

func TestDirNameForSubject(t *testing.T) {
	name := dirNameForSubject("user_01ABC")
	if strings.HasSuffix(name, ".json") || !strings.Contains(name, "user") {
		t.Fatal(name)
	}
}

func TestPathForGroup(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")
	path, err := s.pathForGroup("ops-team")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(path, string(os.PathSeparator)+"acme"+string(os.PathSeparator)+"groups"+string(os.PathSeparator)) {
		t.Fatalf("expected org/groups path, got %s", path)
	}
	if !strings.HasSuffix(path, "ops-team") {
		t.Fatalf("unexpected group filename: %s", path)
	}
}

func TestDashboardDeleteMovesToRecovery(t *testing.T) {
	dir := t.TempDir()
	s := NewDashboardStore(dir, "acme")
	const sub = "alice"
	ctx := auth.ContextWithAccessClaims(
		httptest.NewRequest(http.MethodPut, "/dashboards", nil).Context(),
		&auth.AccessContextClaims{Subject: sub},
	)

	put := func(body string) {
		req := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(body)).WithContext(ctx)
		rr := httptest.NewRecorder()
		s.handlePut(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("PUT: %d %s", rr.Code, rr.Body.String())
		}
	}

	put(`{"version":1,"dashboards":[{"id":"d1","name":"One","widgets":[]},{"id":"d2","name":"Two","widgets":[]}]}`)
	put(`{"version":1,"dashboards":[{"id":"d1","name":"One","widgets":[]}]}`)

	userDir, err := s.userDirForSubject(sub)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(userDir, "d2")); !os.IsNotExist(err) {
		t.Fatalf("expected d2 removed from active user dir, got err=%v", err)
	}
	recovery := filepath.Join(dir, "acme", "deleted", "users", "alice", "d2")
	if st, err := os.Stat(recovery); err != nil || !st.IsDir() {
		t.Fatalf("expected recovery dir %s to exist, err=%v", recovery, err)
	}
}

func TestDashboardDeleteRecoveryNameConflict(t *testing.T) {
	dir := t.TempDir()
	s := NewDashboardStore(dir, "acme")
	const sub = "alice"
	ctx := auth.ContextWithAccessClaims(
		httptest.NewRequest(http.MethodPut, "/dashboards", nil).Context(),
		&auth.AccessContextClaims{Subject: sub},
	)

	put := func(body string) {
		req := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(body)).WithContext(ctx)
		rr := httptest.NewRecorder()
		s.handlePut(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("PUT: %d %s", rr.Code, rr.Body.String())
		}
	}

	// First delete -> deleted/users/alice/d2
	put(`{"version":1,"dashboards":[{"id":"d2","name":"Two","widgets":[]}]}`)
	put(`{"version":1,"dashboards":[]}`)
	// Recreate same dashboard id and delete again -> existing recovery should be renamed to d2-1.
	put(`{"version":1,"dashboards":[{"id":"d2","name":"Two Again","widgets":[]}]}`)
	put(`{"version":1,"dashboards":[]}`)

	base := filepath.Join(dir, "acme", "deleted", "users", "alice")
	if st, err := os.Stat(filepath.Join(base, "d2")); err != nil || !st.IsDir() {
		t.Fatalf("expected latest deleted dir d2 to exist, err=%v", err)
	}
	if st, err := os.Stat(filepath.Join(base, "d2-1")); err != nil || !st.IsDir() {
		t.Fatalf("expected prior deleted dir d2-1 to exist, err=%v", err)
	}
}
