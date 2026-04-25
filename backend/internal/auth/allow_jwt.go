package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dafuq-framework/dafuq/backend/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

const (
	allowJWTTypeAccess  = "access"
	allowJWTTypeRefresh = "refresh"
	allowJWTIssuer      = "dafuq-allow"
)

// AllowValidator accepts HS256 tokens issued by the "allow" dev auth plugin.
// It implements [TokenValidator]; only tokens signed with the configured secret validate.
type AllowValidator struct {
	secret  []byte
	subject string
}

// NewAllowValidator builds a validator for the "allow" auth plugin. Requires
// [config.Config] allow plugin fields: AllowJWTSecret and AllowSubject from the environment; AllowInsecureAuth from --insecure.
func NewAllowValidator(cfg config.Config) (*AllowValidator, error) {
	sec := strings.TrimSpace(cfg.AllowJWTSecret)
	if sec == "" {
		return nil, errors.New("DAFUQ_ALLOW_JWT_SECRET is empty")
	}
	sub := strings.TrimSpace(cfg.AllowSubject)
	if sub == "" {
		sub = "test-user"
	}
	return &AllowValidator{secret: []byte(sec), subject: sub}, nil
}

// Subject returns the configured subject (JWT "sub" claim) for this validator.
func (a *AllowValidator) Subject() string { return a.subject }

// ValidateAccessToken implements [TokenValidator] for access tokens only (not refresh).
func (a *AllowValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error) {
	_ = ctx
	claims, err := a.parseAndVerify(raw, allowJWTTypeAccess)
	if err != nil {
		return nil, err
	}
	if claims.sub == "" {
		return nil, errors.New("missing sub")
	}
	return &AccessContextClaims{Subject: claims.sub}, nil
}

// ValidateRefreshToken checks a refresh token for the refresh handler.
func (a *AllowValidator) ValidateRefreshToken(ctx context.Context, raw string) error {
	_, err := a.parseAndVerify(raw, allowJWTTypeRefresh)
	return err
}

type allowParsed struct{ sub string }

func (a *AllowValidator) parseAndVerify(raw string, wantType string) (allowParsed, error) {
	var out allowParsed
	tok, err := jwt.ParseWithClaims(strings.TrimSpace(raw), jwt.MapClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return a.secret, nil
	}, jwt.WithIssuer(allowJWTIssuer), jwt.WithExpirationRequired())
	if err != nil {
		return out, err
	}
	c, ok := tok.Claims.(jwt.MapClaims)
	if !ok || !tok.Valid {
		return out, errors.New("invalid token")
	}
	typ, _ := c["typ"].(string)
	if typ != wantType {
		return out, errors.New("wrong token type")
	}
	si, _ := c["iss"].(string)
	if si != allowJWTIssuer {
		return out, errors.New("invalid iss")
	}
	sub, _ := c["sub"].(string)
	if sub == "" {
		return out, errors.New("missing sub")
	}
	return allowParsed{sub: strings.TrimSpace(sub)}, nil
}

// IssueAccessToken returns a short-lived access JWT (Bearer) for the allow plugin.
func (a *AllowValidator) IssueAccessToken() (string, error) {
	return a.signTokenForSubject(a.subject, allowJWTTypeAccess, 1*time.Hour)
}

// IssueRefreshToken returns a long-lived refresh JWT for the allow plugin.
func (a *AllowValidator) IssueRefreshToken() (string, error) {
	return a.signTokenForSubject(a.subject, allowJWTTypeRefresh, 720*time.Hour)
}

// IssueAccessTokenForSubject returns an access token for the provided subject.
func (a *AllowValidator) IssueAccessTokenForSubject(subject string) (string, error) {
	return a.signTokenForSubject(subject, allowJWTTypeAccess, 1*time.Hour)
}

// IssueRefreshTokenForSubject returns a refresh token for the provided subject.
func (a *AllowValidator) IssueRefreshTokenForSubject(subject string) (string, error) {
	return a.signTokenForSubject(subject, allowJWTTypeRefresh, 720*time.Hour)
}

func (a *AllowValidator) signTokenForSubject(subject, typ string, ttl time.Duration) (string, error) {
	sub := strings.TrimSpace(subject)
	if sub == "" {
		sub = a.subject
	}
	now := time.Now()
	c := jwt.MapClaims{
		"iss": allowJWTIssuer,
		"sub": sub,
		"typ": typ,
		"iat": now.Unix(),
		"exp": now.Add(ttl).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	return t.SignedString(a.secret)
}
