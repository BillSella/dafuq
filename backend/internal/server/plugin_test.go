package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

type helloPlugin struct{}

func (helloPlugin) Name() string { return "hello" }
func (helloPlugin) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("hello"))
	})
}

func TestPluginRegistryExtraOverridesBuiltin(t *testing.T) {
	reg := NewPluginRegistry(helloPlugin{})
	if _, ok := reg.Handler("hello"); !ok {
		t.Fatal("expected hello")
	}
	if _, ok := reg.Handler("local-metrics"); !ok {
		t.Fatal("expected built-in to remain")
	}
}

type overrideLocalMetrics struct{}

func (overrideLocalMetrics) Name() string { return "local-metrics" }
func (overrideLocalMetrics) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
}

func TestPluginRegistryExtraOverridesSameNameAsBuiltin(t *testing.T) {
	reg := NewPluginRegistry(overrideLocalMetrics{})
	h, ok := reg.Handler("local-metrics")
	if !ok {
		t.Fatal("expected plugin")
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/sample-gauge", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("override should win, got %d", rr.Code)
	}
}

func TestPluginRegistryHandlerCaseInsensitive(t *testing.T) {
	reg := NewPluginRegistry()
	_, ok := reg.Handler("LOCAL-Metrics")
	if !ok {
		t.Fatal("expected case-insensitive match")
	}
}

func TestRegisterHandler(t *testing.T) {
	reg := NewPluginRegistry()
	reg.RegisterHandler("x", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	h, ok := reg.Handler("X")
	if !ok {
		t.Fatal("expected x")
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/z", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestWithPluginRegistryNilIgnored(t *testing.T) {
	mc := newMuxConfig([]MuxOption{WithPluginRegistry(nil)})
	if mc.plugins != nil {
		t.Fatalf("nil registry should be ignored, got %#v", mc.plugins)
	}
}
