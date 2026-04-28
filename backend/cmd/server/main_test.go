package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/spf13/pflag"
)

func TestUsagePrintsKeySections(t *testing.T) {
	fs := pflag.NewFlagSet("server", pflag.ContinueOnError)
	buf := new(bytes.Buffer)
	fs.SetOutput(buf)
	usage("server", fs)
	out := buf.String()
	if !strings.Contains(out, "Usage: server [options]") {
		t.Fatalf("expected usage header, got: %s", out)
	}
	if !strings.Contains(out, "Version") {
		t.Fatalf("expected version line, got: %s", out)
	}
}
