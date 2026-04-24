//go:build !linux

package auth

import "errors"

// pamAuth is unavailable on this platform. Use Linux with libc PAM to enable the pam auth plugin.
func pamAuth(_ string, _ string, _ string) error {
	return errors.New("PAM auth is only available on Linux")
}
