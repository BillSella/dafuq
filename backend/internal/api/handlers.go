package api

import (
	"encoding/json"
	"math"
	"net/http"
	"time"
)

func Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// SampleGaugeValue returns a JSON body suitable for gauge widgets using field "value".
func SampleGaugeValue(w http.ResponseWriter, _ *http.Request) {
	t := float64(time.Now().Unix() % 120)
	v := 40 + 20*math.Sin(t/12)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"value": v})
}
