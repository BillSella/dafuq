// Package server is the main HTTP entry: health, pluggable API gateway, auth, and static UI.
//
// # Gateway and plugins
//
// JSON in DAFUQ_API_PROXY_CONFIG_FILE defines "listen" paths with either
// "plugin": { "local": "<id>" } or "plugin": { "proxy": [ "https://.../path", ... ] }.
// For auth, "local" can be "workos", "allow" (dev: DAFUQ_ALLOW_INSECURE_AUTH), "pam" (Linux PAM: DAFUQ_PAM_JWT_SECRET), or an external BFF via "proxy".
//
// To add a local in-process plugin:
//  1. Implement [Plugin] (name + [http.Handler] for routes under the listen prefix).
//  2. Build a [PluginRegistry]: e.g. r := NewPluginRegistry(myPlugin{}), or
//     reg := NewPluginRegistry(); reg.Register(myPlugin{}).
//  3. Pass options: NewMux(cfg, WithPluginRegistry(r)).
//
// Use RegisterHandler for a one-off [http.Handler] without implementing [Plugin] by name.
package server
