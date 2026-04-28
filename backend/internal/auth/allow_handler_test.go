package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func newAllowHandlerForTest(t *testing.T) *AllowHandler {
	t.Helper()
	v, err := NewAllowValidator(config.Config{AllowJWTSecret: "test-secret", AllowSubject: "test-user"})
	if err != nil {
		t.Fatalf("validator create failed: %v", err)
	}
	return NewAllowHandler(config.Config{PostLoginRedirect: "/"}, v)
}

func TestAllowHandlerLoginJSON(t *testing.T) {
	h := newAllowHandlerForTest(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	req.Header.Set("Accept", "application/json")
	rec := httptest.NewRecorder()

	h.Login(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body AuthTokenJSON
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.AccessToken == "" || body.RefreshToken == "" {
		t.Fatalf("expected token fields in login response")
	}
}

func TestAllowHandlerCallbackJSONAndLogout(t *testing.T) {
	h := newAllowHandlerForTest(t)
	cbReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback", nil)
	cbReq.Header.Set("Accept", "application/json")
	cbRec := httptest.NewRecorder()
	h.Callback(cbRec, cbReq)
	if cbRec.Code != http.StatusOK {
		t.Fatalf("expected callback 200, got %d", cbRec.Code)
	}

	logoutGetReq := httptest.NewRequest(http.MethodGet, "/api/auth/logout", nil)
	logoutGetRec := httptest.NewRecorder()
	h.Logout(logoutGetRec, logoutGetReq)
	if logoutGetRec.Code != http.StatusFound {
		t.Fatalf("expected redirect for GET logout, got %d", logoutGetRec.Code)
	}

	logoutPostReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutPostRec := httptest.NewRecorder()
	h.Logout(logoutPostRec, logoutPostReq)
	if logoutPostRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for POST logout, got %d", logoutPostRec.Code)
	}
}

func TestAllowHandlerPasswordAndMe(t *testing.T) {
	h := newAllowHandlerForTest(t)

	pwReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"username":"alice"}`))
	pwRec := httptest.NewRecorder()
	h.Password(pwRec, pwReq)
	if pwRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from password, got %d", pwRec.Code)
	}
	var tok AuthTokenJSON
	if err := json.Unmarshal(pwRec.Body.Bytes(), &tok); err != nil {
		t.Fatalf("invalid token json: %v", err)
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	meRec := httptest.NewRecorder()
	h.Me(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from me, got %d", meRec.Code)
	}
}

func TestAllowHandlerRefreshInvalidToken(t *testing.T) {
	h := newAllowHandlerForTest(t)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"bad"}`))
	rec := httptest.NewRecorder()

	h.Refresh(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid refresh token, got %d", rec.Code)
	}
}
