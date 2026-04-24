package server

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// LoadGatewayConfig loads optional auth and API gateway routes. An empty file path
// yields the default in-process WorkOS auth at /api/auth/ and no extra data routes.
func LoadGatewayConfig(path string) (auth *APIProxyRoute, routes []APIProxyRoute, err error) {
	path = strings.TrimSpace(path)
	if path == "" {
		auth = defaultAuthRoute()
		if err := normalizeRoute(auth); err != nil {
			return nil, nil, err
		}
		return auth, nil, nil
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
	var a *APIProxyRoute
	if isJSONEmptyOrNull(f.Auth) {
		a = defaultAuthRoute()
	} else {
		a, err = parseGatewayAuthMessage(f.Auth)
		if err != nil {
			return nil, nil, fmt.Errorf("auth: %w", err)
		}
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

func defaultAuthRoute() *APIProxyRoute {
	return &APIProxyRoute{
		ListenPath: "/api/auth",
		Plugin:     "workos",
	}
}
