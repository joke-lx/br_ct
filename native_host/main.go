package main

import (
	"fmt"
	"io"
	"os"

	"brochat_native_host/internal/executor"
	"brochat_native_host/internal/fileops"
	"brochat_native_host/internal/gitmon"
	"brochat_native_host/internal/handler"
	"brochat_native_host/internal/protocol"
	"brochat_native_host/internal/prompts"
	"brochat_native_host/internal/register"
)

func main() {
	register.EnsureRegistered()

	registry := handler.NewRegistry()

	// 文件操作
	registry.Register("readFile", fileops.ReadFile)
	registry.Register("writeFile", fileops.WriteFile)
	registry.Register("listDir", fileops.ListDir)
	registry.Register("scanSkills", fileops.ScanSkills)
	registry.Register("syncSkillDir", fileops.SyncSkillDir)

	// 提示词
	registry.Register("parsePrompts", prompts.ParsePromptsFile)
	registry.Register("savePrompts", prompts.SavePromptsFile)
	registry.Register("getPromptsDir", prompts.GetPromptsDir)
	registry.Register("createBackup", prompts.CreateBackup)

	// 命令执行与子进程管理
	registry.Register("startProcess", executor.StartProcess)
	registry.Register("stopProcess", executor.StopProcess)
	registry.Register("listProcesses", executor.ListProcesses)
	registry.Register("removeProcess", executor.RemoveProcess)

	// Git 监控
	registry.Register("gitStatus", gitmon.GitStatus)
	registry.Register("gitPull", gitmon.GitPull)
	registry.Register("gitPush", gitmon.GitPush)
	registry.Register("gitBatchStatus", gitmon.GitBatchStatus)
	registry.Register("gitBatchPull", gitmon.GitBatchPull)
	registry.Register("gitBatchPush", gitmon.GitBatchPush)
	registry.Register("gitAutoCommitAndPush", gitmon.GitAutoCommitAndPush)

	// 消息循环
	stdin := os.Stdin
	stdout := os.Stdout

	for {
		req, err := protocol.ReadMessage(stdin)
		if err != nil {
			if err != io.EOF {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			}
			break
		}

		resp := registry.Handle(req.Command, req)
		protocol.SendResponse(stdout, resp)
	}
}
