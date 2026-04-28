package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestRegisterDashboardRoutes(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")
	mux := http.NewServeMux()
	RegisterDashboardRoutes(mux, s)
	req := httptest.NewRequest(http.MethodGet, "/dashboards", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected routed unauthorized without claims, got %d", rec.Code)
	}
}

func TestDashboardVersionsAndRollback(t *testing.T) {
	dir := t.TempDir()
	s := NewDashboardStore(dir, "acme")
	sub := "bob"
	ctx := auth.ContextWithAccessClaims(contextWithReq(t).Context(), &auth.AccessContextClaims{Subject: sub})

	putReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(
		`{"version":1,"dashboards":[{"id":"d1","name":"Dashboard","widgets":[]}]}`,
	)).WithContext(ctx)
	putRec := httptest.NewRecorder()
	s.handlePut(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("PUT: %d %s", putRec.Code, putRec.Body.String())
	}

	userDir, _ := s.userDirForSubject(sub)
	dashDir := filepath.Join(userDir, "d1")
	versions, err := listDashboardVersionFiles(dashDir)
	if err != nil || len(versions) == 0 {
		t.Fatalf("expected at least one version file, err=%v", err)
	}
	display, err := versionDisplayFromFileName(filepath.Base(versions[0]))
	if err != nil {
		t.Fatalf("display conversion failed: %v", err)
	}

	versionsReq := httptest.NewRequest(http.MethodGet, "/dashboards/d1/versions", nil).WithContext(ctx)
	versionsReq.SetPathValue("dashboardId", "d1")
	versionsRec := httptest.NewRecorder()
	s.handleGetVersions(versionsRec, versionsReq)
	if versionsRec.Code != http.StatusOK {
		t.Fatalf("GET versions: %d %s", versionsRec.Code, versionsRec.Body.String())
	}

	rollbackReq := httptest.NewRequest(http.MethodPost, "/dashboards/d1/rollback", strings.NewReader(
		`{"timestamp":"`+display+`"}`,
	)).WithContext(ctx)
	rollbackReq.SetPathValue("dashboardId", "d1")
	rollbackRec := httptest.NewRecorder()
	s.handleRollback(rollbackRec, rollbackReq)
	if rollbackRec.Code != http.StatusOK {
		t.Fatalf("rollback: %d %s", rollbackRec.Code, rollbackRec.Body.String())
	}
}

func TestVersionNameDisplayRoundTrip(t *testing.T) {
	now := time.Now()
	file := versionFileName(now)
	display, err := versionDisplayFromFileName(file)
	if err != nil {
		t.Fatalf("display parse failed: %v", err)
	}
	back, err := versionFileNameFromDisplay(display)
	if err != nil {
		t.Fatalf("reverse conversion failed: %v", err)
	}
	if back != file {
		t.Fatalf("expected round trip to preserve file name, got %q != %q", back, file)
	}
}

func TestVersionFileNameFromDisplayErrors(t *testing.T) {
	if _, err := versionFileNameFromDisplay(" "); err == nil {
		t.Fatalf("expected timestamp required error")
	}
	if _, err := versionFileNameFromDisplay("not-a-time"); err == nil {
		t.Fatalf("expected invalid timestamp error")
	}
}

func TestAtomicWriteAndNoOverwrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "a", "b.json")
	data := []byte(`{"x":1}`)
	if err := atomicWriteFile(path, data); err != nil {
		t.Fatalf("atomic write failed: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read back failed: %v", err)
	}
	if string(got) != string(data) {
		t.Fatalf("unexpected content %q", string(got))
	}
	if err := writeFileNoOverwrite(path, []byte(`{"x":2}`)); err == nil {
		t.Fatalf("expected os.O_EXCL overwrite attempt to fail")
	}
}

