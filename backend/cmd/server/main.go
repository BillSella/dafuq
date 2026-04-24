package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/dafuq-framework/dafuq/backend/internal/server"
	"github.com/spf13/pflag"
)

// version is set at build time, e.g. -ldflags "-X main.version=1.0.0"
var version = "0.0.0-dev"

func main() {
	prog := filepath.Base(os.Args[0])
	fs := pflag.NewFlagSet(prog, pflag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	confPath := fs.StringP("conf", "c", config.DefaultConfigFilePath, `gateway JSON (top-level "auth" and optional "routes"); see api-proxy-routes.example.json`)
	addr := fs.StringP("addr", "a", "", "HTTP(S) listen address; default :8080, or :8443 when --tls-cert and --tls-key are set")
	staticDir := fs.String("static-dir", config.DefaultStaticDir, "directory of the built SPA (Vite dist)")
	tlsCert := fs.String("tls-cert", "", "TLS certificate file (set together with --tls-key)")
	tlsKey := fs.String("tls-key", "", "TLS private key file (set together with --tls-cert)")
	dashboardDataDir := fs.String("dashboard-data-dir", config.DefaultDashboardDataDir, "directory for per-user dashboard JSON files")
	cookieSecure := fs.String("cookie-secure", "", "Set-Cookie Secure attribute: true, false, or omit (omit => true when using TLS, false for plain HTTP)")
	help := fs.BoolP("help", "h", false, "show this help and exit")
	ver := fs.BoolP("version", "v", false, "print version and exit")
	insecure := fs.Bool("insecure", false, `required to enable the dev-only auth plugin "allow" (never in production with real data)`)
	fs.Usage = func() { usage(prog, fs) }
	if err := fs.Parse(os.Args[1:]); err != nil {
		if err == pflag.ErrHelp {
			usage(prog, fs)
			os.Exit(0)
		}
		os.Exit(2)
	}
	if *help {
		usage(prog, fs)
		os.Exit(0)
	}
	if *ver {
		fmt.Println(version)
		os.Exit(0)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	cFlag := fs.Lookup("conf")
	cfg.APIProxyConfigFile = config.ResolveConfigFilePath(*confPath, cFlag.Changed)
	cfg.AllowInsecureAuth = *insecure
	if strings.TrimSpace(cfg.APIProxyConfigFile) == "" {
		log.Fatalf("config: empty gateway file path; use a non-empty -c / --conf (default %s)", config.DefaultConfigFilePath)
	}
	cfg.TLSCertFile = strings.TrimSpace(*tlsCert)
	cfg.TLSKeyFile = strings.TrimSpace(*tlsKey)
	oneTLS := (cfg.TLSCertFile != "") != (cfg.TLSKeyFile != "")
	if oneTLS {
		log.Fatal("config: set both --tls-cert and --tls-key for HTTPS, or neither for HTTP")
	}
	if a := fs.Lookup("addr"); a.Changed {
		cfg.Addr = strings.TrimSpace(*addr)
		if cfg.Addr == "" {
			log.Fatal("config: --addr / -a must be non-empty when set")
		}
	} else {
		cfg.Addr = ""
	}
	config.ApplyDefaultListenAddress(&cfg)
	cfg.StaticDir = strings.TrimSpace(*staticDir)
	if cfg.StaticDir == "" {
		log.Fatal("config: --static-dir must be non-empty")
	}
	cfg.DashboardDataDir = strings.TrimSpace(*dashboardDataDir)
	if cfg.DashboardDataDir == "" {
		log.Fatal("config: --dashboard-data-dir must be non-empty")
	}
	if s := strings.TrimSpace(*cookieSecure); s != "" {
		b, err := strconv.ParseBool(s)
		if err != nil {
			log.Fatalf("config: --cookie-secure must be true or false, got %q", s)
		}
		cfg.CookieSecureOverride = &b
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
			log.Printf("listening https on %s (static %s; config %s)", cfg.Addr, cfg.StaticDir, cfg.APIProxyConfigFile)
			errCh <- srv.ListenAndServeTLS(cfg.TLSCertFile, cfg.TLSKeyFile)
			return
		}
		log.Printf("listening http on %s (static %s; config %s); use --tls-cert and --tls-key for HTTPS", cfg.Addr, cfg.StaticDir, cfg.APIProxyConfigFile)
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

func usage(prog string, fs *pflag.FlagSet) {
	var w io.Writer = os.Stderr
	if fs != nil {
		w = fs.Output()
	}
	_, _ = fmt.Fprintf(w, "Usage: %s [options]\n\n", prog)
	_, _ = fmt.Fprintf(w, "Version %s\n\n", version)
	if fs != nil {
		fs.SetOutput(w)
		fs.PrintDefaults()
	}
	_, _ = fmt.Fprintln(w, "\nThe gateway file must include a top-level \"auth\" object. If -c is omitted, the default path is", config.DefaultConfigFilePath+".")
	_, _ = fmt.Fprintln(w, "Listen, static, TLS, data dir, and cookies: -a, --static-dir, --tls-*, --dashboard-data-dir, --cookie-secure (defaults: :8080 or :8443 with TLS, static-dir", config.DefaultStaticDir+", dashboard", config.DefaultDashboardDataDir+").")
	_, _ = fmt.Fprintln(w, "For auth plugin \"allow\", you must also pass --insecure (dev and testing only).")
}
