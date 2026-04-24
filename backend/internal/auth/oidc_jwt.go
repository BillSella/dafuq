package auth

import (
	"context"
	"errors"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// OIDCValidator checks JWTs from any OIDC provider (Auth0, Okta, etc.) using a JWKS URL.
type OIDCValidator struct {
	kf       keyfunc.Keyfunc
	issuer   string
	audience string
}

// NewOIDCValidator builds a validator for third-party access tokens.
func NewOIDCValidator(ctx context.Context, jwksURL, issuer, audience string) (*OIDCValidator, error) {
	if jwksURL == "" {
		return nil, errors.New("jwks url is required for OIDC token validation")
	}
	if issuer == "" {
		return nil, errors.New("issuer is required for OIDC token validation")
	}
	kf, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, err
	}
	return &OIDCValidator{kf: kf, issuer: issuer, audience: audience}, nil
}

// ValidateAccessToken implements TokenValidator for standard OIDC access tokens.
func (v *OIDCValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error) {
	opts := []jwt.ParserOption{jwt.WithIssuer(v.issuer), jwt.WithExpirationRequired()}
	if v.audience != "" {
		opts = append(opts, jwt.WithAudience(v.audience))
	}
	tok, err := jwt.ParseWithClaims(raw, &jwt.RegisteredClaims{}, v.kf.KeyfuncCtx(ctx), opts...)
	if err != nil {
		return nil, err
	}
	rc, ok := tok.Claims.(*jwt.RegisteredClaims)
	if !ok || !tok.Valid {
		return nil, errors.New("invalid token")
	}
	if rc.Subject == "" {
		return nil, errors.New("missing sub")
	}
	return &AccessContextClaims{Subject: rc.Subject}, nil
}
