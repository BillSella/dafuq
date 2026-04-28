package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

type stubPAMValidator struct {
	accessClaims *AccessContextClaims
	accessErr    error
	refreshSub   string
	refreshErr   error
}

func (s *stubPAMValidator) IssueAccessTokenForSubject(string) (string, error)  { return "access-token", nil }
func (s *stubPAMValidator) IssueRefreshTokenForSubject(string) (string, error) { return "refresh-token", nil }
func (s *stubPAMValidator) ValidateAccessToken(context.Context, string) (*AccessContextClaims, error) {
	if s.accessErr != nil {
		return nil, s.accessErr
	}
	return s.accessClaims, nil
}
func (s *stubPAMValidator) ValidateRefreshToken(context.Context, string) (string, error) {
	if s.refreshErr != nil {
		return "", s.refreshErr
	}
	return s.refreshSub, nil
}

func TestPAMLoginAndCallbackAndLogout(t *testing.T) {
	v, err := NewPAMValidator(config.Config{PAMJWTSecret: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	h := NewPAMHandler(config.Config{}, v)

	loginJSONReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginJSONReq.Header.Set("Accept", "application/json")
	loginJSONRec := httptest.NewRecorder()
	h.Login(loginJSONRec, loginJSONReq)
	if loginJSONRec.Code != http.StatusOK {
		t.Fatalf("expected login json 200, got %d", loginJSONRec.Code)
	}

	callbackReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback", nil)
	callbackRec := httptest.NewRecorder()
	h.Callback(callbackRec, callbackReq)
	if callbackRec.Code != http.StatusBadRequest {
		t.Fatalf("expected callback 400, got %d", callbackRec.Code)
	}

	logoutGetReq := httptest.NewRequest(http.MethodGet, "/api/auth/logout", nil)
	logoutGetRec := httptest.NewRecorder()
	h.Logout(logoutGetRec, logoutGetReq)
	if logoutGetRec.Code != http.StatusFound {
		t.Fatalf("expected logout GET redirect, got %d", logoutGetRec.Code)
	}
}

func TestPAMPasswordValidationAndInvalidCredentials(t *testing.T) {
	v, err := NewPAMValidator(config.Config{PAMJWTSecret: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	h := NewPAMHandler(config.Config{}, v)

	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/password", nil)
	getRec := httptest.NewRecorder()
	h.Password(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", getRec.Code)
	}

	badReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader("{"))
	badRec := httptest.NewRecorder()
	h.Password(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad json, got %d", badRec.Code)
	}

	missingReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"user":"alice"}`))
	missingRec := httptest.NewRecorder()
	h.Password(missingRec, missingReq)
	if missingRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing password, got %d", missingRec.Code)
	}

	invalidReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"user":"alice","password":"bad"}`))
	invalidRec := httptest.NewRecorder()
	h.Password(invalidRec, invalidReq)
	if invalidRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid credentials, got %d", invalidRec.Code)
	}
}

func TestPAMRefreshValidationBranches(t *testing.T) {
	h := &PAMHandler{v: &PAMValidator{secret: []byte("secret")}}

	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/refresh", nil)
	getRec := httptest.NewRecorder()
	h.Refresh(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET refresh, got %d", getRec.Code)
	}

	badReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader("{"))
	badRec := httptest.NewRecorder()
	h.Refresh(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid json, got %d", badRec.Code)
	}

	missingReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"organization_id":"org"}`))
	missingRec := httptest.NewRecorder()
	h.Refresh(missingRec, missingReq)
	if missingRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing refresh token, got %d", missingRec.Code)
	}

	invalidReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"bad"}`))
	invalidRec := httptest.NewRecorder()
	h.Refresh(invalidRec, invalidReq)
	if invalidRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid refresh token, got %d", invalidRec.Code)
	}
}

func TestPAMMeBranches(t *testing.T) {
	h := &PAMHandler{v: &PAMValidator{secret: []byte("secret")}}
	noAuthReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	noAuthRec := httptest.NewRecorder()
	h.Me(noAuthRec, noAuthReq)
	if noAuthRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", noAuthRec.Code)
	}

	invalidReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	invalidReq.Header.Set("Authorization", "Bearer bad")
	invalidRec := httptest.NewRecorder()
	h.Me(invalidRec, invalidReq)
	if invalidRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid token, got %d", invalidRec.Code)
	}

	// successful path
	v, err := NewPAMValidator(config.Config{PAMJWTSecret: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	token, err := v.IssueAccessTokenForSubject("alice")
	if err != nil {
		t.Fatal(err)
	}
	okReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	okReq.Header.Set("Authorization", "Bearer "+token)
	okRec := httptest.NewRecorder()
	NewPAMHandler(config.Config{}, v).Me(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid token, got %d", okRec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(okRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body["subject"] != "alice" {
		t.Fatalf("unexpected subject %#v", body["subject"])
	}
}

func TestPAMServiceDefaultAndConfigured(t *testing.T) {
	v, err := NewPAMValidator(config.Config{PAMJWTSecret: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	if got := NewPAMHandler(config.Config{}, v).pamService(); got != "login" {
		t.Fatalf("expected default login service, got %q", got)
	}
	if got := NewPAMHandler(config.Config{PAMService: "sshd"}, v).pamService(); got != "sshd" {
		t.Fatalf("expected configured pam service, got %q", got)
	}
}

func TestNewPAMValidatorRequiresSecret(t *testing.T) {
	if _, err := NewPAMValidator(config.Config{}); err == nil {
		t.Fatalf("expected missing PAMJWTSecret error")
	}
}

func TestStubPAMValidatorShape(t *testing.T) {
	s := &stubPAMValidator{refreshErr: errors.New("x")}
	if _, err := s.ValidateRefreshToken(context.Background(), "a"); err == nil {
		t.Fatalf("expected stub refresh error")
	}
}
