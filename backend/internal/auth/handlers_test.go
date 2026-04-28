package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

type stubValidator struct {
	claims *AccessContextClaims
	err    error
}

func (s stubValidator) ValidateAccessToken(context.Context, string) (*AccessContextClaims, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.claims, nil
}

type fakeWorkOSClient struct {
	authURL                    *url.URL
	authURLErr                 error
	lastAuthURLOpts            *usermanagement.GetAuthorizationURLOpts
	authCodeResp               usermanagement.AuthenticateResponse
	authCodeErr                error
	authPasswordResp           usermanagement.AuthenticateResponse
	authPasswordErr            error
	authRefreshResp            usermanagement.RefreshAuthenticationResponse
	authRefreshErr             error
	userResp                   usermanagement.User
	userErr                    error
}

func (f *fakeWorkOSClient) GetAuthorizationURL(opts usermanagement.GetAuthorizationURLOpts) (*url.URL, error) {
	f.lastAuthURLOpts = &opts
	if f.authURLErr != nil {
		return nil, f.authURLErr
	}
	return f.authURL, nil
}

func (f *fakeWorkOSClient) AuthenticateWithCode(context.Context, usermanagement.AuthenticateWithCodeOpts) (usermanagement.AuthenticateResponse, error) {
	if f.authCodeErr != nil {
		return usermanagement.AuthenticateResponse{}, f.authCodeErr
	}
	return f.authCodeResp, nil
}

func (f *fakeWorkOSClient) AuthenticateWithPassword(context.Context, usermanagement.AuthenticateWithPasswordOpts) (usermanagement.AuthenticateResponse, error) {
	if f.authPasswordErr != nil {
		return usermanagement.AuthenticateResponse{}, f.authPasswordErr
	}
	return f.authPasswordResp, nil
}

func (f *fakeWorkOSClient) AuthenticateWithRefreshToken(context.Context, usermanagement.AuthenticateWithRefreshTokenOpts) (usermanagement.RefreshAuthenticationResponse, error) {
	if f.authRefreshErr != nil {
		return usermanagement.RefreshAuthenticationResponse{}, f.authRefreshErr
	}
	return f.authRefreshResp, nil
}

func (f *fakeWorkOSClient) GetUser(context.Context, usermanagement.GetUserOpts) (usermanagement.User, error) {
	if f.userErr != nil {
		return usermanagement.User{}, f.userErr
	}
	return f.userResp, nil
}

func TestValidateOAuthState(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	rr := httptest.NewRecorder()
	h.setOAuthStateCookie(rr, "abc123")

	req := httptest.NewRequest("GET", "/api/auth/callback?code=x&state=abc123", nil)
	for _, c := range rr.Result().Cookies() {
		req.AddCookie(c)
	}
	if err := h.validateOAuthState(req); err != nil {
		t.Fatalf("expected valid state, got error: %v", err)
	}
}

func TestValidateOAuthStateMismatch(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	rr := httptest.NewRecorder()
	h.setOAuthStateCookie(rr, "expected")

	req := httptest.NewRequest("GET", "/api/auth/callback?code=x&state=actual", nil)
	for _, c := range rr.Result().Cookies() {
		req.AddCookie(c)
	}
	if err := h.validateOAuthState(req); err == nil {
		t.Fatal("expected mismatch error, got nil")
	}
}

func TestDecodeStrictJSONBodyRejectsUnknownAndExtra(t *testing.T) {
	t.Run("unknown field", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/password", strings.NewReader(`{"email":"a@b.com","password":"x","unexpected":1}`))
		rr := httptest.NewRecorder()
		var body passwordBody
		if err := decodeStrictJSONBody(rr, req, &body); err == nil {
			t.Fatal("expected unknown field error")
		}
	})

	t.Run("multiple json objects", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/password", strings.NewReader(`{"email":"a@b.com","password":"x"}{"email":"c@d.com","password":"y"}`))
		rr := httptest.NewRecorder()
		var body passwordBody
		if err := decodeStrictJSONBody(rr, req, &body); err == nil {
			t.Fatal("expected extra content error")
		}
	})
}

func TestAllowPasswordAttemptRateLimit(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	ip := "1.2.3.4"
	now := time.Now()

	for i := 0; i < passwordRateLimit; i++ {
		if !h.allowPasswordAttempt(ip, now) {
			t.Fatalf("attempt %d should have been allowed", i+1)
		}
	}
	if h.allowPasswordAttempt(ip, now) {
		t.Fatal("expected attempt over limit to be rejected")
	}
}

func TestAllowPasswordAttemptWindowExpires(t *testing.T) {
	h := NewHandler(config.Config{}, nil, nil)
	ip := "1.2.3.4"
	start := time.Now()

	for i := 0; i < passwordRateLimit; i++ {
		if !h.allowPasswordAttempt(ip, start) {
			t.Fatalf("attempt %d should have been allowed", i+1)
		}
	}
	if h.allowPasswordAttempt(ip, start) {
		t.Fatal("expected attempt over limit to be rejected")
	}
	if !h.allowPasswordAttempt(ip, start.Add(passwordRateWindow+time.Second)) {
		t.Fatal("expected new window to allow attempts again")
	}
}

