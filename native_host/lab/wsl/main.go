package main

import (
	"bytes"
	"fmt"
	"os/exec"
)

func main() {
	cmd := exec.Command(
		"wsl",
		"--distribution", "Ubuntu",
		"--",
		"ls", "-R", "~/.claude/skill",
	)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		panic(err)
	}
	fmt.Println(out.String())
}
