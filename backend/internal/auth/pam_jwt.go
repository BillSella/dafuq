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
	pamJWTTypeAccess  = "access"
	pamJWTTypeRefresh = "refresh"
	pamJWTIssuer      = "dafuq-pam"
)

// PAMValidator validates HS256 access and refresh tokens issued after successful
// PAM password authentication. Each token’s sub claim is the local Linux user name.
type PAMValidator struct {
	secret []byte
}

// NewPAMValidator builds a validator for the "pam" auth plugin.
func NewPAMValidator(cfg config.Config) (*PAMValidator, error) {
	sec := strings.TrimSpace(cfg.PAMJWTSecret)
	if sec == "" {
		return nil, errors.New("DAFUQ_PAM_JWT_SECRET is empty")
	}
	return &PAMValidator{secret: []byte(sec)}, nil
}

// ValidateAccessToken implements [TokenValidator].
func (p *PAMValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error) {
	_ = ctx
	claims, err := p.parseAndVerify(raw, pamJWTTypeAccess)
	if err != nil {
		return nil, err
	}
	if claims.sub == "" {
		return nil, errors.New("missing sub")
	}
	return &AccessContextClaims{Subject: claims.sub}, nil
}

// ValidateRefreshToken checks a PAM-issued refresh token.
func (p *PAMValidator) ValidateRefreshToken(ctx context.Context, raw string) (string, error) {
	_ = ctx
	claims, err := p.parseAndVerify(raw, pamJWTTypeRefresh)
	if err != nil {
		return "", err
	}
	if claims.sub == "" {
		return "", errors.New("missing sub")
	}
	return claims.sub, nil
}

type pamParsed struct{ sub string }

func (p *PAMValidator) parseAndVerify(raw string, wantType string) (pamParsed, error) {
	var out pamParsed
	tok, err := jwt.ParseWithClaims(strings.TrimSpace(raw), jwt.MapClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return p.secret, nil
	}, jwt.WithIssuer(pamJWTIssuer), jwt.WithExpirationRequired())
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
	if si, _ := c["iss"].(string); si != pamJWTIssuer {
		return out, errors.New("invalid iss")
	}
	sub, _ := c["sub"].(string)
	if sub == "" {
		return out, errors.New("missing sub")
	}
	return pamParsed{sub: strings.TrimSpace(sub)}, nil
}

// IssueAccessTokenForSubject issues a short-lived access JWT for a PAM user.
func (p *PAMValidator) IssueAccessTokenForSubject(user string) (string, error) {
	return p.sign(pamJWTTypeAccess, user, 1*time.Hour)
}

// IssueRefreshTokenForSubject issues a long-lived refresh JWT.
func (p *PAMValidator) IssueRefreshTokenForSubject(user string) (string, error) {
	return p.sign(pamJWTTypeRefresh, user, 720*time.Hour)
}

func (p *PAMValidator) sign(typ, sub string, ttl time.Duration) (string, error) {
	now := time.Now()
	c := jwt.MapClaims{
		"iss": pamJWTIssuer,
		"sub": sub,
		"typ": typ,
		"iat": now.Unix(),
		"exp": now.Add(ttl).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	return t.SignedString(p.secret)
}
