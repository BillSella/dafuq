package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func TestNewTokenValidatorInvalidDriver(t *testing.T) {
	_, err := newTokenValidator(context.Background(), config.Config{}, config.AuthDriver("bad"), nil)
	if err == nil {
		t.Fatalf("expected error for invalid auth driver")
	}
}

func TestNewTokenValidatorAllowDriver(t *testing.T) {
	tv, err := newTokenValidator(
		context.Background(),
		config.Config{AllowJWTSecret: "secret", AllowSubject: "user"},
		config.AuthAllowPlugin,
		nil,
	)
	if err != nil {
		t.Fatalf("expected allow validator creation, got %v", err)
	}
	if tv == nil {
		t.Fatalf("expected non-nil token validator")
	}
}

func TestRegisterAuthRoutesErrorsWithoutHandler(t *testing.T) {
	mux := http.NewServeMux()
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "workos"}, nil, nil, nil, 1024); err == nil {
		t.Fatalf("expected error for missing workos handler")
	}
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "allow"}, nil, nil, nil, 1024); err == nil {
		t.Fatalf("expected error for missing allow handler")
	}
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "pam"}, nil, nil, nil, 1024); err == nil {
		t.Fatalf("expected error for missing pam handler")
	}
}

func TestRegisterAuthRoutesAllowWiresEndpoints(t *testing.T) {
	v, err := auth.NewAllowValidator(config.Config{AllowJWTSecret: "secret", AllowSubject: "user"})
	if err != nil {
		t.Fatalf("validator create failed: %v", err)
	}
	allow := auth.NewAllowHandler(config.Config{PostLoginRedirect: "/"}, v)
	mux := http.NewServeMux()
	route := &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "allow"}
	if err := registerAuthRoutes(mux, route, nil, allow, nil, 1024); err != nil {
		t.Fatalf("register auth routes failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	req.Header.Set("Accept", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected allow login route to be wired, got %d", rec.Code)
	}
}
