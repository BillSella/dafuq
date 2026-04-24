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
	"strings"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

const maxDashboardJSONBytes = 8 << 20 // 8 MiB

// DashboardStore persists per-user dashboard JSON on disk (data dir + JWT subject).
type DashboardStore struct {
	dir string
}

// NewDashboardStore returns a store rooted at dir (created on first write).
func NewDashboardStore(dir string) *DashboardStore {
	return &DashboardStore{dir: filepath.Clean(dir)}
}

// RegisterDashboardRoutes mounts GET/PUT /dashboards on mux (no extra prefix).
func RegisterDashboardRoutes(mux *http.ServeMux, store *DashboardStore) {
	mux.HandleFunc("GET /dashboards", store.handleGet)
	mux.HandleFunc("PUT /dashboards", store.handlePut)
}

func (s *DashboardStore) pathForSubject(sub string) (string, error) {
	name := filenameForSubject(sub)
	if name == "" {
		return "", errors.New("invalid subject")
	}
	return filepath.Join(s.dir, name), nil
}

func filenameForSubject(sub string) string {
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
		return hex.EncodeToString(h[:16]) + ".json"
	}
	return out + ".json"
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
	path, err := s.pathForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"version": 1, "dashboards": []any{}})
			return
		}
		http.Error(w, "read failed", http.StatusInternalServerError)
		return
	}
	if !json.Valid(data) {
		http.Error(w, "stored dashboards corrupt", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(data)
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
	for i, item := range arr {
		if _, ok := item["id"]; !ok {
			http.Error(w, fmt.Sprintf("dashboards[%d] missing id", i), http.StatusBadRequest)
			return
		}
		if _, ok := item["name"]; !ok {
			http.Error(w, fmt.Sprintf("dashboards[%d] missing name", i), http.StatusBadRequest)
			return
		}
		if _, ok := item["widgets"]; !ok {
			http.Error(w, fmt.Sprintf("dashboards[%d] missing widgets", i), http.StatusBadRequest)
			return
		}
	}
	if env.Version < 1 {
		env.Version = 1
	}
	out, err := json.MarshalIndent(&env, "", "  ")
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}
	path, err := s.pathForSubject(claims.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		http.Error(w, "data dir", http.StatusInternalServerError)
		return
	}
	if err := atomicWriteFile(path, out); err != nil {
		http.Error(w, "write failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "version": env.Version})
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
