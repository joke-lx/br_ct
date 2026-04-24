/**
 * Bro Chat Native Messaging Host
 * 用于浏览器扩展与本地文件系统通信
 *
 * 功能：
 * - 读取提示词文件
 * - 写入提示词文件
 * - 列出提示词目录
 */

package main

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/sys/windows/registry"
)

// 配置常量
const (
	hostName         = "com.brochat.prompts_editor"
	hostManifestDir  = ".bro_chat_native_host"
	hostManifestFile = "com.brochat.prompts_editor.json"
	edgeRegPath      = `Software\Microsoft\Edge\NativeMessagingHosts\` + hostName
	chromeRegPath    = `Software\Google\Chrome\NativeMessagingHosts\` + hostName
)

// 扩展 ID
const extensionId = "oklmcegaafghdpdbignoacfgmknleben"

// 请求结构
type Request struct {
	Command  string `json:"command"`
	Path     string `json:"path,omitempty"`
	Content  string `json:"content,omitempty"`
	FileName string `json:"fileName,omitempty"`
}

// 响应结构
type Response struct {
	Status  string      `json:"status"` // "ok" 或 "error"
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

// 文件条目结构
type FileEntry struct {
	Name      string `json:"name"`
	IsDir     bool   `json:"isDir"`
	Extension string `json:"extension,omitempty"`
}

// 提示词条目结构
type PromptEntry struct {
	ID       string `json:"id"`
	Group    string `json:"group"`
	Label    string `json:"label"`
	Template string `json:"template"`
}

func main() {
	// 自动注册
	ensureRegistered()

	// 进入消息循环
	if err := messageLoop(); err != nil {
		if err != io.EOF {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	}
}

// 确保主机已注册
func ensureRegistered() {
	// 获取用户主目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Get home dir error: %v\n", err)
		return
	}
	manifestDir := filepath.Join(homeDir, hostManifestDir)
	if err := os.MkdirAll(manifestDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Create manifest dir error: %v\n", err)
		return
	}
	manifestPath := filepath.Join(manifestDir, hostManifestFile)

	// 写入清单文件
	writeHostManifest(manifestPath)

	// 注册到 Edge
	registerToBrowser(edgeRegPath, manifestPath)

	// 注册到 Chrome
	registerToBrowser(chromeRegPath, manifestPath)

	fmt.Fprintf(os.Stderr, "Native host registered at: %s\n", manifestPath)
}

// 写入主机清单
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
		"name":            hostName,
		"description":     "Bro Chat Prompts Editor Native Host",
		"path":            absExe,
		"type":            "stdio",
		"allowed_origins": []string{"chrome-extension://" + extensionId + "/"},
	}

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// 注册到浏览器
func registerToBrowser(regPath, manifestPath string) error {
	// 检查是否已存在且正确
	k, err := registry.OpenKey(registry.CURRENT_USER, regPath, registry.READ)
	if err == nil {
		defer k.Close()
		val, _, err := k.GetStringValue("")
		if err == nil && val == manifestPath {
			return nil // 已正确注册
		}
	}

	// 创建或更新注册表项
	k, _, err = registry.CreateKey(registry.CURRENT_USER, regPath, registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue("", manifestPath)
}

// 主消息循环
func messageLoop() error {
	stdin := bufio.NewReader(os.Stdin)
	stdout := os.Stdout

	for {
		// 读取消息长度（4 字节）
		var length uint32
		if err := binary.Read(stdin, binary.LittleEndian, &length); err != nil {
			return err
		}
		if length > 10*1024*1024 { // 限制 10MB
			return fmt.Errorf("message too large: %d", length)
		}

		// 读取 JSON 内容
		buf := make([]byte, length)
		if _, err := io.ReadFull(stdin, buf); err != nil {
			return fmt.Errorf("read message: %v", err)
		}

		// 解析请求
		var req Request
		if err := json.Unmarshal(buf, &req); err != nil {
			sendResponse(stdout, Response{Status: "error", Message: "Invalid JSON: " + err.Error()})
			continue
		}

		// 处理命令
		var resp Response
		switch req.Command {
		case "readFile":
			resp = readFile(req.Path)
		case "writeFile":
			resp = writeFile(req.Path, req.Content)
		case "listDir":
			resp = listDir(req.Path)
		case "parsePrompts":
			resp = parsePromptsFile(req.Path)
		case "savePrompts":
			resp = savePromptsFile(req.Path, req.Content)
		case "getPromptsDir":
			resp = getPromptsDir()
		case "createBackup":
			resp = createBackup(req.Path)
		default:
			resp = Response{Status: "error", Message: "Unknown command: " + req.Command}
		}

		sendResponse(stdout, resp)
	}
}

// 发送响应
func sendResponse(w io.Writer, resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		return
	}
	binary.Write(w, binary.LittleEndian, uint32(len(data)))
	w.Write(data)
}

// 读取文件
func readFile(path string) Response {
	data, err := os.ReadFile(path)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}
	return Response{Status: "ok", Data: string(data)}
}

// 写入文件
func writeFile(path, content string) Response {
	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}
	return Response{Status: "ok", Message: "File saved successfully"}
}

// 列出目录
func listDir(path string) Response {
	entries, err := os.ReadDir(path)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
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
	return Response{Status: "ok", Data: files}
}

// 获取提示词目录
func getPromptsDir() Response {
	exePath, err := os.Executable()
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}

	// 获取扩展目录（假设 native_host 与扩展在同一目录或上一级）
	extDir := filepath.Dir(exePath)
	promptsDir := filepath.Join(extDir, "popup", "main", "prompts", "groups")

	// 如果不存在，尝试上一级
	if _, err := os.Stat(promptsDir); os.IsNotExist(err) {
		extDir = filepath.Dir(extDir)
		promptsDir = filepath.Join(extDir, "popup", "main", "prompts", "groups")
	}

	return Response{Status: "ok", Data: promptsDir}
}

// 解析提示词文件
func parsePromptsFile(path string) Response {
	content, err := os.ReadFile(path)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}

	// 从文件名提取 group
	fileName := filepath.Base(path)
	group := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	prompts, err := parsePromptsContent(string(content), group)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}

	return Response{Status: "ok", Data: prompts}
}

// 解析提示词内容
func parsePromptsContent(content string, group string) ([]PromptEntry, error) {
	var prompts []PromptEntry
	lines := strings.Split(content, "\n")

	// 匹配 label 属性：支持单引号和双引号
	labelPattern := regexp.MustCompile(`label:\s*"([^"]+)"`)
	// 匹配 template: 后面的内容
	templateStart := regexp.MustCompile(`template:\s*`)

	var currentLabel string
	var currentTemplate strings.Builder
	inTemplate := false
	var templateQuoteChar string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 提取 label
		if match := labelPattern.FindStringSubmatch(line); match != nil {
			// 保存之前的条目
			if currentLabel != "" && currentTemplate.Len() > 0 {
				prompts = append(prompts, PromptEntry{
					ID:       generateID(),
					Group:    group,
					Label:    currentLabel,
					Template: currentTemplate.String(),
				})
			}
			currentLabel = match[1]
			currentTemplate.Reset()
			inTemplate = false
			continue
		}

		// 检测 template: 行
		if templateStart.MatchString(line) {
			// 提取 template: 后面的内容
			rest := strings.TrimSpace(trimmed[len("template:"):])

			if rest == "" {
				// 内容在下一行
				inTemplate = true
				templateQuoteChar = ""
				continue
			}

			// 确定引号字符
			if strings.HasPrefix(rest, "'") || strings.HasPrefix(rest, "\"") || strings.HasPrefix(rest, "`") {
				templateQuoteChar = string(rest[0])
				// 找结束引号
				startIdx := 1
				endIdx := strings.LastIndex(rest, templateQuoteChar)
				if endIdx > startIdx {
					content := rest[startIdx:endIdx]
					currentTemplate.WriteString(content)
				}
			}
			continue
		}

		// 在模板内收集内容
		if inTemplate {
			if templateQuoteChar == "" {
				// 找引号开始
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
				// 检查结束
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

	// 保存最后一个条目
	if currentLabel != "" && currentTemplate.Len() > 0 {
		prompts = append(prompts, PromptEntry{
			ID:       generateID(),
			Group:    group,
			Label:    currentLabel,
			Template: currentTemplate.String(),
		})
	}

	return prompts, nil
}


// 生成唯一 ID
func generateID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)[:12]
}

// 保存提示词文件
func savePromptsFile(path, content string) Response {
	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}
	return Response{Status: "ok", Message: "File saved successfully"}
}

// 创建备份（不再使用）
func createBackup(path string) Response {
	return Response{Status: "ok", Message: "Backup disabled"}
}