func TestTokenJSONMapping(t *testing.T) {
	in := usermanagement.AuthenticateResponse{
		AccessToken:          "a",
		RefreshToken:         "r",
		OrganizationID:       "org-1",
		AuthenticationMethod: "password",
	}
	out := tokenJSON(in)
	if out.AccessToken != "a" || out.RefreshToken != "r" || out.TokenType != "Bearer" {
		t.Fatalf("unexpected token mapping: %#v", out)
	}
}

func TestWriteJSONSetsContentTypeAndStatus(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusCreated, map[string]string{"ok": "1"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("expected application/json content-type, got %q", ct)
	}
}

func TestLogoutPaths(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{})
	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/logout", nil)
	getRec := httptest.NewRecorder()
	h.Logout(getRec, getReq)
	if getRec.Code != http.StatusFound {
		t.Fatalf("expected redirect on GET logout, got %d", getRec.Code)
	}

	postReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	postRec := httptest.NewRecorder()
	h.Logout(postRec, postReq)
	if postRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on POST logout, got %d", postRec.Code)
	}
}

func TestMeUnauthorizedAndSuccessWithoutClient(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{claims: &AccessContextClaims{Subject: "user-1"}})
	noAuthReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	noAuthRec := httptest.NewRecorder()
	h.Me(noAuthRec, noAuthReq)
	if noAuthRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when no bearer token, got %d", noAuthRec.Code)
	}

	okReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	okReq.Header.Set("Authorization", "Bearer token")
	okRec := httptest.NewRecorder()
	h.Me(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid token, got %d", okRec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(okRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json body: %v", err)
	}
	if body["subject"] != "user-1" {
		t.Fatalf("unexpected subject: %#v", body["subject"])
	}
}

func TestMeInvalidToken(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{err: errors.New("bad token")})
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer bad")
	rec := httptest.NewRecorder()
	h.Me(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid token, got %d", rec.Code)
	}
}

func TestClientIPPrefersXForwardedFor(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8")
	if got := clientIP(req); got != "1.2.3.4" {
		t.Fatalf("unexpected client ip: %q", got)
	}
}

func TestNewOAuthState(t *testing.T) {
	s, err := newOAuthState()
	if err != nil {
		t.Fatalf("expected state generation success, got %v", err)
	}
	if len(s) < 40 {
		t.Fatalf("state too short: %q", s)
	}
}

func TestClearOAuthStateCookie(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{})
	rec := httptest.NewRecorder()
	h.clearOAuthStateCookie(rec)
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Name != oauthStateCookie || cookies[0].MaxAge != -1 {
		t.Fatalf("expected oauth state cookie clear, got %#v", cookies)
	}
}

func TestPostLoginRedirectURLWrapper(t *testing.T) {
	h := NewHandler(config.Config{PostLoginRedirect: "/dashboards"}, nil, stubValidator{})
	req := httptest.NewRequest(http.MethodGet, "https://example.com/api/auth/callback", nil)
	u, err := h.postLoginRedirectURL(req)
	if err != nil {
		t.Fatalf("expected redirect url, got %v", err)
	}
	if u.Path != "/dashboards" {
		t.Fatalf("unexpected path: %q", u.Path)
	}
}

