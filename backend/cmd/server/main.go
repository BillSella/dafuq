package main

import (
	"context"
	"crypto/tls"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"

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

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           h,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		if cfg.UseTLS() {
			srv.TLSConfig = &tls.Config{
				MinVersion: tls.VersionTLS12,
			}
			log.Printf("listening https on %s (static %s)", cfg.Addr, cfg.StaticDir)
			errCh <- srv.ListenAndServeTLS(cfg.TLSCertFile, cfg.TLSKeyFile)
			return
		}
		log.Printf("listening http on %s (static %s); set DAFUQ_TLS_CERT_FILE and DAFUQ_TLS_KEY_FILE for HTTPS", cfg.Addr, cfg.StaticDir)
		errCh <- srv.ListenAndServe()
	}()

	sigCh := make(chan os.Signal, 1)
	if runtime.GOOS == "windows" {
		signal.Notify(sigCh, os.Interrupt)
	} else {
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	}

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
		return
	case <-sigCh:
	}

	log.Print("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	<-errCh
	log.Print("server stopped")
}
