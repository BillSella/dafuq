package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

// PAMHandler provides auth HTTP APIs backed by the host PAM stack (after successful
// password check, it issues the same style of HS256 JWTs as the allow plugin, with
// per-user subject claims).
type PAMHandler struct {
	cfg config.Config
	v   *PAMValidator
}

// NewPAMHandler wires PAM-based routes. v must be the same instance used for [TokenValidator].
func NewPAMHandler(cfg config.Config, v *PAMValidator) *PAMHandler {
	return &PAMHandler{cfg: cfg, v: v}
}

// Login for PAM does not issue a token without a password; it hints clients to use POST /password.
func (h *PAMHandler) Login(w http.ResponseWriter, r *http.Request) {
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		writeJSON(w, http.StatusOK, map[string]any{
			"auth":    "pam",
			"message": "PAM: authenticate with POST /password using JSON { \"user\" or \"email\", \"password\" }",
		})
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	http.Error(w, "PAM: use POST /password with your Linux username and password (Accept: application/json for details)", http.StatusBadRequest)
}

// Callback is not used for PAM (no external OAuth). Returns 400.
func (h *PAMHandler) Callback(w http.ResponseWriter, r *http.Request) {
	_, _ = r, h
	http.Error(w, "PAM auth does not use an OAuth callback; use POST /password", http.StatusBadRequest)
}

// Password authenticates the Linux user with PAM and returns access/refresh tokens.
func (h *PAMHandler) Password(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		User     string `json:"user"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeStrictJSONBody(w, r, &body); err != nil {
		http.Error(w, "invalid json (need user or email, and password)", http.StatusBadRequest)
		return
	}
	user := strings.TrimSpace(body.User)
	if user == "" {
		user = strings.TrimSpace(body.Email)
	}
	pass := body.Password
	if user == "" || pass == "" {
		http.Error(w, "user (or email) and password required", http.StatusBadRequest)
		return
	}
	if err := pamAuth(h.pamService(), user, pass); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_credentials"})
		return
	}
	at, err := h.v.IssueAccessTokenForSubject(user)
	if err != nil {
		http.Error(w, "issue access", http.StatusInternalServerError)
		return
	}
	rt, err := h.v.IssueRefreshTokenForSubject(user)
	if err != nil {
		http.Error(w, "issue refresh", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, AuthTokenJSON{
		AccessToken:          at,
		RefreshToken:         rt,
		TokenType:            "Bearer",
		AuthenticationMethod: "pam",
	})
}

// Refresh re-issues token pairs; refresh JWT must be valid.
func (h *PAMHandler) Refresh(w http.ResponseWriter, r *http.Request) {
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
	sub, err := h.v.ValidateRefreshToken(ctx, body.RefreshToken)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_refresh_token"})
		return
	}
	at, err := h.v.IssueAccessTokenForSubject(sub)
	if err != nil {
		http.Error(w, "issue", http.StatusInternalServerError)
		return
	}
	rt, err := h.v.IssueRefreshTokenForSubject(sub)
	if err != nil {
		http.Error(w, "issue", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, AuthTokenJSON{
		AccessToken:          at,
		RefreshToken:         rt,
		TokenType:            "Bearer",
		AuthenticationMethod: "pam",
	})
}

// Logout matches the public auth API.
func (h *PAMHandler) Logout(w http.ResponseWriter, r *http.Request) {
	_ = h
	if r.Method == http.MethodGet {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// Me returns the PAM user subject from the bearer access token.
func (h *PAMHandler) Me(w http.ResponseWriter, r *http.Request) {
	raw, ok := bearerToken(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return
	}
	claims, err := h.v.ValidateAccessToken(r.Context(), raw)
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
		"subject":               claims.Subject,
		"authentication_method": "pam",
	})
}

func (h *PAMHandler) pamService() string {
	s := strings.TrimSpace(h.cfg.PAMService)
	if s == "" {
		return "login"
	}
	return s
}
