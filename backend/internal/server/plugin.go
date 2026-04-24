package server

import (
	"net/http"
	"strings"
)

// Plugin is an in-process implementation referenced from the JSON gateway
// ("plugin": { "local": "<name>" }). Names are matched case-insensitively; prefer
// stable lowercase names in config (e.g. "local-metrics").
//
// The returned Handler receives requests with paths under the listen prefix stripped;
// e.g. for /api/metrics/ your handler should register GET /subpath, not the full URL.
type Plugin interface {
	Name() string
	Handler() http.Handler
}

// PluginRegistry holds in-process [Plugin] instances by (lowercased) name. It is
// read-only for routing once [NewMux] has returned; register plugins before that.
type PluginRegistry struct {
	byName map[string]http.Handler
}

// NewPluginRegistry returns the default built-in plugins, then registers each extra.
// Extras with the same name as a built-in override the built-in.
func NewPluginRegistry(extras ...Plugin) *PluginRegistry {
	r := &PluginRegistry{byName: make(map[string]http.Handler)}
	for _, p := range defaultPlugins() {
		r.add(p)
	}
	for _, p := range extras {
		r.add(p)
	}
	return r
}

// Register adds or replaces a plugin. Call from init() or app startup before [NewMux].
func (r *PluginRegistry) Register(p Plugin) {
	if r == nil || p == nil {
		return
	}
	r.add(p)
}

// RegisterHandler registers a [http.Handler] under name. Same lifecycle as [Register].
func (r *PluginRegistry) RegisterHandler(name string, h http.Handler) {
	if h == nil {
		return
	}
	r.Register(namedHandler{name: name, h: h})
}

// Handler returns a registered in-process plugin by name, case-insensitively.
func (r *PluginRegistry) Handler(name string) (http.Handler, bool) {
	if r == nil {
		return nil, false
	}
	n := strings.ToLower(strings.TrimSpace(name))
	if n == "" {
		return nil, false
	}
	h, ok := r.byName[n]
	return h, ok
}

func (r *PluginRegistry) add(p Plugin) {
	n := strings.TrimSpace(p.Name())
	if n == "" {
		return
	}
	if r.byName == nil {
		r.byName = make(map[string]http.Handler)
	}
	r.byName[strings.ToLower(n)] = p.Handler()
}

type namedHandler struct {
	name string
	h    http.Handler
}

func (n namedHandler) Name() string          { return n.name }
func (n namedHandler) Handler() http.Handler { return n.h }
