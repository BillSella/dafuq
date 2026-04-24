package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

const legacySessionCookie = "dafuq_session"
const oauthStateCookie = "dafuq_oauth_state"
const maxAuthBodyBytes int64 = 1 << 20 // 1 MiB
const passwordRateWindow = time.Minute
const passwordRateLimit = 10

// Handler wires WorkOS User Management (AuthKit), JWT access tokens, and refresh.
type Handler struct {
	cfg       config.Config
	client    *usermanagement.Client
	validator TokenValidator
	limiterMu sync.Mutex
	attempts  map[string][]time.Time
}

func NewHandler(cfg config.Config, client *usermanagement.Client, v TokenValidator) *Handler {
	return &Handler{
		cfg:       cfg,
		client:    client,
		validator: v,
		attempts:  map[string][]time.Time{},
	}
}

// AuthTokenJSON is returned by successful authentications (OAuth-style body).
type AuthTokenJSON struct {
	AccessToken          string `json:"access_token"`
	RefreshToken         string `json:"refresh_token"`
	TokenType            string `json:"token_type"`
	AuthenticationMethod string `json:"authentication_method,omitempty"`
	OrganizationID       string `json:"organization_id,omitempty"`
}

func tokenJSON(r usermanagement.AuthenticateResponse) AuthTokenJSON {
	return AuthTokenJSON{
		AccessToken:          r.AccessToken,
		RefreshToken:         r.RefreshToken,
		TokenType:            "Bearer",
		AuthenticationMethod: string(r.AuthenticationMethod),
		OrganizationID:       r.OrganizationID,
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Login redirects the browser to WorkOS AuthKit (built-in user management).
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	state, err := newOAuthState()
	if err != nil {
		http.Error(w, "failed to generate oauth state", http.StatusInternalServerError)
		return
	}
	h.setOAuthStateCookie(w, state)

	opts := usermanagement.GetAuthorizationURLOpts{
		ClientID:    h.cfg.WorkOSClientID,
		RedirectURI: h.cfg.AuthRedirectURI,
		Provider:    "authkit",
		State:       state,
	}
	if hint := strings.TrimSpace(r.URL.Query().Get("screen")); hint != "" {
		switch hint {
		case "sign-up":
			opts.ScreenHint = usermanagement.SignUp
		case "sign-in":
			opts.ScreenHint = usermanagement.SignIn
		}
	}
	u, err := h.client.GetAuthorizationURL(opts)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, u.String(), http.StatusFound)
}

