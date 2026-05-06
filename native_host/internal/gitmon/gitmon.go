package gitmon

import (
	"fmt"
	"os/exec"
	"strings"

	"brochat_native_host/internal/protocol"
)

type GitStatusInfo struct {
	Dir          string   `json:"dir"`
	Branch       string   `json:"branch"`
	Ahead        int      `json:"ahead"`
	Behind       int      `json:"behind"`
	Staged       []string `json:"staged"`
	Modified     []string `json:"modified"`
	Untracked    []string `json:"untracked"`
	StagedCount  int      `json:"stagedCount"`
	ModCount     int      `json:"modCount"`
	UntrackCount int      `json:"untrackCount"`
	Clean        bool     `json:"clean"`
	Error        string   `json:"error,omitempty"`
}

type GitOperationResult struct {
	Dir     string `json:"dir"`
	Output  string `json:"output"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func runGit(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func GitStatus(req protocol.Request) protocol.Response {
	info := gitStatusForDir(req.Path)
	if info.Error != "" {
		return protocol.Response{Status: "error", Message: info.Error}
	}
	return protocol.Response{Status: "ok", Data: info}
}

func GitPull(req protocol.Request) protocol.Response {
	out, err := runGit(req.Path, "pull")
	result := GitOperationResult{Dir: req.Path, Output: out}
	if err != nil {
		result.Error = err.Error()
	} else {
		result.Success = true
	}
	return protocol.Response{Status: "ok", Data: result}
}

func GitPush(req protocol.Request) protocol.Response {
	out, err := runGit(req.Path, "push")
	result := GitOperationResult{Dir: req.Path, Output: out}
	if err != nil {
		result.Error = err.Error()
	} else {
		result.Success = true
	}
	return protocol.Response{Status: "ok", Data: result}
}

func GitBatchStatus(req protocol.Request) protocol.Response {
	var results []GitStatusInfo
	for _, dir := range req.Dirs {
		results = append(results, gitStatusForDir(dir))
	}
	return protocol.Response{Status: "ok", Data: results}
}

func GitBatchPull(req protocol.Request) protocol.Response {
	var results []GitOperationResult
	for _, dir := range req.Dirs {
		out, err := runGit(dir, "pull")
		result := GitOperationResult{Dir: dir, Output: out}
		if err != nil {
			result.Error = err.Error()
		} else {
			result.Success = true
		}
		results = append(results, result)
	}
	return protocol.Response{Status: "ok", Data: results}
}

func GitBatchPush(req protocol.Request) protocol.Response {
	var results []GitOperationResult
	for _, dir := range req.Dirs {
		out, err := runGit(dir, "push")
		result := GitOperationResult{Dir: dir, Output: out}
		if err != nil {
			result.Error = err.Error()
		} else {
			result.Success = true
		}
		results = append(results, result)
	}
	return protocol.Response{Status: "ok", Data: results}
}

func gitStatusForDir(dir string) GitStatusInfo {
	info := GitStatusInfo{Dir: dir}

	if out, err := runGit(dir, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		info.Branch = out
	} else {
		info.Error = fmt.Sprintf("无法读取分支: %v", err)
		return info
	}

	if out, err := runGit(dir, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"); err == nil {
		parts := strings.Split(out, "\t")
		if len(parts) == 2 {
			fmt.Sscanf(parts[0], "%d", &info.Behind)
			fmt.Sscanf(parts[1], "%d", &info.Ahead)
		}
	}

	// -uall: 列出所有未跟踪文件（不折叠为目录）
	if out, err := runGit(dir, "status", "--porcelain", "-uall"); err == nil {
		lines := strings.Split(out, "\n")
		for _, line := range lines {
			if len(line) < 4 {
				continue
			}
			x := line[0] // index 状态
			y := line[1] // worktree 状态
			file := line[3:]

			if x == '?' && y == '?' {
				info.Untracked = append(info.Untracked, file)
			} else if x != ' ' && x != '?' {
				info.Staged = append(info.Staged, file)
			}
			if y != ' ' && y != '?' {
				info.Modified = append(info.Modified, file)
			}
		}
	}

	info.StagedCount = len(info.Staged)
	info.ModCount = len(info.Modified)
	info.UntrackCount = len(info.Untracked)
	info.Clean = info.StagedCount == 0 && info.ModCount == 0 && info.UntrackCount == 0 && info.Ahead == 0 && info.Behind == 0
	return info
}
