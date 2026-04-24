package server

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
)

func newFailoverProxy(route APIProxyRoute, maxRequestBody int64) http.Handler {
	if maxRequestBody <= 0 {
		maxRequestBody = config.DefaultProxyMaxBodyBytes
	}
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   5 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   5 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limited := io.LimitReader(r.Body, maxRequestBody+1)
		body, err := io.ReadAll(limited)
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()
		if int64(len(body)) > maxRequestBody {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			return
		}

		lastStatus := http.StatusBadGateway
		var lastErr error
		for _, backend := range route.Backends {
			resp, status, err := proxyOnce(client, backend, route, r, body)
			if err != nil {
				lastErr = err
				lastStatus = status
				continue
			}
			defer resp.Body.Close()
			copyHeader(w.Header(), resp.Header)
			w.WriteHeader(resp.StatusCode)
			_, _ = io.Copy(w, resp.Body)
			return
		}
		if lastErr != nil {
			log.Printf("gateway proxy: %v", lastErr)
			if lastStatus < 400 || lastStatus > 599 {
				lastStatus = http.StatusBadGateway
			}
			http.Error(w, "bad gateway", lastStatus)
			return
		}
		http.Error(w, "no healthy upstream backends", http.StatusBadGateway)
	})
}

func proxyOnce(client *http.Client, backend string, route APIProxyRoute, in *http.Request, body []byte) (*http.Response, int, error) {
	u, err := url.Parse(strings.TrimSpace(backend))
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	rel := strings.TrimPrefix(in.URL.Path, route.ListenPath)
	u.Path = singleJoiningSlash(u.Path, rel)
	u.RawQuery = in.URL.RawQuery

	req, err := http.NewRequestWithContext(in.Context(), in.Method, u.String(), bytes.NewReader(body))
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	copyHeader(req.Header, in.Header)
	req.Host = u.Host
	req.Header.Del("Connection")
	req.Header.Del("Proxy-Connection")
	req.Header.Del("Keep-Alive")
	req.Header.Del("Transfer-Encoding")
	req.Header.Del("Upgrade")
	req.Header.Del("Proxy-Authenticate")
	req.Header.Del("Proxy-Authorization")
	req.Header.Del("Te")
	req.Header.Del("Trailer")
	req.Header.Del("Accept-Encoding")

	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	if resp.StatusCode >= 500 {
		_ = resp.Body.Close()
		return nil, http.StatusBadGateway, fmt.Errorf("backend %s returned %d", backend, resp.StatusCode)
	}
	return resp, http.StatusBadGateway, nil
}

func copyHeader(dst, src http.Header) {
	for k := range dst {
		dst.Del(k)
	}
	for k, vv := range src {
		if slices.Contains([]string{
			"Connection", "Proxy-Connection", "Keep-Alive", "Transfer-Encoding", "Upgrade",
			"Proxy-Authenticate", "Proxy-Authorization", "Te", "Trailer",
		}, k) {
			continue
		}
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	default:
		return a + b
	}
}
