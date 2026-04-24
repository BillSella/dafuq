package config

import "testing"

func TestCookieSecure(t *testing.T) {
	f := false
	c := Config{CookieSecureOverride: &f}
	if c.CookieSecure() {
		t.Fatal("override false => false")
	}
	tr := true
	c2 := Config{CookieSecureOverride: &tr, TLSCertFile: "x", TLSKeyFile: "y"}
	if !c2.CookieSecure() {
		t.Fatal("override true => true even with TLS")
	}
	// no override: follows TLS
	c3 := Config{TLSCertFile: "a.pem", TLSKeyFile: "b.key"}
	if !c3.CookieSecure() {
		t.Fatal("no override with TLS => true")
	}
	c4 := Config{}
	if c4.CookieSecure() {
		t.Fatal("no override without TLS => false")
	}
}
