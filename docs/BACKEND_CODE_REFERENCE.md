# Backend Code Reference

This reference catalogs backend files, structs, and functions for fast navigation.
Scope: `backend/` only.

## `cmd/server`

### `cmd/server/main.go`

- Structs:
  - _(none)_
- Functions:
  - `main()`
  - `usage(prog string, fs *pflag.FlagSet)`

## `internal/config`

### `internal/config/config.go`

- Structs:
  - `Config`
- Types/Consts:
  - `AuthDriver`
  - `AuthWorkOSPlugin`
  - `AuthProxyOrOIDC`
  - `AuthAllowPlugin`
  - `AuthPAMPlugin`
  - `DefaultProxyMaxBodyBytes`
  - `DefaultStaticDir`
  - `DefaultDashboardDataDir`
- Functions:
  - `ApplyDefaultListenAddress(cfg *Config)`
  - `getenv(key, def string)`
  - `Load() (Config, error)`
  - `parseDurationEnv(key string, def time.Duration) (time.Duration, error)`
  - `parseInt64EnvBytes(key string, def int64) (int64, error)`
  - `(Config) EffectiveProxyMaxBody() int64`
  - `(Config) ValidateForAuth(d AuthDriver) error`
  - `(Config) UseTLS() bool`
  - `(Config) CookieSecure() bool`

### `internal/config/resolve_config_file.go`

- Structs:
  - _(none)_
- Functions:
  - `ResolveConfigFilePath(fromFlag string, confFlagChanged bool) string`

### Tests

- `internal/config/apply_default_listen_test.go`
- `internal/config/cookie_secure_test.go`
- `internal/config/resolve_config_file_test.go`

## `internal/server`

### `internal/server/doc.go`

- Package-level architecture doc for server package.

### `internal/server/server.go`

- Structs:
  - _(none)_
- Functions:
  - `NewMux(cfg config.Config, opts ...MuxOption) (http.Handler, error)`
  - `authDriverForRoute(r *APIProxyRoute) config.AuthDriver`
  - `isWorkOSAuthRoute(r *APIProxyRoute) bool`
  - `isAllowAuthRoute(r *APIProxyRoute) bool`
  - `isPAMAuthRoute(r *APIProxyRoute) bool`
  - `newTokenValidator(ctx context.Context, cfg config.Config, drv config.AuthDriver, outClient **usermanagement.Client) (auth.TokenValidator, error)`
  - `registerAuthRoutes(mux *http.ServeMux, route *APIProxyRoute, workos *auth.Handler, allow *auth.AllowHandler, pam *auth.PAMHandler, maxProxyBody int64) error`
  - `logRequests(next http.Handler) http.Handler`
  - `spaIndex(staticDir string) http.HandlerFunc`
  - `spaOrFile(staticDir string) http.HandlerFunc`

### `internal/server/gateway_types.go`

- Structs:
  - `APIProxyRoute`
- Functions:
  - `normalizeRoute(r *APIProxyRoute) error`

### `internal/server/gateway_parse.go`

- Structs:
  - `gatewayFileRaw`
- Functions:
  - `parseGatewayAuthMessage(raw json.RawMessage) (*APIProxyRoute, error)`
  - `parseDataRouteMessage(raw json.RawMessage) (*APIProxyRoute, error)`
  - `isJSONEmptyOrNull(b []byte) bool`
  - `parseRouteObject(raw json.RawMessage) (*APIProxyRoute, error)`
  - `routeFromMap(m map[string]json.RawMessage) (*APIProxyRoute, error)`
  - `applyPluginField(r *APIProxyRoute, raw json.RawMessage) error`
  - `applyProxyField(r *APIProxyRoute, proxyRaw []byte) error`
  - `firstStringField(m map[string]json.RawMessage, keys ...string) (string, error)`
  - `readJSONStringKey(obj map[string]json.RawMessage, key string) (string, error)`

### `internal/server/gateway_config.go`

