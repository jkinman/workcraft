package data

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type transitionResult struct {
	Success      bool   `json:"success"`
	Changed      bool   `json:"changed"`
	Num          int    `json:"trackerNum"`
	OldStatus    string `json:"previous"`
	NewStatus    string `json:"state"`
	StatusLogged bool   `json:"statusLogged"`
	Error        string `json:"error"`
}

// resolveSystemRoot finds the career-ops repo root containing set-status.mjs.
func resolveSystemRoot(careerOpsPath string) (string, error) {
	if override := os.Getenv("CAREER_OPS_SYSTEM_ROOT"); override != "" {
		if _, err := os.Stat(filepath.Join(override, "set-status.mjs")); err == nil {
			return override, nil
		}
	}
	dir := careerOpsPath
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "set-status.mjs")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("set-status.mjs not found near %s (set CAREER_OPS_SYSTEM_ROOT)", careerOpsPath)
}

// runCanonicalTransition updates tracker + report frontmatter + status log via Node.
func runCanonicalTransition(careerOpsPath string, reportNumber, newStatus, notesAppend, source string) error {
	if reportNumber == "" {
		return fmt.Errorf("application has no report number — cannot run canonical transition")
	}
	canonical, err := ResolveTrackerStateLabel(newStatus)
	if err != nil {
		return err
	}

	systemRoot, err := resolveSystemRoot(careerOpsPath)
	if err != nil {
		return err
	}

	args := []string{
		filepath.Join(systemRoot, "lib", "tracker", "cli-transition.mjs"),
		"--report", reportNumber,
		"--state", canonical,
		"--source", source,
		"--json",
	}
	if notesAppend != "" {
		args = append(args, "--note", notesAppend)
	}

	cmd := exec.Command("node", args...)
	cmd.Dir = systemRoot
	cmd.Env = append(os.Environ(), "CAREER_OPS_DATA_ROOT="+careerOpsPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("canonical transition failed: %w: %s", err, strings.TrimSpace(string(out)))
	}

	var result transitionResult
	if err := json.Unmarshal(out, &result); err != nil {
		return fmt.Errorf("parse transition output: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	if !result.Success {
		if result.Error != "" {
			return fmt.Errorf("%s", result.Error)
		}
		return fmt.Errorf("canonical transition rejected")
	}
	return nil
}
