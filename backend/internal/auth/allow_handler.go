package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

// AllowHandler serves the in-process "allow" dev auth API (no external IdP). Tokens are
// HS256 JWTs that always pass [AllowValidator].
type AllowHandler struct {
	cfg config.Config
	v   *AllowValidator
}

// NewAllowHandler returns handlers for the allow plugin. Use the same
// *AllowValidator instance returned by [NewAllowValidator] for [TokenValidator] wiring.
func NewAllowHandler(cfg config.Config, v *AllowValidator) *AllowHandler {
	return &AllowHandler{cfg: cfg, v: v}
}

// Login immediately finishes sign-in: redirects to the post-login target with access and
// refresh tokens in the URL fragment (same shape as the WorkOS flow), or returns JSON
// if Accept: application/json.
func (a *AllowHandler) Login(w http.ResponseWriter, r *http.Request) {
	a.issueAndFinish(w, r, http.StatusOK)
}

// Callback issues tokens without an external code exchange; useful when the app expects
// a callback URL. Query params are ignored; GET only.
func (a *AllowHandler) Callback(w http.ResponseWriter, r *http.Request) {
	a.issueAndFinish(w, r, http.StatusOK)
}

func (a *AllowHandler) issueAndFinish(w http.ResponseWriter, r *http.Request, jsonStatus int) {
	at, err := a.v.IssueAccessToken()
	if err != nil {
		http.Error(w, "failed to issue access token", http.StatusInternalServerError)
		return
	}
	rt, err := a.v.IssueRefreshToken()
	if err != nil {
		http.Error(w, "failed to issue refresh token", http.StatusInternalServerError)
		return
	}
	body := AuthTokenJSON{AccessToken: at, RefreshToken: rt, TokenType: "Bearer", AuthenticationMethod: "allow-dev"}
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		writeJSON(w, jsonStatus, body)
		return
	}
	dest, err := PostLoginRedirectURL(a.cfg, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	frag := url.Values{}
	frag.Set("access_token", body.AccessToken)
	frag.Set("refresh_token", body.RefreshToken)
	frag.Set("token_type", body.TokenType)
	frag.Set("authentication_method", string(body.AuthenticationMethod))
	dest.Fragment = frag.Encode()
	http.Redirect(w, r, dest.String(), http.StatusFound)
}

// Password always succeeds in testing: empty body or any JSON object returns a token pair.
func (a *AllowHandler) Password(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAuthBodyBytes))
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}
	if len(bytes.TrimSpace(b)) > 0 && !json.Valid(b) {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	at, err := a.v.IssueAccessToken()
	if err != nil {
		http.Error(w, "issue access", http.StatusInternalServerError)
		return
	}
	rt, err := a.v.IssueRefreshToken()
	if err != nil {
		http.Error(w, "issue refresh", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, AuthTokenJSON{AccessToken: at, RefreshToken: rt, TokenType: "Bearer", AuthenticationMethod: "allow-dev"})
}

// Refresh issues new tokens; any well-formed allow refresh token is accepted.
func (a *AllowHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body refreshBody
	if err := decodeStrictJSONBody(w, r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	body.RefreshToken = strings.TrimSpace(body.RefreshToken)
	if body.RefreshToken == "" {
		http.Error(w, "refresh_token required", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := a.v.ValidateRefreshToken(ctx, body.RefreshToken); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_refresh_token"})
		return
	}
	at, err := a.v.IssueAccessToken()
	if err != nil {
		http.Error(w, "issue", http.StatusInternalServerError)
		return
	}
	rt, err := a.v.IssueRefreshToken()
	if err != nil {
		http.Error(w, "issue", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, AuthTokenJSON{AccessToken: at, RefreshToken: rt, TokenType: "Bearer", AuthenticationMethod: "allow-dev"})
}

// Logout matches the built-in API (POST JSON / GET redirect).
func (a *AllowHandler) Logout(w http.ResponseWriter, r *http.Request) {
	_ = a
	if r.Method == http.MethodGet {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// Me returns profile info when a valid allow access token is present.
func (a *AllowHandler) Me(w http.ResponseWriter, r *http.Request) {
	raw, ok := bearerToken(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return
	}
	claims, err := a.v.ValidateAccessToken(r.Context(), raw)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return
	}
	if claims.Subject == "" {
		http.Error(w, "invalid token subject", http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated":         true,
		"dev_allow":             true,
		"subject":               claims.Subject,
		"authentication_method": "allow-dev",
	})
}