- Structs:
  - _(none)_
- Functions:
  - `LoadGatewayConfig(path string) (auth *APIProxyRoute, routes []APIProxyRoute, err error)`
  - `parseGatewayFile(b []byte) (auth *APIProxyRoute, routes []APIProxyRoute, err error)`

### `internal/server/gateway_routes.go`

- Structs:
  - _(none)_
- Functions:
  - `RegisterAPIRoutes(mux *http.ServeMux, v auth.TokenValidator, routes []APIProxyRoute, plugins *PluginRegistry, maxProxyRequestBody int64) error`
  - `routeHandler(route APIProxyRoute, reg *PluginRegistry, maxProxyRequestBody int64) (http.Handler, error)`

### `internal/server/proxy_failover.go`

- Structs:
  - _(none)_
- Functions:
  - `newFailoverProxy(route APIProxyRoute, maxRequestBody int64) http.Handler`
  - `proxyOnce(client *http.Client, backend string, route APIProxyRoute, in *http.Request, body []byte) (*http.Response, int, error)`
  - `copyHeader(dst, src http.Header)`
  - `singleJoiningSlash(a, b string) string`

### `internal/server/plugin.go`

- Structs:
  - `PluginRegistry`
  - `namedHandler`
- Interfaces:
  - `Plugin`
- Functions:
  - `NewPluginRegistry(extras ...Plugin) *PluginRegistry`
  - `(r *PluginRegistry) Register(p Plugin)`
  - `(r *PluginRegistry) RegisterHandler(name string, h http.Handler)`
  - `(r *PluginRegistry) Handler(name string) (http.Handler, bool)`
  - `(r *PluginRegistry) add(p Plugin)`
  - `(n namedHandler) Name() string`
  - `(n namedHandler) Handler() http.Handler`

### `internal/server/plugin_builtins.go`

- Structs:
  - `localMetricsPlugin`
- Functions:
  - `defaultPlugins() []Plugin`
  - `(localMetricsPlugin) Name() string`
  - `(localMetricsPlugin) Handler() http.Handler`

### `internal/server/mux_options.go`

- Structs:
  - `muxConfig`
- Functions:
  - `WithPluginRegistry(r *PluginRegistry) MuxOption`
  - `newMuxConfig(opts []MuxOption) *muxConfig`

### `internal/server/middleware_production.go`

- Structs:
  - _(none)_
- Functions:
  - `withProductionMiddleware(next http.Handler) http.Handler`
  - `securityHeaders(next http.Handler) http.Handler`
  - `recoverPanic(next http.Handler) http.Handler`

### Tests

- `internal/server/proxy_test.go`
- `internal/server/plugin_test.go`

## `internal/auth`

### `internal/auth/access.go`

- Structs:
  - `AccessContextClaims`
- Functions:
  - `ContextWithAccessClaims(ctx context.Context, c *AccessContextClaims) context.Context`
  - `AccessClaimsFromContext(ctx context.Context) (*AccessContextClaims, bool)`

### `internal/auth/middleware.go`

- Structs:
  - _(none)_
- Functions:
  - `BearerAuth(v TokenValidator) func(http.Handler) http.Handler`
  - `jsonErr(w http.ResponseWriter, status int, body string)`
  - `bearerToken(r *http.Request) (string, bool)`

### `internal/auth/jwt_validator.go`

- Structs:
  - `WorkOSAccessClaims`
  - `JWTValidator`
- Functions:
  - `NewJWTValidator(ctx context.Context, apiClient *usermanagement.Client, workosClientID, issuer string) (*JWTValidator, error)`
  - `(v *JWTValidator) Validate(ctx context.Context, raw string) (*WorkOSAccessClaims, error)`
  - `(v *JWTValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error)`

### `internal/auth/oidc_jwt.go`

- Structs:
  - `OIDCValidator`