func TestPasswordValidationBranches(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{})

	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/password", nil)
	getRec := httptest.NewRecorder()
	h.Password(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET, got %d", getRec.Code)
	}

	badReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader("{"))
	badRec := httptest.NewRecorder()
	h.Password(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad json, got %d", badRec.Code)
	}

	missingReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"email":"x"}`))
	missingRec := httptest.NewRecorder()
	h.Password(missingRec, missingReq)
	if missingRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing fields, got %d", missingRec.Code)
	}
}

func TestRefreshValidationBranches(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{})

	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/refresh", nil)
	getRec := httptest.NewRecorder()
	h.Refresh(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET, got %d", getRec.Code)
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
}

func TestCallbackErrorQueryBranch(t *testing.T) {
	h := NewHandler(config.Config{}, nil, stubValidator{})
	q := url.Values{}
	q.Set("error", "access_denied")
	q.Set("error_description", "denied")
	req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?"+q.Encode(), nil)
	rec := httptest.NewRecorder()
	h.Callback(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on callback error query, got %d", rec.Code)
	}
}

func TestWorkOSLoginAndCallbackAndPasswordAndRefresh(t *testing.T) {
	fakeURL, _ := url.Parse("https://auth.example.com/start")
	client := &fakeWorkOSClient{
		authURL: fakeURL,
		authCodeResp: usermanagement.AuthenticateResponse{
			AccessToken:          "access",
			RefreshToken:         "refresh",
			AuthenticationMethod: "password",
		},
		authPasswordResp: usermanagement.AuthenticateResponse{
			AccessToken:  "p-access",
			RefreshToken: "p-refresh",
		},
		authRefreshResp: usermanagement.RefreshAuthenticationResponse{
			AccessToken:  "r-access",
			RefreshToken: "r-refresh",
		},
	}
	h := NewHandlerWithClient(config.Config{WorkOSClientID: "client", AuthRedirectURI: "https://app/cb", PostLoginRedirect: "/"}, client, stubValidator{})

	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login?screen=sign-in", nil)
	loginRec := httptest.NewRecorder()
	h.Login(loginRec, loginReq)
	if loginRec.Code != http.StatusFound {
		t.Fatalf("expected login redirect, got %d", loginRec.Code)
	}
	if client.lastAuthURLOpts == nil || client.lastAuthURLOpts.ScreenHint != usermanagement.SignIn {
		t.Fatalf("expected sign-in screen hint to be passed")
	}

	cbReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=s1", nil)
	cbReq.Header.Set("Accept", "application/json")
	cbReq.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "s1"})
	cbRec := httptest.NewRecorder()
	h.Callback(cbRec, cbReq)
	if cbRec.Code != http.StatusOK {
		t.Fatalf("expected callback json success, got %d", cbRec.Code)
	}

	pwReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"email":"u@example.com","password":"pw"}`))
	pwRec := httptest.NewRecorder()
	h.Password(pwRec, pwReq)
	if pwRec.Code != http.StatusOK {
		t.Fatalf("expected password success, got %d", pwRec.Code)
	}

	refReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"t"}`))
	refRec := httptest.NewRecorder()
	h.Refresh(refRec, refReq)
	if refRec.Code != http.StatusOK {
		t.Fatalf("expected refresh success, got %d", refRec.Code)
	}
}

func TestWorkOSClientErrorBranches(t *testing.T) {
	baseCfg := config.Config{WorkOSClientID: "client", AuthRedirectURI: "https://app/cb"}

	loginErr := NewHandlerWithClient(baseCfg, &fakeWorkOSClient{authURLErr: errors.New("boom")}, stubValidator{})
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginRec := httptest.NewRecorder()
	loginErr.Login(loginRec, loginReq)
	if loginRec.Code != http.StatusInternalServerError {
		t.Fatalf("expected login 500 on auth url error, got %d", loginRec.Code)
	}

	cbErr := NewHandlerWithClient(baseCfg, &fakeWorkOSClient{authCodeErr: errors.New("boom")}, stubValidator{})
	cbReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=s1", nil)
	cbReq.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "s1"})
	cbRec := httptest.NewRecorder()
	cbErr.Callback(cbRec, cbReq)
	if cbRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected callback auth failure 401, got %d", cbRec.Code)
	}

	pwErr := NewHandlerWithClient(baseCfg, &fakeWorkOSClient{authPasswordErr: errors.New("bad")}, stubValidator{})
	pwReq := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(`{"email":"u@example.com","password":"pw"}`))
	pwRec := httptest.NewRecorder()
	pwErr.Password(pwRec, pwReq)
	if pwRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected password 401 on provider error, got %d", pwRec.Code)
	}

	refErr := NewHandlerWithClient(baseCfg, &fakeWorkOSClient{authRefreshErr: errors.New("bad")}, stubValidator{})
	refReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"t"}`))
	refRec := httptest.NewRecorder()
	refErr.Refresh(refRec, refReq)
	if refRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected refresh 401 on provider error, got %d", refRec.Code)
	}
}

func TestWorkOSMissingClientBranches(t *testing.T) {
	h := NewHandlerWithClient(config.Config{}, nil, stubValidator{})
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginRec := httptest.NewRecorder()
	h.Login(loginRec, loginReq)
	if loginRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 without auth client on login, got %d", loginRec.Code)
	}

	cbReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=x", nil)
	cbReq.URL.RawQuery = "code=x&state=s1"
	cbReq.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "s1"})
	cbRec := httptest.NewRecorder()
	h.Callback(cbRec, cbReq)
	if cbRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 without auth client on callback, got %d", cbRec.Code)
	}
}

func TestMeWithWorkOSClientBranches(t *testing.T) {
	validator := stubValidator{claims: &AccessContextClaims{Subject: "user-1"}}
	failClient := &fakeWorkOSClient{userErr: errors.New("not found")}
	hFail := NewHandlerWithClient(config.Config{}, failClient, validator)
	failReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	failReq.Header.Set("Authorization", "Bearer t")
	failRec := httptest.NewRecorder()
	hFail.Me(failRec, failReq)
	if failRec.Code != http.StatusBadGateway {
		t.Fatalf("expected me profile lookup failure 502, got %d", failRec.Code)
	}

	okClient := &fakeWorkOSClient{userResp: usermanagement.User{ID: "user-1"}}
	hOk := NewHandlerWithClient(config.Config{}, okClient, validator)
	okReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	okReq.Header.Set("Authorization", "Bearer t")
	okRec := httptest.NewRecorder()
	hOk.Me(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("expected me success 200, got %d", okRec.Code)
	}
}
