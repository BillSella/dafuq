package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// gatewayFileRaw is the top-level shape for api-proxy config JSON.
type gatewayFileRaw struct {
	Auth   json.RawMessage   `json:"auth"`
	Routes []json.RawMessage `json:"routes"`
}

func parseGatewayAuthMessage(raw json.RawMessage) (*APIProxyRoute, error) {
	if isJSONEmptyOrNull(raw) {
		return defaultAuthRoute(), nil
	}
	return parseRouteObject(raw)
}

func parseDataRouteMessage(raw json.RawMessage) (*APIProxyRoute, error) {
	if isJSONEmptyOrNull(raw) {
		return nil, fmt.Errorf("empty route")
	}
	return parseRouteObject(raw)
}

func isJSONEmptyOrNull(b []byte) bool {
	if len(b) == 0 {
		return true
	}
	return strings.EqualFold(string(bytes.TrimSpace(b)), "null")
}

func parseRouteObject(raw json.RawMessage) (*APIProxyRoute, error) {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return routeFromMap(m)
}

func routeFromMap(m map[string]json.RawMessage) (*APIProxyRoute, error) {
	r := &APIProxyRoute{}

	path, err := firstStringField(m, "listen", "endpoint", "listen_path")
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, fmt.Errorf("listen is required (alias: endpoint, listen_path)")
	}
	r.ListenPath = path

	pluginKey, hasPlugin := m["plugin"]
	if hasPlugin && !isJSONEmptyOrNull(pluginKey) {
		if err := applyPluginField(r, pluginKey); err != nil {
			return nil, err
		}
	}

	// Legacy: no plugin object, only backends
	if r.Plugin == "" && len(r.Backends) == 0 {
		if b, ok := m["backends"]; ok {
			_ = json.Unmarshal(b, &r.Backends)
		}
	}

	if r.Plugin != "" && len(r.Backends) > 0 {
		return nil, fmt.Errorf("a route cannot combine plugin.local and plugin.proxy (or legacy backends)")
	}
	if r.Plugin == "" && len(r.Backends) == 0 {
		return nil, fmt.Errorf("plugin (local, proxy) or legacy backends is required")
	}
	return r, nil
}

func applyPluginField(r *APIProxyRoute, raw json.RawMessage) error {
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		asString = strings.TrimSpace(asString)
		if asString == "" {
			return fmt.Errorf("plugin string is empty")
		}
		r.Plugin = asString
		return nil
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(raw, &obj); err != nil {
		return err
	}
	_, hasLocal := obj["local"]
	_, hasProxy := obj["proxy"]
	if hasLocal && hasProxy {
		return fmt.Errorf("plugin cannot specify both local and proxy")
	}
	if hasLocal {
		s, err := readJSONStringKey(obj, "local")
		if err != nil {
			return err
		}
		if s == "" {
			return fmt.Errorf("plugin.local is empty")
		}
		r.Plugin = s
		return nil
	}
	if hasProxy {
		return applyProxyField(r, obj["proxy"])
	}
	return fmt.Errorf("plugin object must have local or proxy")
}

func applyProxyField(r *APIProxyRoute, proxyRaw []byte) error {
	if isJSONEmptyOrNull(proxyRaw) {
		return fmt.Errorf("plugin.proxy is empty")
	}
	var list []string
	if err := json.Unmarshal(proxyRaw, &list); err != nil {
		return fmt.Errorf("plugin.proxy must be a non-empty list of full base URLs (scheme, host, optional path): %w", err)
	}
	if len(list) == 0 {
		return fmt.Errorf("plugin.proxy list is empty")
	}
	r.Backends = list
	return nil
}

func firstStringField(m map[string]json.RawMessage, keys ...string) (string, error) {
	for _, k := range keys {
		v, ok := m[k]
		if !ok || isJSONEmptyOrNull(v) {
			continue
		}
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			return "", fmt.Errorf("%q: %w", k, err)
		}
		s = strings.TrimSpace(s)
		if s != "" {
			return s, nil
		}
	}
	return "", nil
}

func readJSONStringKey(obj map[string]json.RawMessage, key string) (string, error) {
	b, ok := obj[key]
	if !ok {
		return "", fmt.Errorf("missing %q", key)
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return "", err
	}
	return strings.TrimSpace(s), nil
}
