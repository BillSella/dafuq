package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type fakeJWKSClient struct {
	jwksURL string
	err     error
}

func (f fakeJWKSClient) GetJWKSURL(string) (*url.URL, error) {
	if f.err != nil {
		return nil, f.err
	}
	return url.Parse(f.jwksURL)
}

func newHMACKeyfunc(t *testing.T, secret []byte, kid string) keyfunc.Keyfunc {
	t.Helper()
	jwkSet := map[string]any{
		"keys": []map[string]any{
			{
				"kty": "oct",
				"k":   base64.RawURLEncoding.EncodeToString(secret),
				"kid": kid,
				"alg": "HS256",
				"use": "sig",
			},
		},
	}
	raw, err := json.Marshal(jwkSet)
	if err != nil {
		t.Fatalf("marshal jwk set: %v", err)
	}
	kf, err := keyfunc.NewJWKSetJSON(raw)
	if err != nil {
		t.Fatalf("new keyfunc from jwk set: %v", err)
	}
	return kf
}

func signHS256Token(t *testing.T, secret []byte, kid string, claims jwt.Claims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(secret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func TestJWTValidatorValidateAndAccessClaims(t *testing.T) {
	secret := []byte("workos-test-secret")
	kf := newHMACKeyfunc(t, secret, "wk1")
	v := &JWTValidator{kf: kf, clientID: "cid-1", issuer: "https://issuer.example"}

	token := signHS256Token(t, secret, "wk1", jwt.MapClaims{
		"iss":       "https://issuer.example",
		"sub":       "user-1",
		"client_id": "cid-1",
		"sid":       "sid-1",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})

	c, err := v.Validate(context.Background(), token)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if c.Subject != "user-1" || c.ClientID != "cid-1" || c.SID != "sid-1" {
		t.Fatalf("unexpected claims: %#v", c)
	}

	ac, err := v.ValidateAccessToken(context.Background(), token)
	if err != nil {
		t.Fatalf("validate access token failed: %v", err)
	}
	if ac.Subject != "user-1" || ac.ClientID != "cid-1" || ac.SID != "sid-1" {
		t.Fatalf("unexpected access claims: %#v", ac)
	}
}

func TestNewJWTValidatorConstructorBranches(t *testing.T) {
	orig := newKeyfuncFromURLs
	t.Cleanup(func() { newKeyfuncFromURLs = orig })

	newKeyfuncFromURLs = func(context.Context, []string) (keyfunc.Keyfunc, error) {
		return newHMACKeyfunc(t, []byte("secret"), "kid-1"), nil
	}
	v, err := NewJWTValidator(context.Background(), fakeJWKSClient{jwksURL: "https://issuer/.well-known/jwks.json"}, "cid-1", "")
	if err != nil {
		t.Fatalf("expected constructor success, got %v", err)
	}
	if v.issuer != DefaultWorkOSIssuer {
		t.Fatalf("expected default issuer, got %q", v.issuer)
	}

	newKeyfuncFromURLs = func(context.Context, []string) (keyfunc.Keyfunc, error) {
		return nil, errors.New("keyfunc failed")
	}
	if _, err := NewJWTValidator(context.Background(), fakeJWKSClient{jwksURL: "https://issuer/.well-known/jwks.json"}, "cid-1", "https://issuer"); err == nil {
		t.Fatalf("expected keyfunc creation error")
	}

	if _, err := NewJWTValidator(context.Background(), fakeJWKSClient{err: errors.New("jwks client failed")}, "cid-1", "https://issuer"); err == nil {
		t.Fatalf("expected jwks url fetch error")
	}
}

func TestJWTValidatorValidationFailures(t *testing.T) {
	secret := []byte("workos-test-secret")
	kf := newHMACKeyfunc(t, secret, "wk1")
	v := &JWTValidator{kf: kf, clientID: "cid-1", issuer: "https://issuer.example"}

	if _, err := v.Validate(context.Background(), "not-a-token"); err == nil {
		t.Fatalf("expected parse error for malformed token")
	}

	badClientToken := signHS256Token(t, secret, "wk1", jwt.MapClaims{
		"iss":       "https://issuer.example",
		"sub":       "user-1",
		"client_id": "wrong-client",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})
	if _, err := v.Validate(context.Background(), badClientToken); err == nil {
		t.Fatalf("expected client id mismatch error")
	}

	missingSubToken := signHS256Token(t, secret, "wk1", jwt.MapClaims{
		"iss":       "https://issuer.example",
		"sub":       "",
		"client_id": "cid-1",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})
	if _, err := v.ValidateAccessToken(context.Background(), missingSubToken); err == nil {
		t.Fatalf("expected missing sub error")
	}
}

func TestOIDCValidatorValidateAccessToken(t *testing.T) {
	secret := []byte("oidc-test-secret")
	kf := newHMACKeyfunc(t, secret, "ok1")
	v := &OIDCValidator{kf: kf, issuer: "https://issuer.example", audience: "api://aud-1"}

	okToken := signHS256Token(t, secret, "ok1", jwt.MapClaims{
		"iss": "https://issuer.example",
		"sub": "user-42",
		"aud": "api://aud-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	claims, err := v.ValidateAccessToken(context.Background(), okToken)
	if err != nil {
		t.Fatalf("expected OIDC token validate success: %v", err)
	}
	if claims.Subject != "user-42" {
		t.Fatalf("unexpected subject: %q", claims.Subject)
	}
}

func TestOIDCValidatorValidationFailures(t *testing.T) {
	secret := []byte("oidc-test-secret")
	kf := newHMACKeyfunc(t, secret, "ok1")
	v := &OIDCValidator{kf: kf, issuer: "https://issuer.example", audience: "api://aud-1"}

	missingSub := signHS256Token(t, secret, "ok1", jwt.MapClaims{
		"iss": "https://issuer.example",
		"sub": "",
		"aud": "api://aud-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	if _, err := v.ValidateAccessToken(context.Background(), missingSub); err == nil {
		t.Fatalf("expected missing sub error")
	}

	wrongAudience := signHS256Token(t, secret, "ok1", jwt.MapClaims{
		"iss": "https://issuer.example",
		"sub": "user-1",
		"aud": "api://other",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	if _, err := v.ValidateAccessToken(context.Background(), wrongAudience); err == nil {
		t.Fatalf("expected wrong audience error")
	}

	vNoAudience := &OIDCValidator{kf: kf, issuer: "https://issuer.example", audience: ""}
	noAudienceToken := signHS256Token(t, secret, "ok1", jwt.MapClaims{
		"iss": "https://issuer.example",
		"sub": "user-2",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	if _, err := vNoAudience.ValidateAccessToken(context.Background(), noAudienceToken); err != nil {
		t.Fatalf("expected success when audience not required: %v", err)
	}
}
