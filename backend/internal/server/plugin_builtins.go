package server

import (
	"net/http"

	"github.com/dafuq-framework/dafuq/backend/internal/api"
)

func defaultPlugins() []Plugin {
	return []Plugin{localMetricsPlugin{}}
}

// localMetricsPlugin serves sample data for demo widgets (plugin.local: "local-metrics").
type localMetricsPlugin struct{}

func (localMetricsPlugin) Name() string { return "local-metrics" }

func (localMetricsPlugin) Handler() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /sample-gauge", api.SampleGaugeValue)
	return m
}
