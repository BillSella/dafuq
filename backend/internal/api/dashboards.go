package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

const maxDashboardJSONBytes = 8 << 20 // 8 MiB

// DashboardStore persists per-user dashboard JSON on disk.
// Layout:
//
//	<root>/<org>/users/<user-id>/<dashboard-id>.json
type DashboardStore struct {
	rootDir string
	orgID   string
}

// NewDashboardStore returns a store rooted at dir (created on first write).
func NewDashboardStore(dir, orgID string) *DashboardStore {
	return &DashboardStore{
		rootDir: filepath.Clean(dir),
		orgID:   sanitizePathSegment(orgID, "default"),
	}
}

// RegisterDashboardRoutes mounts GET/PUT /dashboards on mux (no extra prefix).
func RegisterDashboardRoutes(mux *http.ServeMux, store *DashboardStore) {
	mux.HandleFunc("GET /dashboards", store.handleGet)
	mux.HandleFunc("PUT /dashboards", store.handlePut)
	mux.HandleFunc("GET /dashboards/{dashboardId}/versions", store.handleGetVersions)
	mux.HandleFunc("POST /dashboards/{dashboardId}/rollback", store.handleRollback)
}

func (s *DashboardStore) userDirForSubject(sub string) (string, error) {
	name := dirNameForSubject(sub)
	if name == "" {
		return "", errors.New("invalid subject")
	}
	return filepath.Join(s.rootDir, s.orgID, "users", name), nil
}

func (s *DashboardStore) pathForGroup(groupID string) (string, error) {
	name := dirNameForSubject(groupID)
	if name == "" {
		return "", errors.New("invalid group id")
	}
	return filepath.Join(s.rootDir, s.orgID, "groups", name), nil
}

func dirNameForSubject(sub string) string {
	sub = strings.TrimSpace(sub)
	if sub == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range sub {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '-', r == '_':
			b.WriteRune(r)
		default:
			b.WriteByte('_')
		}
	}
	out := b.String()
	if out == "" || len(out) > 200 {
		h := sha256.Sum256([]byte(sub))
		return hex.EncodeToString(h[:16])
	}
	return out
}

func dashboardFileNameForID(id string) string {
	return dirNameForSubject(id)
}

// dashboardFile matches the frontend envelope { version, dashboards }.
type dashboardFile struct {
	Version    int             `json:"version"`
	Dashboards json.RawMessage `json:"dashboards"`
}

func (s *DashboardStore) handleGet(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.AccessClaimsFromContext(r.Context())
	if !ok || claims.Subject == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userDir, err := s.userDirForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	entries, err := os.ReadDir(userDir)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"version": 1, "dashboards": []any{}})
			return
		}
		http.Error(w, "read failed", http.StatusInternalServerError)
		return
	}
	dashboards := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path, err := newestVersionFilePath(filepath.Join(userDir, entry.Name()))
		if err != nil {
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		if path == "" {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		var item map[string]any
		if err := json.Unmarshal(data, &item); err != nil {
			http.Error(w, "stored dashboards corrupt", http.StatusInternalServerError)
			return
		}
		if err := validateDashboardItem(item, -1); err != nil {
			http.Error(w, "stored dashboards corrupt", http.StatusInternalServerError)
			return
		}
		dashboards = append(dashboards, item)
	}
	sort.Slice(dashboards, func(i, j int) bool {
		left, _ := dashboards[i]["id"].(string)
		right, _ := dashboards[j]["id"].(string)
		return left < right
	})
	writeJSON(w, http.StatusOK, map[string]any{"version": 1, "dashboards": dashboards})
}

