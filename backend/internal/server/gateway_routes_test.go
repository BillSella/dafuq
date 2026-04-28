package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

type okTokenValidator struct{}

func (okTokenValidator) ValidateAccessToken(context.Context, string) (*auth.AccessContextClaims, error) {
	return &auth.AccessContextClaims{Subject: "user-1"}, nil
}

type errTokenValidator struct{}

func (errTokenValidator) ValidateAccessToken(context.Context, string) (*auth.AccessContextClaims, error) {
	return nil, errors.New("invalid")
}

func TestRegisterAPIRoutesWrapsWithBearerAuth(t *testing.T) {
	reg := NewPluginRegistry()
	reg.RegisterHandler("echo", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	mux := http.NewServeMux()
	routes := []APIProxyRoute{{ListenPath: "/api/local/echo/", Plugin: "echo"}}
	if err := RegisterAPIRoutes(mux, okTokenValidator{}, routes, reg, 1024); err != nil {
		t.Fatalf("register routes failed: %v", err)
	}

	reqNoAuth := httptest.NewRequest(http.MethodGet, "/api/local/echo/ping", nil)
	recNoAuth := httptest.NewRecorder()
	mux.ServeHTTP(recNoAuth, reqNoAuth)
	if recNoAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized without bearer token, got %d", recNoAuth.Code)
	}

	reqAuth := httptest.NewRequest(http.MethodGet, "/api/local/echo/ping", nil)
	reqAuth.Header.Set("Authorization", "Bearer token")
	recAuth := httptest.NewRecorder()
	mux.ServeHTTP(recAuth, reqAuth)
	if recAuth.Code != http.StatusNoContent {
		t.Fatalf("expected plugin handler status, got %d", recAuth.Code)
	}
}

func TestRegisterAPIRoutesRejectsUnknownPlugin(t *testing.T) {
	mux := http.NewServeMux()
	routes := []APIProxyRoute{{ListenPath: "/api/local/x/", Plugin: "missing-plugin"}}
	err := RegisterAPIRoutes(mux, errTokenValidator{}, routes, NewPluginRegistry(), 1024)
	if err == nil {
		t.Fatalf("expected unknown plugin error")
	}
}
