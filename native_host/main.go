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

// 扩展 ID（固定值，需要与扩展 manifest.json 中的 key 对应）
const extensionId = "egnmidblehkcglalbbbckcajkahdnjgm"

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

	prompts, err := parsePromptsContent(string(content))
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}

	return Response{Status: "ok", Data: prompts}
}

// 解析提示词内容
func parsePromptsContent(content string) ([]PromptEntry, error) {
	var prompts []PromptEntry
	lines := strings.Split(content, "\n")

	var currentGroup string
	var currentLabel string
	currentTemplate := strings.Builder{}
	inTemplate := false

	// 匹配 export const PROMPTS = { 行
	exportPattern := regexp.MustCompile(`^\s*export\s+const\s+PROMPTS\s*=\s*\{`)
	// 匹配条目开始：xxx: { 或 "xxx": {
	entryStart := regexp.MustCompile(`^\s*(?:\"([^\"]+)\"|([^\s:]+))\s*:\s*\{`)
	// 匹配 group 属性：单引号或双引号
	groupPattern := regexp.MustCompile(`group:\s*['\"]([^'\"]+)['\"]`)
	// 匹配 label 属性：单引号或双引号
	labelPattern := regexp.MustCompile(`label:\s*['\"]([^'\"]+)['\"]`)
	// 匹配 template 开始（后面跟字符串）
	templateStart := regexp.MustCompile("template:\\s*([`'\"]{1})")

	for _, line := range lines {
		// 检测 export const PROMPTS = {
		if exportPattern.MatchString(line) {
			continue
		}

		// 检测条目开始
		if match := entryStart.FindStringSubmatch(line); match != nil {
			// 保存之前的条目
			if currentLabel != "" && currentTemplate.Len() > 0 {
				prompts = append(prompts, PromptEntry{
					ID:       generateID(),
					Group:    currentGroup,
					Label:    currentLabel,
					Template: currentTemplate.String(),
				})
			}
			// 获取键名（可能是双引号或无引号）
			if match[1] != "" {
				currentLabel = match[1]
			} else {
				currentLabel = match[2]
			}
			currentTemplate.Reset()
			inTemplate = false
			continue
		}

		// 提取 group
		if match := groupPattern.FindStringSubmatch(line); match != nil {
			currentGroup = match[1]
		}

		// 提取 label
		if match := labelPattern.FindStringSubmatch(line); match != nil {
			currentLabel = match[1]
		}

		// 检测 template 开始并提取内容
		if tmplMatch := templateStart.FindStringSubmatch(line); tmplMatch != nil {
			inTemplate = true
			quoteChar := tmplMatch[1]
			// 提取模板内容
			templatePart := extractTemplateString(line, quoteChar)
			if templatePart != "" {
				currentTemplate.WriteString(templatePart)
			}
			continue
		}

		// 如果在模板内，收集内容
		if inTemplate {
			trimmed := strings.TrimSpace(line)
			// 检测结束（逗号结尾或闭合括号）
			if strings.HasSuffix(trimmed, ",") {
				// 单行结束
				inTemplate = false
			} else if strings.HasSuffix(trimmed, "},") {
				inTemplate = false
				trimmed = strings.TrimSuffix(trimmed, "},")
				if trimmed != "" {
					currentTemplate.WriteString("\n")
					currentTemplate.WriteString(trimmed)
				}
				continue
			}

			if trimmed != "" && trimmed != "," {
				if currentTemplate.Len() > 0 {
					currentTemplate.WriteString("\n")
				}
				currentTemplate.WriteString(trimmed)
			}
		}
	}

	// 保存最后一个条目
	if currentLabel != "" && currentTemplate.Len() > 0 {
		prompts = append(prompts, PromptEntry{
			ID:       generateID(),
			Group:    currentGroup,
			Label:    currentLabel,
			Template: currentTemplate.String(),
		})
	}

	return prompts, nil
}

// 提取模板字符串
func extractTemplateString(line string, quoteChar string) string {
	// 找到 template: 后面的引号开始位置
	idx := strings.Index(line, quoteChar)
	if idx == -1 {
		return ""
	}
	idx++ // 跳过开始引号

	// 查找结束引号（处理转义）
	result := strings.Builder{}
	for idx < len(line) {
		ch := line[idx]
		if string(ch) == quoteChar {
			// 检查是否是转义字符
			if idx > 0 && line[idx-1] == '\\' {
				result.WriteByte(ch)
				idx++
				continue
			}
			// 结束引号
			break
		}
		result.WriteByte(ch)
		idx++
	}
	return result.String()
}

// 生成唯一 ID
func generateID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)[:12]
}

// 保存提示词文件
func savePromptsFile(path, content string) Response {
	// 先创建备份
	if err := createBackupFile(path); err != nil {
		fmt.Fprintf(os.Stderr, "Backup error: %v\n", err)
	}

	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return Response{Status: "error", Message: err.Error()}
	}
	return Response{Status: "ok", Message: "File saved successfully"}
}

// 创建备份
func createBackup(path string) Response {
	if err := createBackupFile(path); err != nil {
		return Response{Status: "error", Message: err.Error()}
	}
	return Response{Status: "ok", Message: "Backup created"}
}

// 创建备份文件
func createBackupFile(path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	backupPath := path + ".bak"
	return os.WriteFile(backupPath, content, 0644)
}
