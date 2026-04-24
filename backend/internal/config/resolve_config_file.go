package config

import "strings"

// DefaultConfigFilePath is the default for -c / --conf when the flag is omitted on the command line.
const DefaultConfigFilePath = "/etc/dafuq/dafuq.json"

// ResolveConfigFilePath returns the gateway JSON path: value from -c / --conf when the user
// set the flag, otherwise DefaultConfigFilePath.
func ResolveConfigFilePath(fromFlag string, confFlagChanged bool) string {
	if confFlagChanged {
		return strings.TrimSpace(fromFlag)
	}
	return DefaultConfigFilePath
}
