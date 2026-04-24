package config

import "testing"

func TestResolveConfigFilePath(t *testing.T) {
	if got := ResolveConfigFilePath("/opt/x.json", true); got != "/opt/x.json" {
		t.Fatalf("changed flag: got %q", got)
	}
	if got := ResolveConfigFilePath("/not/used", false); got != DefaultConfigFilePath {
		t.Fatalf("default when flag not changed: got %q want %q", got, DefaultConfigFilePath)
	}
}