func TestPruneDashboardVersions(t *testing.T) {
	dir := t.TempDir()
	dashDir := filepath.Join(dir, "d1")
	if err := os.MkdirAll(dashDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"2026-01-01 00-00-03.json", "2026-01-01 00-00-02.json", "2026-01-01 00-00-01.json"} {
		p := filepath.Join(dashDir, name)
		if err := os.WriteFile(p, []byte(`{}`), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := pruneDashboardVersions(dashDir, 2); err != nil {
		t.Fatalf("prune failed: %v", err)
	}
	files, err := listDashboardVersionFiles(dashDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 {
		t.Fatalf("expected 2 files after prune, got %d", len(files))
	}
}

func TestHandleRollbackVersionNotFound(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")
	ctx := auth.ContextWithAccessClaims(contextWithReq(t).Context(), &auth.AccessContextClaims{Subject: "u"})
	req := httptest.NewRequest(http.MethodPost, "/dashboards/missing/rollback", strings.NewReader(
		`{"timestamp":"00:00:00 2026-01-01"}`,
	)).WithContext(ctx)
	req.SetPathValue("dashboardId", "missing")
	rec := httptest.NewRecorder()
	s.handleRollback(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 version not found, got %d", rec.Code)
	}
}

func TestDashboardHandlersUnauthorized(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")

	getReq := httptest.NewRequest(http.MethodGet, "/dashboards", nil)
	getRec := httptest.NewRecorder()
	s.handleGet(getRec, getReq)
	if getRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected GET unauthorized, got %d", getRec.Code)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(`{"version":1,"dashboards":[]}`))
	putRec := httptest.NewRecorder()
	s.handlePut(putRec, putReq)
	if putRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected PUT unauthorized, got %d", putRec.Code)
	}

	vReq := httptest.NewRequest(http.MethodGet, "/dashboards/d1/versions", nil)
	vReq.SetPathValue("dashboardId", "d1")
	vRec := httptest.NewRecorder()
	s.handleGetVersions(vRec, vReq)
	if vRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected versions unauthorized, got %d", vRec.Code)
	}

	rReq := httptest.NewRequest(http.MethodPost, "/dashboards/d1/rollback", strings.NewReader(`{"timestamp":"00:00:00 2026-01-01"}`))
	rReq.SetPathValue("dashboardId", "d1")
	rRec := httptest.NewRecorder()
	s.handleRollback(rRec, rReq)
	if rRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected rollback unauthorized, got %d", rRec.Code)
	}
}

func TestDashboardPutValidationFailures(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")
	ctx := auth.ContextWithAccessClaims(contextWithReq(t).Context(), &auth.AccessContextClaims{Subject: "alice"})

	badJSONReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader("{")).WithContext(ctx)
	badJSONRec := httptest.NewRecorder()
	s.handlePut(badJSONRec, badJSONReq)
	if badJSONRec.Code != http.StatusBadRequest {
		t.Fatalf("expected bad json 400, got %d", badJSONRec.Code)
	}

	missingDashReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(`{"version":1}`)).WithContext(ctx)
	missingDashRec := httptest.NewRecorder()
	s.handlePut(missingDashRec, missingDashReq)
	if missingDashRec.Code != http.StatusBadRequest {
		t.Fatalf("expected missing dashboards 400, got %d", missingDashRec.Code)
	}

	notArrayReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(`{"version":1,"dashboards":{"id":"x"}}`)).WithContext(ctx)
	notArrayRec := httptest.NewRecorder()
	s.handlePut(notArrayRec, notArrayReq)
	if notArrayRec.Code != http.StatusBadRequest {
		t.Fatalf("expected dashboards array 400, got %d", notArrayRec.Code)
	}

	duplicateIDReq := httptest.NewRequest(http.MethodPut, "/dashboards", strings.NewReader(
		`{"version":1,"dashboards":[{"id":"d1","name":"A","widgets":[]},{"id":"d1","name":"B","widgets":[]}]}`,
	)).WithContext(ctx)
	duplicateIDRec := httptest.NewRecorder()
	s.handlePut(duplicateIDRec, duplicateIDReq)
	if duplicateIDRec.Code != http.StatusBadRequest {
		t.Fatalf("expected duplicate id 400, got %d", duplicateIDRec.Code)
	}
}