func (s *DashboardStore) handlePut(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.AccessClaimsFromContext(r.Context())
	if !ok || claims.Subject == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxDashboardJSONBytes)
	var env dashboardFile
	if err := json.NewDecoder(r.Body).Decode(&env); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if env.Dashboards == nil {
		http.Error(w, "dashboards field required", http.StatusBadRequest)
		return
	}
	// Light validation: must be a JSON array of objects with id, name, widgets.
	var arr []map[string]any
	if err := json.Unmarshal(env.Dashboards, &arr); err != nil {
		http.Error(w, "dashboards must be an array", http.StatusBadRequest)
		return
	}
	if env.Version < 1 {
		env.Version = 1
	}
	userDir, err := s.userDirForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(userDir, 0o700); err != nil {
		http.Error(w, "data dir", http.StatusInternalServerError)
		return
	}
	desired := map[string]struct{}{}
	for i, item := range arr {
		if err := validateDashboardItem(item, i); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		id, _ := item["id"].(string)
		dashboardDirName := dashboardFileNameForID(id)
		if dashboardDirName == "" {
			http.Error(w, fmt.Sprintf("dashboards[%d] invalid id", i), http.StatusBadRequest)
			return
		}
		if _, exists := desired[dashboardDirName]; exists {
			http.Error(w, fmt.Sprintf("duplicate dashboard id filename %q", dashboardDirName), http.StatusBadRequest)
			return
		}
		desired[dashboardDirName] = struct{}{}
		out, err := json.MarshalIndent(item, "", "  ")
		if err != nil {
			http.Error(w, "encode error", http.StatusInternalServerError)
			return
		}
		dashboardDir := filepath.Join(userDir, dashboardDirName)
		if err := os.MkdirAll(dashboardDir, 0o700); err != nil {
			http.Error(w, "data dir", http.StatusInternalServerError)
			return
		}
		if err := writeVersionSnapshotWithRetry(dashboardDir, out); err != nil {
			http.Error(w, "write failed", http.StatusInternalServerError)
			return
		}
		if err := pruneDashboardVersions(dashboardDir, 10); err != nil {
			http.Error(w, "cleanup failed", http.StatusInternalServerError)
			return
		}
	}
	entries, err := os.ReadDir(userDir)
	if err != nil {
		http.Error(w, "read failed", http.StatusInternalServerError)
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, keep := desired[entry.Name()]; keep {
			continue
		}
		if err := s.moveDashboardToRecovery(userDir, entry.Name()); err != nil {
			http.Error(w, "cleanup failed", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "version": env.Version})
}

func (s *DashboardStore) moveDashboardToRecovery(userDir, dashboardDirName string) error {
	src := filepath.Join(userDir, dashboardDirName)
	userName := filepath.Base(filepath.Clean(userDir))
	recoveryUserDir := filepath.Join(s.rootDir, s.orgID, "deleted", "users", userName)
	if err := os.MkdirAll(recoveryUserDir, 0o700); err != nil {
		return err
	}
	dest := filepath.Join(recoveryUserDir, dashboardDirName)
	if _, err := os.Stat(dest); err == nil {
		archived, err := nextRecoveryName(recoveryUserDir, dashboardDirName)
		if err != nil {
			return err
		}
		if err := os.Rename(dest, archived); err != nil {
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.Rename(src, dest)
}

func nextRecoveryName(recoveryUserDir, dashboardDirName string) (string, error) {
	for n := 1; n < 1000000; n++ {
		candidate := filepath.Join(recoveryUserDir, fmt.Sprintf("%s-%d", dashboardDirName, n))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("failed to find recovery suffix for %q", dashboardDirName)
}

func (s *DashboardStore) handleGetVersions(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.AccessClaimsFromContext(r.Context())
	if !ok || claims.Subject == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dashboardID := strings.TrimSpace(r.PathValue("dashboardId"))
	if dashboardID == "" {
		http.Error(w, "dashboard id required", http.StatusBadRequest)
		return
	}
	userDir, err := s.userDirForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	dashboardDir := filepath.Join(userDir, dashboardFileNameForID(dashboardID))
	versions, err := listDashboardVersionFiles(dashboardDir)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"versions": []any{}})
			return
		}
		http.Error(w, "read failed", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]string, 0, len(versions))
	for _, file := range versions {
		display, err := versionDisplayFromFileName(filepath.Base(file))
		if err != nil {
			continue
		}
		out = append(out, map[string]string{"timestamp": display})
	}
	writeJSON(w, http.StatusOK, map[string]any{"versions": out})
}

