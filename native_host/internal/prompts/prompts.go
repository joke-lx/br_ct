package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"brochat_native_host/internal/protocol"
)

type PromptEntry struct {
	Label    string `json:"label"`
	Alias    string `json:"alias"`
	Template string `json:"template"`
}

func GetPromptsDir(req protocol.Request) protocol.Response {
	exePath, err := os.Executable()
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}

	extDir := filepath.Dir(exePath)
	promptsDir := filepath.Join(extDir, "popup", "main", "prompts", "groups")

	if _, err := os.Stat(promptsDir); os.IsNotExist(err) {
		extDir = filepath.Dir(extDir)
		promptsDir = filepath.Join(extDir, "popup", "main", "prompts", "groups")
	}

	return protocol.Response{Status: "ok", Data: promptsDir}
}

func ParsePromptsFile(req protocol.Request) protocol.Response {
	content, err := os.ReadFile(req.Path)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}

	fileName := filepath.Base(req.Path)
	group := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	prompts, err := parsePromptsContent(string(content), group)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}

	return protocol.Response{Status: "ok", Data: prompts}
}

func SavePromptsFile(req protocol.Request) protocol.Response {
	err := os.WriteFile(req.Path, []byte(req.Content), 0644)
	if err != nil {
		return protocol.Response{Status: "error", Message: err.Error()}
	}
	return protocol.Response{Status: "ok", Message: "File saved successfully"}
}

func CreateBackup(req protocol.Request) protocol.Response {
	return protocol.Response{Status: "ok", Message: "Backup disabled"}
}

func parsePromptsContent(content string, group string) ([]PromptEntry, error) {
	if strings.Contains(content, "export default") {
		return parsePromptsJSONFormat(content, group)
	}
	return parsePromptsLegacyFormat(content, group)
}

func parsePromptsJSONFormat(content string, group string) ([]PromptEntry, error) {
	jsonStart := strings.Index(content, "[")
	jsonEnd := strings.LastIndex(content, "]")
	if jsonStart == -1 || jsonEnd == -1 || jsonEnd < jsonStart {
		return nil, fmt.Errorf("invalid export default format: no JSON array found")
	}

	jsonStr := strings.TrimSpace(content[jsonStart : jsonEnd+1])

	var raw []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return nil, fmt.Errorf("JSON parse error: %v", err)
	}

	var prompts []PromptEntry
	for _, item := range raw {
		entry := PromptEntry{}
		if v, ok := item["label"].(string); ok {
			entry.Label = v
		}
		if v, ok := item["alias"].(string); ok {
			entry.Alias = v
		}
		if v, ok := item["template"].(string); ok {
			entry.Template = v
		}
		prompts = append(prompts, entry)
	}
	return prompts, nil
}

func parsePromptsLegacyFormat(content string, group string) ([]PromptEntry, error) {
	var prompts []PromptEntry
	lines := strings.Split(content, "\n")

	labelPattern := regexp.MustCompile(`label:\s*"([^"]+)"`)
	aliasPattern := regexp.MustCompile(`alias:\s*"([^"]*)"`)
	templateStart := regexp.MustCompile(`template:\s*`)

	var currentLabel string
	var currentAlias string
	var currentTemplate strings.Builder
	inTemplate := false
	var templateQuoteChar string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if match := labelPattern.FindStringSubmatch(line); match != nil {
			if currentLabel != "" && currentTemplate.Len() > 0 {
				prompts = append(prompts, PromptEntry{
					Label:    currentLabel,
					Alias:    currentAlias,
					Template: currentTemplate.String(),
				})
			}
			currentLabel = match[1]
			currentAlias = ""
			currentTemplate.Reset()
			inTemplate = false
			continue
		}

		if match := aliasPattern.FindStringSubmatch(line); match != nil {
			currentAlias = match[1]
			continue
		}

		if templateStart.MatchString(line) {
			rest := strings.TrimSpace(trimmed[len("template:"):])

			if rest == "" {
				inTemplate = true
				templateQuoteChar = ""
				continue
			}

			if strings.HasPrefix(rest, "'") || strings.HasPrefix(rest, "\"") || strings.HasPrefix(rest, "`") {
				templateQuoteChar = string(rest[0])
				startIdx := 1
				endIdx := strings.LastIndex(rest, templateQuoteChar)
				if endIdx > startIdx {
					currentTemplate.WriteString(rest[startIdx:endIdx])
				}
			}
			continue
		}

		if inTemplate {
			if templateQuoteChar == "" {
				for _, q := range []string{"'", "\"", "`"} {
					idx := strings.Index(trimmed, q)
					if idx >= 0 {
						templateQuoteChar = q
						lastIdx := strings.LastIndex(trimmed, q)
						if lastIdx > idx {
							currentTemplate.WriteString(trimmed[idx+1 : lastIdx])
						}
						break
					}
				}
			} else {
				lastIdx := strings.LastIndex(trimmed, templateQuoteChar)
				if lastIdx > 0 && trimmed[lastIdx-1] != '\\' {
					currentTemplate.WriteString(trimmed[:lastIdx])
					inTemplate = false
				} else if trimmed != "" && trimmed != "," {
					if currentTemplate.Len() > 0 {
						currentTemplate.WriteString("\n")
					}
					currentTemplate.WriteString(trimmed)
				}
			}
		}
	}

	if currentLabel != "" && currentTemplate.Len() > 0 {
		prompts = append(prompts, PromptEntry{
			Label:    currentLabel,
			Alias:    currentAlias,
			Template: currentTemplate.String(),
		})
	}

	return prompts, nil
}
