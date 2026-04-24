package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

// ErrAPIProxyConfigPathRequired is returned when the gateway config path is empty (before opening the file).
// The file must include a top-level "auth" object (see api-proxy-routes.example.json).
var ErrAPIProxyConfigPathRequired = errors.New(`api proxy: gateway config file path is empty (use -c / --conf; default /etc/dafuq/dafuq.json; see api-proxy-routes.example.json)`)

// LoadGatewayConfig loads auth and optional data gateway routes from a JSON file.
// The file path must be set and non-empty, and the file must include an explicit
// "auth" object (not null and not omitted).
func LoadGatewayConfig(path string) (auth *APIProxyRoute, routes []APIProxyRoute, err error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, nil, ErrAPIProxyConfigPathRequired
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	return parseGatewayFile(b)
}

func parseGatewayFile(b []byte) (auth *APIProxyRoute, routes []APIProxyRoute, err error) {
	var f gatewayFileRaw
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, nil, err
	}
	if isJSONEmptyOrNull(f.Auth) {
		return nil, nil, fmt.Errorf(`api proxy: top-level "auth" is required and must not be null or empty (see api-proxy-routes.example.json)`)
	}
	a, err := parseGatewayAuthMessage(f.Auth)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: %w", err)
	}
	if err := normalizeRoute(a); err != nil {
		return nil, nil, fmt.Errorf("auth: %w", err)
	}
	for i, row := range f.Routes {
		if isJSONEmptyOrNull(row) {
			continue
		}
		route, err := parseDataRouteMessage(row)
		if err != nil {
			return nil, nil, fmt.Errorf("route %d: %w", i, err)
		}
		if err := normalizeRoute(route); err != nil {
			return nil, nil, fmt.Errorf("route %d: %w", i, err)
		}
		routes = append(routes, *route)
	}
	return a, routes, nil
}