- Functions:
  - `NewOIDCValidator(ctx context.Context, jwksURL, issuer, audience string) (*OIDCValidator, error)`
  - `(v *OIDCValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error)`

### `internal/auth/allow_jwt.go`

- Structs:
  - `AllowValidator`
  - `allowParsed`
- Functions:
  - `NewAllowValidator(cfg config.Config) (*AllowValidator, error)`
  - `(a *AllowValidator) Subject() string`
  - `(a *AllowValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error)`
  - `(a *AllowValidator) ValidateRefreshToken(ctx context.Context, raw string) error`
  - `(a *AllowValidator) parseAndVerify(raw string, wantType string) (allowParsed, error)`
  - `(a *AllowValidator) IssueAccessToken() (string, error)`
  - `(a *AllowValidator) IssueRefreshToken() (string, error)`
  - `(a *AllowValidator) IssueAccessTokenForSubject(subject string) (string, error)`
  - `(a *AllowValidator) IssueRefreshTokenForSubject(subject string) (string, error)`
  - `(a *AllowValidator) signTokenForSubject(subject, typ string, ttl time.Duration) (string, error)`

### `internal/auth/allow_handler.go`

- Structs:
  - `allowPasswordBody`
  - `AllowHandler`
- Functions:
  - `NewAllowHandler(cfg config.Config, v *AllowValidator) *AllowHandler`
  - `(a *AllowHandler) Login(w http.ResponseWriter, r *http.Request)`
  - `(a *AllowHandler) Callback(w http.ResponseWriter, r *http.Request)`
  - `(a *AllowHandler) issueAndFinish(w http.ResponseWriter, r *http.Request, jsonStatus int)`
  - `(a *AllowHandler) Password(w http.ResponseWriter, r *http.Request)`
  - `(a *AllowHandler) Refresh(w http.ResponseWriter, r *http.Request)`
  - `(a *AllowHandler) Logout(w http.ResponseWriter, r *http.Request)`
  - `(a *AllowHandler) Me(w http.ResponseWriter, r *http.Request)`

### `internal/auth/handlers.go`

- Structs:
  - `Handler`
  - `AuthTokenJSON`
  - `passwordBody`
  - `refreshBody`
- Functions:
  - `NewHandler(cfg config.Config, client *usermanagement.Client, v TokenValidator) *Handler`
  - `tokenJSON(r usermanagement.AuthenticateResponse) AuthTokenJSON`
  - `writeJSON(w http.ResponseWriter, status int, v any)`
  - `(h *Handler) Login(w http.ResponseWriter, r *http.Request)`
  - `(h *Handler) Callback(w http.ResponseWriter, r *http.Request)`
  - `(h *Handler) postLoginRedirectURL(r *http.Request) (*url.URL, error)`
  - `(h *Handler) Password(w http.ResponseWriter, r *http.Request)`
  - `(h *Handler) Refresh(w http.ResponseWriter, r *http.Request)`
  - `(h *Handler) Logout(w http.ResponseWriter, r *http.Request)`
  - `(h *Handler) clearLegacySessionCookie(w http.ResponseWriter)`
  - `(h *Handler) setOAuthStateCookie(w http.ResponseWriter, state string)`
  - `(h *Handler) clearOAuthStateCookie(w http.ResponseWriter)`
  - `(h *Handler) validateOAuthState(r *http.Request) error`
  - `(h *Handler) Me(w http.ResponseWriter, r *http.Request)`
  - `clientIP(r *http.Request) string`
  - `newOAuthState() (string, error)`
  - `decodeStrictJSONBody(w http.ResponseWriter, r *http.Request, dst any) error`
  - `(h *Handler) allowPasswordAttempt(ip string, now time.Time) bool`
  - `(h *Handler) pruneLocked(cutoff time.Time)`

### `internal/auth/pam_jwt.go`

- Structs:
  - `PAMValidator`
  - `pamParsed`
