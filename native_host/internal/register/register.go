package register

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	HostName         = "com.brochat.prompts_editor"
	HostManifestDir  = ".bro_chat_native_host"
	HostManifestFile = "com.brochat.prompts_editor.json"
	EdgeRegPath      = `Software\Microsoft\Edge\NativeMessagingHosts\` + HostName
	ChromeRegPath    = `Software\Google\Chrome\NativeMessagingHosts\` + HostName
	ExtensionId      = "oklmcegaafghdpdbignoacfgmknleben"
)

func EnsureRegistered() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Get home dir error: %v\n", err)
		return
	}
	manifestDir := filepath.Join(homeDir, HostManifestDir)
	if err := os.MkdirAll(manifestDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Create manifest dir error: %v\n", err)
		return
	}
	manifestPath := filepath.Join(manifestDir, HostManifestFile)

	writeHostManifest(manifestPath)
	registerToBrowser(EdgeRegPath, manifestPath)
	registerToBrowser(ChromeRegPath, manifestPath)

	fmt.Fprintf(os.Stderr, "Native host registered at: %s\n", manifestPath)
}

func writeHostManifest(path string) error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	absExe, err := filepath.Abs(exePath)
	if err != nil {
		return err
	}

	manifest := map[string]interface{}{
		"name":            HostName,
		"description":     "Bro Chat Native Host",
		"path":            absExe,
		"type":            "stdio",
		"allowed_origins": []string{"chrome-extension://" + ExtensionId + "/"},
	}

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func registerToBrowser(regPath, manifestPath string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, regPath, registry.READ)
	if err == nil {
		defer k.Close()
		val, _, err := k.GetStringValue("")
		if err == nil && val == manifestPath {
			return nil
		}
	}

	k, _, err = registry.CreateKey(registry.CURRENT_USER, regPath, registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue("", manifestPath)
}
