//go:build linux

package auth

import (
	"github.com/msteinert/pam/v2"
)

// pamAuth validates username/password with the system PAM stack (PAM service name, e.g. "login").
func pamAuth(service, user, pass string) error {
	if service == "" {
		service = "login"
	}
	t, err := pam.StartFunc(service, user, func(s pam.Style, msg string) (string, error) {
		switch s {
		case pam.PromptEchoOff:
			return pass, nil
		case pam.PromptEchoOn:
			return pass, nil
		case pam.ErrorMsg, pam.TextInfo:
			return "", nil
		default:
			return "", nil
		}
	})
	if err != nil {
		return err
	}
	defer func() { _ = t.End() }()
	return t.Authenticate(0)
}
