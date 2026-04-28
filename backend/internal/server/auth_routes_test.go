package server

import (
	"context"
	"io"
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

func TestNewTokenValidatorPAMDriver(t *testing.T) {
	tv, err := newTokenValidator(
		context.Background(),
		config.Config{PAMJWTSecret: "pam-secret"},
		config.AuthPAMPlugin,
		nil,
	)
	if err != nil {
		t.Fatalf("expected pam validator creation, got %v", err)
	}
	if tv == nil {
		t.Fatalf("expected non-nil token validator")
	}
}

func TestNewTokenValidatorProxyDriverRequiresOIDCConfig(t *testing.T) {
	_, err := newTokenValidator(context.Background(), config.Config{}, config.AuthProxyOrOIDC, nil)
	if err == nil {
		t.Fatalf("expected oidc validator creation error for missing config")
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

func TestRegisterAuthRoutesRejectsInvalidCombinations(t *testing.T) {
	mux := http.NewServeMux()
	if err := registerAuthRoutes(
		mux,
		&APIProxyRoute{ListenPath: "/api/auth/", Plugin: "weird"},
		nil, nil, nil, 1024,
	); err == nil {
		t.Fatalf("expected error for unknown auth mode with no backends")
	}

	if err := registerAuthRoutes(
		mux,
		&APIProxyRoute{ListenPath: "/api/auth/", Plugin: "allow", Backends: []string{"https://example.com"}},
		nil, nil, nil, 1024,
	); err == nil {
		t.Fatalf("expected error for plugin and backends combination")
	}
}

func TestRegisterAuthRoutesEmptyListenPathFails(t *testing.T) {
	mux := http.NewServeMux()
	workos := auth.NewHandler(config.Config{}, nil, nil)
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "   ", Plugin: "workos"}, workos, nil, nil, 1024); err == nil {
		t.Fatalf("expected empty workos listen path error")
	}

	av, err := auth.NewAllowValidator(config.Config{AllowJWTSecret: "secret", AllowSubject: "user"})
	if err != nil {
		t.Fatal(err)
	}
	allow := auth.NewAllowHandler(config.Config{}, av)
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: " ", Plugin: "allow"}, nil, allow, nil, 1024); err == nil {
		t.Fatalf("expected empty allow listen path error")
	}

	pv, err := auth.NewPAMValidator(config.Config{PAMJWTSecret: "pam-secret"})
	if err != nil {
		t.Fatal(err)
	}
	pam := auth.NewPAMHandler(config.Config{}, pv)
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "", Plugin: "pam"}, nil, nil, pam, 1024); err == nil {
		t.Fatalf("expected empty pam listen path error")
	}
}

func TestRegisterAuthRoutesWorkOSAndPAMWiring(t *testing.T) {
	mux := http.NewServeMux()
	workos := auth.NewHandler(config.Config{}, nil, nil)
	if err := registerAuthRoutes(mux, &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "workos"}, workos, nil, nil, 1024); err != nil {
		t.Fatalf("expected workos routes to register, got %v", err)
	}
	// WorkOS handler with nil client returns 503, which still confirms route wiring.
	wReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	wRec := httptest.NewRecorder()
	mux.ServeHTTP(wRec, wReq)
	if wRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected wired workos login handler status, got %d", wRec.Code)
	}

	pv, err := auth.NewPAMValidator(config.Config{PAMJWTSecret: "pam-secret"})
	if err != nil {
		t.Fatal(err)
	}
	pam := auth.NewPAMHandler(config.Config{}, pv)
	mux2 := http.NewServeMux()
	if err := registerAuthRoutes(mux2, &APIProxyRoute{ListenPath: "/api/auth/", Plugin: "pam"}, nil, nil, pam, 1024); err != nil {
		t.Fatalf("expected pam routes to register, got %v", err)
	}
	pReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	pReq.Header.Set("Accept", "application/json")
	pRec := httptest.NewRecorder()
	mux2.ServeHTTP(pRec, pReq)
	if pRec.Code != http.StatusOK {
		t.Fatalf("expected wired pam login handler status, got %d", pRec.Code)
	}
}

func TestRegisterAuthRoutesProxyMode(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, "proxied")
	}))
	defer backend.Close()

	mux := http.NewServeMux()
	route := &APIProxyRoute{
		ListenPath: "/api/auth/",
		Backends:   []string{backend.URL + "/v1"},
	}
	if err := registerAuthRoutes(mux, route, nil, nil, nil, 1024); err != nil {
		t.Fatalf("expected proxy auth route registration success, got %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected proxied response status, got %d", rec.Code)
	}
}
