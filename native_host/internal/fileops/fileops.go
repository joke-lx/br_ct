package fileops

import (
	"os"
	"path/filepath"
	"strings"

	"brochat_native_host/internal/protocol"
)

type FileEntry struct {
	Name      string `json:"name"`
	IsDir     bool   `json:"isDir"`
	Extension string `json:"extension,omitempty"`
}

func ReadFile(req protocol.Request) protocol.Response {
	data, err := os.ReadFile(req.Path)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}
	return protocol.Response{Status: "ok", Data: string(data)}
}

func WriteFile(req protocol.Request) protocol.Response {
	err := os.WriteFile(req.Path, []byte(req.Content), 0644)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}
	return protocol.Response{Status: "ok", Message: "File saved successfully"}
}

func ListDir(req protocol.Request) protocol.Response {
	entries, err := os.ReadDir(req.Path)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}

	var files []FileEntry
	for _, entry := range entries {
		info, _ := entry.Info()
		isDir := info != nil && info.IsDir()
		ext := ""
		if !isDir {
			ext = strings.TrimPrefix(filepath.Ext(entry.Name()), ".")
		}
		files = append(files, FileEntry{
			Name:      entry.Name(),
			IsDir:     isDir,
			Extension: ext,
		})
	}
	return protocol.Response{Status: "ok", Data: files}
}
