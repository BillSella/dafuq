package main

import (
	"log"
	"net/http"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/dafuq-framework/dafuq/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	h, err := server.NewMux(cfg)
	if err != nil {
		log.Fatalf("server: %v", err)
	}
	if cfg.UseTLS() {
		log.Printf("listening https on %s (static %s)", cfg.Addr, cfg.StaticDir)
		log.Fatal(http.ListenAndServeTLS(cfg.Addr, cfg.TLSCertFile, cfg.TLSKeyFile, h))
	}
	log.Printf("listening http on %s (static %s); set DAFUQ_TLS_CERT_FILE and DAFUQ_TLS_KEY_FILE for HTTPS", cfg.Addr, cfg.StaticDir)
	log.Fatal(http.ListenAndServe(cfg.Addr, h))
}