- Functions:
  - `NewPAMValidator(cfg config.Config) (*PAMValidator, error)`
  - `(p *PAMValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error)`
  - `(p *PAMValidator) ValidateRefreshToken(ctx context.Context, raw string) (string, error)`
  - `(p *PAMValidator) parseAndVerify(raw string, wantType string) (pamParsed, error)`
  - `(p *PAMValidator) IssueAccessTokenForSubject(user string) (string, error)`
  - `(p *PAMValidator) IssueRefreshTokenForSubject(user string) (string, error)`
  - `(p *PAMValidator) sign(typ, sub string, ttl time.Duration) (string, error)`

### `internal/auth/pam_handler.go`

- Structs:
  - `PAMHandler`
- Functions:
  - `NewPAMHandler(cfg config.Config, v *PAMValidator) *PAMHandler`
  - `(h *PAMHandler) Login(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) Callback(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) Password(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) Refresh(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) Logout(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) Me(w http.ResponseWriter, r *http.Request)`
  - `(h *PAMHandler) pamService() string`

### `internal/auth/pam_password_auth_linux.go`

- Functions:
  - `pamAuth(service, user, pass string) error`

### `internal/auth/pam_password_auth_stub.go`

- Functions:
  - `pamAuth(_ string, _ string, _ string) error`

### `internal/auth/post_login_redirect.go`

- Functions:
  - `PostLoginRedirectURL(cfg config.Config, r *http.Request) (*url.URL, error)`

### Tests

- `internal/auth/allow_jwt_test.go`
- `internal/auth/handlers_test.go`
- `internal/auth/pam_jwt_test.go`

## `internal/api`

### `internal/api/handlers.go`

- Structs:
  - _(none)_
- Functions:
  - `Health(w http.ResponseWriter, _ *http.Request)`
  - `SampleGaugeValue(w http.ResponseWriter, _ *http.Request)`

### `internal/api/dashboards.go`

- Structs:
  - `DashboardStore`
  - `dashboardFile`
- Functions:
  - `NewDashboardStore(dir, orgID string) *DashboardStore`
  - `RegisterDashboardRoutes(mux *http.ServeMux, store *DashboardStore)`
  - `(s *DashboardStore) userDirForSubject(sub string) (string, error)`
  - `(s *DashboardStore) pathForGroup(groupID string) (string, error)`
  - `dirNameForSubject(sub string) string`
  - `dashboardFileNameForID(id string) string`
  - `(s *DashboardStore) handleGet(w http.ResponseWriter, r *http.Request)`
  - `(s *DashboardStore) handlePut(w http.ResponseWriter, r *http.Request)`
  - `(s *DashboardStore) moveDashboardToRecovery(userDir, dashboardDirName string) error`
  - `nextRecoveryName(recoveryUserDir, dashboardDirName string) (string, error)`
  - `(s *DashboardStore) handleGetVersions(w http.ResponseWriter, r *http.Request)`
  - `(s *DashboardStore) handleRollback(w http.ResponseWriter, r *http.Request)`
  - `validateDashboardItem(item map[string]any, index int) error`
  - `writeJSON(w http.ResponseWriter, status int, v any)`
  - `atomicWriteFile(path string, data []byte) error`
  - `sanitizePathSegment(in, fallback string) string`
  - `versionFileName(now time.Time) string`
  - `writeVersionSnapshotWithRetry(dashboardDir string, data []byte) error`
  - `writeFileNoOverwrite(path string, data []byte) error`
  - `versionFileNameFromDisplay(display string) (string, error)`
  - `versionDisplayFromFileName(name string) (string, error)`
  - `listDashboardVersionFiles(dashboardDir string) ([]string, error)`
  - `newestVersionFilePath(dashboardDir string) (string, error)`
  - `pruneDashboardVersions(dashboardDir string, keep int) error`

### Tests

- `internal/api/dashboards_test.go`

## Notes

- This reference includes internal and test files for completeness.
- If files/functions/structs are added or renamed, update this document in the same change.
