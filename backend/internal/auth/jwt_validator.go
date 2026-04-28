package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// DefaultWorkOSIssuer is the JWT iss claim for WorkOS access tokens.
const DefaultWorkOSIssuer = "https://api.workos.com"

// WorkOSAccessClaims are standard WorkOS User Management access-token claims.
type WorkOSAccessClaims struct {
	jwt.RegisteredClaims
	ClientID string `json:"client_id"`
	SID      string `json:"sid"`
}

// JWTValidator verifies WorkOS-issued JWTs against the public JWKS for this client.
type JWTValidator struct {
	kf       keyfunc.Keyfunc
	clientID string
	issuer   string
}

type workosJWKSClient interface {
	GetJWKSURL(workosClientID string) (*url.URL, error)
}

var newKeyfuncFromURLs = keyfunc.NewDefaultCtx

// NewJWTValidator builds a validator that refreshes JWKS from WorkOS (safe for multi-region APIs).
func NewJWTValidator(ctx context.Context, apiClient workosJWKSClient, workosClientID, issuer string) (*JWTValidator, error) {
	if issuer == "" {
		issuer = DefaultWorkOSIssuer
	}
	u, err := apiClient.GetJWKSURL(workosClientID)
	if err != nil {
		return nil, err
	}
	kf, err := newKeyfuncFromURLs(ctx, []string{u.String()})
	if err != nil {
		return nil, err
	}
	return &JWTValidator{kf: kf, clientID: workosClientID, issuer: issuer}, nil
}

// Validate parses the JWT, verifies the signature against JWKS, and checks issuer and client_id.
func (v *JWTValidator) Validate(ctx context.Context, raw string) (*WorkOSAccessClaims, error) {
	tok, err := jwt.ParseWithClaims(raw, &WorkOSAccessClaims{}, v.kf.KeyfuncCtx(ctx),
		jwt.WithIssuer(v.issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	c, ok := tok.Claims.(*WorkOSAccessClaims)
	if !ok || !tok.Valid {
		return nil, errors.New("invalid token claims")
	}
	if c.ClientID != v.clientID {
		return nil, fmt.Errorf("client_id claim does not match configured client")
	}
	return c, nil
}

// ValidateAccessToken implements TokenValidator for WorkOS-issued access tokens.
func (v *JWTValidator) ValidateAccessToken(ctx context.Context, raw string) (*AccessContextClaims, error) {
	c, err := v.Validate(ctx, raw)
	if err != nil {
		return nil, err
	}
	if c.Subject == "" {
		return nil, errors.New("missing sub")
	}
	return &AccessContextClaims{Subject: c.Subject, ClientID: c.ClientID, SID: c.SID}, nil
}
