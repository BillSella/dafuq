package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	Health(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response json: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status=ok, got %#v", body["status"])
	}
}

func TestSampleGaugeValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/sample-gauge", nil)
	rec := httptest.NewRecorder()

	SampleGaugeValue(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response json: %v", err)
	}
	if _, ok := body["value"]; !ok {
		t.Fatalf("expected response to include value field")
	}
}
