package server

// MuxOption configures [NewMux].
type MuxOption func(*muxConfig)

type muxConfig struct {
	plugins *PluginRegistry
}

// WithPluginRegistry uses a pre-built [PluginRegistry] (e.g. to add your own
// [Plugin] or call [PluginRegistry.Register] / [RegisterHandler] first).
// If you pass nil, it is ignored.
func WithPluginRegistry(r *PluginRegistry) MuxOption {
	return func(c *muxConfig) {
		if r != nil {
			c.plugins = r
		}
	}
}

func newMuxConfig(opts []MuxOption) *muxConfig {
	c := &muxConfig{}
	for _, o := range opts {
		if o != nil {
			o(c)
		}
	}
	return c
}