func TestDashboardVersionsAndRollbackValidationFailures(t *testing.T) {
	s := NewDashboardStore(t.TempDir(), "acme")
	ctx := auth.ContextWithAccessClaims(contextWithReq(t).Context(), &auth.AccessContextClaims{Subject: "alice"})

	missingIDReq := httptest.NewRequest(http.MethodGet, "/dashboards//versions", nil).WithContext(ctx)
	missingIDReq.SetPathValue("dashboardId", "")
	missingIDRec := httptest.NewRecorder()
	s.handleGetVersions(missingIDRec, missingIDReq)
	if missingIDRec.Code != http.StatusBadRequest {
		t.Fatalf("expected versions missing id 400, got %d", missingIDRec.Code)
	}

	rollbackMissingIDReq := httptest.NewRequest(http.MethodPost, "/dashboards//rollback", strings.NewReader(`{"timestamp":"x"}`)).WithContext(ctx)
	rollbackMissingIDReq.SetPathValue("dashboardId", "")
	rollbackMissingIDRec := httptest.NewRecorder()
	s.handleRollback(rollbackMissingIDRec, rollbackMissingIDReq)
	if rollbackMissingIDRec.Code != http.StatusBadRequest {
		t.Fatalf("expected rollback missing id 400, got %d", rollbackMissingIDRec.Code)
	}

	badJSONReq := httptest.NewRequest(http.MethodPost, "/dashboards/d1/rollback", strings.NewReader("{")).WithContext(ctx)
	badJSONReq.SetPathValue("dashboardId", "d1")
	badJSONRec := httptest.NewRecorder()
	s.handleRollback(badJSONRec, badJSONReq)
	if badJSONRec.Code != http.StatusBadRequest {
		t.Fatalf("expected rollback invalid json 400, got %d", badJSONRec.Code)
	}

	extraJSONReq := httptest.NewRequest(http.MethodPost, "/dashboards/d1/rollback", strings.NewReader(`{"timestamp":"00:00:00 2026-01-01"}{"x":1}`)).WithContext(ctx)
	extraJSONReq.SetPathValue("dashboardId", "d1")
	extraJSONRec := httptest.NewRecorder()
	s.handleRollback(extraJSONRec, extraJSONReq)
	if extraJSONRec.Code != http.StatusBadRequest {
		t.Fatalf("expected rollback extra json 400, got %d", extraJSONRec.Code)
	}

	invalidTSReq := httptest.NewRequest(http.MethodPost, "/dashboards/d1/rollback", strings.NewReader(`{"timestamp":"bad-ts"}`)).WithContext(ctx)
	invalidTSReq.SetPathValue("dashboardId", "d1")
	invalidTSRec := httptest.NewRecorder()
	s.handleRollback(invalidTSRec, invalidTSReq)
	if invalidTSRec.Code != http.StatusBadRequest {
		t.Fatalf("expected rollback invalid timestamp 400, got %d", invalidTSRec.Code)
	}
}

func TestValidateDashboardItemFailures(t *testing.T) {
	cases := []map[string]any{
		{"name": "N", "widgets": []any{}},           // missing id
		{"id": "", "name": "N", "widgets": []any{}}, // invalid id
		{"id": "d1", "widgets": []any{}},            // missing name
		{"id": "d1", "name": "N"},                   // missing widgets
	}
	for i, item := range cases {
		if err := validateDashboardItem(item, i); err == nil {
			t.Fatalf("expected validation error for case %d", i)
		}
	}
}

func contextWithReq(t *testing.T) *http.Request {
	t.Helper()
	return httptest.NewRequest(http.MethodGet, "/", nil)
}