// Callback completes the OAuth code flow after AuthKit redirects back.
// It returns JSON when Accept prefers application/json; otherwise redirects to DAFUQ_POST_LOGIN_REDIRECT
// with access and refresh tokens in the URL fragment (SPA reads client-side; not sent to servers).
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	if errMsg := strings.TrimSpace(r.URL.Query().Get("error")); errMsg != "" {
		desc := strings.TrimSpace(r.URL.Query().Get("error_description"))
		log.Printf("auth callback error: %s %s", errMsg, desc)
		http.Error(w, errMsg+": "+desc, http.StatusBadRequest)
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}
	if err := h.validateOAuthState(r); err != nil {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}
	h.clearOAuthStateCookie(w)
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	resp, err := h.client.AuthenticateWithCode(ctx, usermanagement.AuthenticateWithCodeOpts{
		ClientID:  h.cfg.WorkOSClientID,
		Code:      code,
		IPAddress: clientIP(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		log.Printf("AuthenticateWithCode: %v", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}
	body := tokenJSON(resp)
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		writeJSON(w, http.StatusOK, body)
		return
	}
	dest, err := h.postLoginRedirectURL(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	frag := url.Values{}
	frag.Set("access_token", body.AccessToken)
	frag.Set("refresh_token", body.RefreshToken)
	frag.Set("token_type", body.TokenType)
	if body.AuthenticationMethod != "" {
		frag.Set("authentication_method", body.AuthenticationMethod)
	}
	if body.OrganizationID != "" {
		frag.Set("organization_id", body.OrganizationID)
	}
	dest.Fragment = frag.Encode()
	http.Redirect(w, r, dest.String(), http.StatusFound)
}

func (h *Handler) postLoginRedirectURL(r *http.Request) (*url.URL, error) {
	return PostLoginRedirectURL(h.cfg, r)
}

type passwordBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Password authenticates with email/password via WorkOS User Management API and returns JWTs.
func (h *Handler) Password(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.allowPasswordAttempt(clientIP(r), time.Now()) {
		http.Error(w, "too many authentication attempts", http.StatusTooManyRequests)
		return
	}
	var body passwordBody
	if err := decodeStrictJSONBody(w, r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || body.Password == "" {
		http.Error(w, "email and password required", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	resp, err := h.client.AuthenticateWithPassword(ctx, usermanagement.AuthenticateWithPasswordOpts{
		ClientID:  h.cfg.WorkOSClientID,
		Email:     body.Email,
		Password:  body.Password,
		IPAddress: clientIP(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		log.Printf("AuthenticateWithPassword: %v", err)
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, tokenJSON(resp))
}

type refreshBody struct {
	RefreshToken   string `json:"refresh_token"`
	OrganizationID string `json:"organization_id,omitempty"`
}

// Refresh exchanges a refresh token for new access and refresh tokens.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
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
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	resp, err := h.client.AuthenticateWithRefreshToken(ctx, usermanagement.AuthenticateWithRefreshTokenOpts{
		ClientID:       h.cfg.WorkOSClientID,
		RefreshToken:   body.RefreshToken,
		OrganizationID: body.OrganizationID,
		IPAddress:      clientIP(r),
		UserAgent:      r.UserAgent(),
	})
	if err != nil {
		log.Printf("AuthenticateWithRefreshToken: %v", err)
		http.Error(w, "refresh failed", http.StatusUnauthorized)
		return
	}
	// Refresh response type differs — map to same JSON shape as authenticate.
	out := AuthTokenJSON{
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		TokenType:    "Bearer",
	}
	writeJSON(w, http.StatusOK, out)
}

// Logout clears legacy session cookies and finishes API logout (client must discard tokens).
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	h.clearLegacySessionCookie(w)
	if r.Method == http.MethodGet {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) clearLegacySessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     legacySessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cfg.CookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) setOAuthStateCookie(w http.ResponseWriter, state string) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/api/auth/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   h.cfg.CookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) clearOAuthStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/api/auth/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cfg.CookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) validateOAuthState(r *http.Request) error {
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if state == "" {
		return errors.New("missing state")
	}
	c, err := r.Cookie(oauthStateCookie)
	if err != nil {
		return err
	}
	if strings.TrimSpace(c.Value) != state {
		return errors.New("state mismatch")
	}
	return nil
}

// Me returns the user profile when a valid access token is supplied.
// When WorkOS User Management is configured, it returns the full WorkOS user.
// For proxied / OIDC-only mode (no user API), it returns a minimal subject-only payload.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	raw, ok := bearerToken(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return
	}
	claims, err := h.validator.ValidateAccessToken(r.Context(), raw)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return
	}
	if claims.Subject == "" {
		http.Error(w, "invalid token subject", http.StatusUnauthorized)
		return
	}
	if h.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": true,
			"subject":       claims.Subject,
		})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	user, err := h.client.GetUser(ctx, usermanagement.GetUserOpts{User: claims.Subject})
	if err != nil {
		log.Printf("GetUser: %v", err)
		http.Error(w, "profile lookup failed", http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"user":          user,
	})
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func newOAuthState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func decodeStrictJSONBody(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	// Ensure only one JSON value is present.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("extra json content")
	}
	return nil
}

func (h *Handler) allowPasswordAttempt(ip string, now time.Time) bool {
	if ip == "" {
		return true
	}
	cutoff := now.Add(-passwordRateWindow)
	h.limiterMu.Lock()
	defer h.limiterMu.Unlock()

	h.pruneLocked(cutoff)
	window := h.attempts[ip]
	if len(window) >= passwordRateLimit {
		return false
	}
	h.attempts[ip] = append(window, now)
	return true
}

func (h *Handler) pruneLocked(cutoff time.Time) {
	for ip, window := range h.attempts {
		n := 0
		for _, ts := range window {
			if ts.After(cutoff) {
				window[n] = ts
				n++
			}
		}
		if n == 0 {
			delete(h.attempts, ip)
			continue
		}
		h.attempts[ip] = window[:n]
	}
}
