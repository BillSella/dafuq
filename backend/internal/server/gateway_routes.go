package server

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/dafuq-framework/dafuq/backend/internal/auth"
)

// RegisterAPIRoutes registers configured data gateway routes on mux (each is bearer-protected).
// maxProxyRequestBody caps the request body size forwarded to upstream proxy backends.
func RegisterAPIRoutes(mux *http.ServeMux, v auth.TokenValidator, routes []APIProxyRoute, plugins *PluginRegistry, maxProxyRequestBody int64) error {
	for _, route := range routes {
		route := route
		h, err := routeHandler(route, plugins, maxProxyRequestBody)
		if err != nil {
			return err
		}
		mux.Handle(route.ListenPath, auth.BearerAuth(v)(h))
	}
	return nil
}

func routeHandler(route APIProxyRoute, reg *PluginRegistry, maxProxyRequestBody int64) (http.Handler, error) {
	if route.Plugin != "" {
		if reg == nil {
			return nil, errors.New("plugin registry is required for plugin.local routes")
		}
		h, ok := reg.Handler(route.Plugin)
		if !ok {
			return nil, fmt.Errorf("unknown local plugin %q for route %q (register a plugin with that name, or add it via NewPluginRegistry or Register)", route.Plugin, route.ListenPath)
		}
		prefix := strings.TrimSuffix(route.ListenPath, "/")
		return http.StripPrefix(prefix, h), nil
	}
	return newFailoverProxy(route, maxProxyRequestBody), nil
}
