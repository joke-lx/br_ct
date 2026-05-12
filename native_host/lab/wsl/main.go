package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

func main() {
	cmd := exec.Command(
		"wsl",
		"--distribution", "Ubuntu",
		"--",
		"bash", "-c", "find ~/.claude/skills -print | sort",
	)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		fmt.Println("Error:", err)
		return
	}

	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	fmt.Println(strings.Join(buildTree(lines), "\n"))
}

func buildTree(lines []string) []string {
	if len(lines) == 0 {
		return nil
	}

	var result []string
	prefix := strings.TrimSuffix(lines[0], "/") + "/"
	result = append(result, prefix)

	for i, line := range lines[1:] {
		rel := strings.TrimPrefix(line, prefix)
		if rel == "" {
			continue
		}
		parts := strings.Split(rel, "/")
		depth := len(parts) - 1
		name := parts[depth]

		var sb strings.Builder
		for j := 0; j < depth; j++ {
			sb.WriteString("│   ")
		}
		isLast := i == len(lines)-2
		if isLast {
			sb.WriteString("└── ")
		} else {
			sb.WriteString("├── ")
		}
		sb.WriteString(name)
		result = append(result, sb.String())
	}

	return result
}
