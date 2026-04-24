package config

import "testing"

func TestApplyDefaultListenAddress(t *testing.T) {
	t.Run("http", func(t *testing.T) {
		cfg := &Config{}
		ApplyDefaultListenAddress(cfg)
		if cfg.Addr != ":8080" {
			t.Fatalf("addr: %q", cfg.Addr)
		}
	})
	t.Run("https", func(t *testing.T) {
		cfg := &Config{TLSCertFile: "a.pem", TLSKeyFile: "b.key"}
		ApplyDefaultListenAddress(cfg)
		if cfg.Addr != ":8443" {
			t.Fatalf("addr: %q", cfg.Addr)
		}
	})
	t.Run("explicit preserved", func(t *testing.T) {
		cfg := &Config{Addr: ":9999", TLSCertFile: "a.pem", TLSKeyFile: "b.key"}
		ApplyDefaultListenAddress(cfg)
		if cfg.Addr != ":9999" {
			t.Fatalf("addr: %q", cfg.Addr)
		}
	})
}
