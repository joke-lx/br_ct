package executor

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"brochat_native_host/internal/protocol"
)

type ProcessInfo struct {
	Pid       int       `json:"pid"`
	Name      string    `json:"name"`
	Cmd       string    `json:"cmd"`
	Args      []string `json:"args"`
	WorkDir   string    `json:"workDir"`
	LogFile   string    `json:"logFile"`
	StartTime time.Time `json:"startTime"`
}

type ProcessStatus struct {
	ProcessInfo
	Running bool `json:"running"`
}

var stateDir string

func init() {
	homeDir, _ := os.UserHomeDir()
	stateDir = filepath.Join(homeDir, ".bro_chat_native_host")
}

func stateFilePath() string {
	return filepath.Join(stateDir, "processes.json")
}

func logsDirPath() string {
	return filepath.Join(stateDir, "logs")
}

func ensureLogsDir() error {
	dir := logsDirPath()
	os.MkdirAll(dir, 0755)
	return nil
}

func loadProcesses() ([]ProcessInfo, error) {
	path := stateFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}
	var processes []ProcessInfo
	if err := json.Unmarshal(data, &processes); err != nil {
		return nil, err
	}
	return processes, nil
}

func saveProcesses(processes []ProcessInfo) error {
	os.MkdirAll(stateDir, 0755)
	data, err := json.MarshalIndent(processes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(stateFilePath(), data, 0644)
}

func isProcessRunning(pid int) bool {
	const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
	handle, err := syscall.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return false
	}
	syscall.CloseHandle(handle)
	return true
}

func StartProcess(req protocol.Request) protocol.Response {
	args := req.Args
	if args == nil {
		args = []string{}
	}

	if err := ensureLogsDir(); err != nil {
		return protocol.Response{Status: "error", Message: fmt.Sprintf("创建日志目录失败: %v", err)}
	}

	// 生成日志文件名: {Name}_{Pid}_{Unix时间戳}.log
	logName := fmt.Sprintf("%s_%d_%d.log", sanitizeFileName(req.Name), os.Getpid(), time.Now().Unix())
	logPath := filepath.Join(logsDirPath(), logName)

	cmd := exec.Command(req.Cmd, args...)
	cmd.Dir = req.WorkDir
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}

	// 打开日志文件捕获 stdout 和 stderr
	logFile, err := os.Create(logPath)
	if err != nil {
		return protocol.Response{Status: "error", Message: fmt.Sprintf("创建日志文件失败: %v", err)}
	}
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	if err := cmd.Start(); err != nil {
		logFile.Close()
		os.Remove(logPath)
		return protocol.Response{Status: "error", Message: fmt.Sprintf("启动失败: %v", err)}
	}

	pid := cmd.Process.Pid
	cmd.Process.Release()
	logFile.Close()

	info := ProcessInfo{
		Pid:       pid,
		Name:      req.Name,
		Cmd:       req.Cmd,
		Args:      args,
		WorkDir:   req.WorkDir,
		LogFile:   logPath,
		StartTime: time.Now(),
	}

	processes, _ := loadProcesses()
	processes = append(processes, info)
	saveProcesses(processes)

	return protocol.Response{Status: "ok", Data: info}
}

func StopProcess(req protocol.Request) protocol.Response {
	pid := req.Pid
	if pid == 0 {
		return protocol.Response{Status: "error", Message: "缺少 pid 参数"}
	}

	proc, err := os.FindProcess(pid)
	if err != nil {
		return protocol.Response{Status: "error", Message: "进程不存在"}
	}

	if err := proc.Kill(); err != nil {
		return protocol.Response{Status: "error", Message: fmt.Sprintf("停止失败: %v", err)}
	}

	// 从状态文件移除
	processes, _ := loadProcesses()
	var remaining []ProcessInfo
	for _, p := range processes {
		if p.Pid != pid {
			remaining = append(remaining, p)
		}
	}
	saveProcesses(remaining)

	return protocol.Response{Status: "ok", Message: fmt.Sprintf("进程 %d 已停止", pid)}
}

func ListProcesses(req protocol.Request) protocol.Response {
	processes, _ := loadProcesses()

	var result []ProcessStatus
	var alive []ProcessInfo
	for _, p := range processes {
		running := isProcessRunning(p.Pid)
		result = append(result, ProcessStatus{ProcessInfo: p, Running: running})
		if running {
			alive = append(alive, p)
		}
	}
	saveProcesses(alive)

	return protocol.Response{Status: "ok", Data: result}
}

func RemoveProcess(req protocol.Request) protocol.Response {
	processes, _ := loadProcesses()
	var remaining []ProcessInfo
	for _, p := range processes {
		if p.Pid != req.Pid {
			remaining = append(remaining, p)
		}
	}
	saveProcesses(remaining)
	return protocol.Response{Status: "ok", Message: "已从列表移除"}
}

// sanitizeFileName 替换文件名中的非法字符
func sanitizeFileName(name string) string {
	const illegalChars = `/:\*?"<>|`
	for _, c := range illegalChars {
		name = replaceChar(name, c, '_')
	}
	return name
}

func replaceChar(s string, old rune, new rune) string {
	out := make([]rune, len(s))
	for i, r := range s {
		if r == old {
			out[i] = new
		} else {
			out[i] = r
		}
	}
	return string(out)
}