func (s *DashboardStore) handleRollback(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.AccessClaimsFromContext(r.Context())
	if !ok || claims.Subject == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dashboardID := strings.TrimSpace(r.PathValue("dashboardId"))
	if dashboardID == "" {
		http.Error(w, "dashboard id required", http.StatusBadRequest)
		return
	}
	var body struct {
		Timestamp string `json:"timestamp"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	var extra any
	if err := dec.Decode(&extra); err == nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	versionName, err := versionFileNameFromDisplay(body.Timestamp)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	userDir, err := s.userDirForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	dashboardDir := filepath.Join(userDir, dashboardFileNameForID(dashboardID))
	sourcePath := filepath.Join(dashboardDir, versionName)
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "version not found", http.StatusNotFound)
			return
		}
		http.Error(w, "read failed", http.StatusInternalServerError)
		return
	}
	var dashboard map[string]any
	if err := json.Unmarshal(data, &dashboard); err != nil {
		http.Error(w, "stored dashboards corrupt", http.StatusInternalServerError)
		return
	}
	if err := validateDashboardItem(dashboard, -1); err != nil {
		http.Error(w, "stored dashboards corrupt", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"dashboard": dashboard})
}

func validateDashboardItem(item map[string]any, index int) error {
	idRaw, ok := item["id"]
	if !ok {
		if index >= 0 {
			return fmt.Errorf("dashboards[%d] missing id", index)
		}
		return errors.New("dashboard missing id")
	}
	id, ok := idRaw.(string)
	if !ok || strings.TrimSpace(id) == "" {
		if index >= 0 {
			return fmt.Errorf("dashboards[%d] invalid id", index)
		}
		return errors.New("dashboard invalid id")
	}
	if _, ok := item["name"]; !ok {
		if index >= 0 {
			return fmt.Errorf("dashboards[%d] missing name", index)
		}
		return errors.New("dashboard missing name")
	}
	if _, ok := item["widgets"]; !ok {
		if index >= 0 {
			return fmt.Errorf("dashboards[%d] missing widgets", index)
		}
		return errors.New("dashboard missing widgets")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func atomicWriteFile(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".dashboard-*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func sanitizePathSegment(in, fallback string) string {
	name := strings.TrimSpace(in)
	if name == "" {
		return fallback
	}
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '-', r == '_':
			b.WriteRune(r)
		default:
			b.WriteByte('_')
		}
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return fallback
	}
	return out
}

const versionTimestampLayout = "2006-01-02 15-04-05"
const versionDisplayLayout = "15:04:05 2006-01-02"

func versionFileName(now time.Time) string {
	return now.Format(versionTimestampLayout) + ".json"
}

func writeVersionSnapshotWithRetry(dashboardDir string, data []byte) error {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		path := filepath.Join(dashboardDir, versionFileName(time.Now()))
		err := writeFileNoOverwrite(path, data)
		if err == nil {
			return nil
		}
		lastErr = err
		if !errors.Is(err, os.ErrExist) {
			return err
		}
		if attempt < 2 {
			time.Sleep(1 * time.Second)
		}
	}
	return lastErr
}

func writeFileNoOverwrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

func versionFileNameFromDisplay(display string) (string, error) {
	ts := strings.TrimSpace(display)
	if ts == "" {
		return "", errors.New("timestamp required")
	}
	parsed, err := time.ParseInLocation(versionDisplayLayout, ts, time.Local)
	if err != nil {
		return "", fmt.Errorf("invalid timestamp")
	}
	return parsed.Format(versionTimestampLayout) + ".json", nil
}

func versionDisplayFromFileName(name string) (string, error) {
	base := strings.TrimSuffix(name, ".json")
	parsed, err := time.ParseInLocation(versionTimestampLayout, base, time.Local)
	if err != nil {
		return "", err
	}
	return parsed.Format(versionDisplayLayout), nil
}

func listDashboardVersionFiles(dashboardDir string) ([]string, error) {
	entries, err := os.ReadDir(dashboardDir)
	if err != nil {
		return nil, err
	}
	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		files = append(files, filepath.Join(dashboardDir, entry.Name()))
	}
	sort.Slice(files, func(i, j int) bool {
		return filepath.Base(files[i]) > filepath.Base(files[j])
	})
	return files, nil
}

func newestVersionFilePath(dashboardDir string) (string, error) {
	files, err := listDashboardVersionFiles(dashboardDir)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	if len(files) == 0 {
		return "", nil
	}
	return files[0], nil
}

func pruneDashboardVersions(dashboardDir string, keep int) error {
	files, err := listDashboardVersionFiles(dashboardDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for i := keep; i < len(files); i++ {
		if err := os.Remove(files[i]); err != nil {
			return err
		}
	}
	return nil
}
