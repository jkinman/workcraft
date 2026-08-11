package data

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestTrackerContractMatchesNodeArtifact(t *testing.T) {
	aliases, err := TrackerHeaderAliases()
	if err != nil {
		t.Fatalf("TrackerHeaderAliases: %v", err)
	}
	if aliases["empresa"] != "company" {
		t.Fatalf("empresa alias = %q, want company", aliases["empresa"])
	}
	required, err := TrackerRequiredHeaderFields()
	if err != nil {
		t.Fatalf("TrackerRequiredHeaderFields: %v", err)
	}
	if len(required) < 5 {
		t.Fatalf("expected required header fields from contract, got %v", required)
	}
	label, err := ResolveTrackerStateLabel("entrevista")
	if err != nil {
		t.Fatalf("ResolveTrackerStateLabel: %v", err)
	}
	if label != "Interview" {
		t.Fatalf("alias entrevista = %q, want Interview", label)
	}

	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("repo root: %v", err)
	}
	contractPath := filepath.Join(repoRoot, "templates", "tracker-contract.json")
	raw, err := os.ReadFile(contractPath)
	if err != nil {
		t.Fatalf("read node contract: %v", err)
	}
	var nodeContract struct {
		HeaderAliases map[string]string `json:"headerAliases"`
		States        []struct {
			Label string `json:"label"`
		} `json:"states"`
	}
	if err := json.Unmarshal(raw, &nodeContract); err != nil {
		t.Fatalf("parse node contract: %v", err)
	}
	for k, v := range nodeContract.HeaderAliases {
		if aliases[k] != v {
			t.Fatalf("header alias drift for %q: go=%q node=%q", k, aliases[k], v)
		}
	}
	goStates, err := TrackerCanonicalStates()
	if err != nil {
		t.Fatalf("TrackerCanonicalStates: %v", err)
	}
	if len(goStates) != len(nodeContract.States) {
		t.Fatalf("state count drift: go=%d node=%d", len(goStates), len(nodeContract.States))
	}
}

func TestCanonicalTransitionSyncsTrackerAndReport(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node not available")
	}
	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("repo root: %v", err)
	}
	t.Setenv("CAREER_OPS_SYSTEM_ROOT", repoRoot)

	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	reportsDir := filepath.Join(tempDir, "reports")
	for _, dir := range []string{dataDir, reportsDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("mkdir: %v", err)
		}
	}
	tracker := `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-06-01 | Acme | Engineer | 4.0/5 | Applied | ✅ | [1](reports/001-acme.md) | |
`
	if err := os.WriteFile(filepath.Join(dataDir, "applications.md"), []byte(tracker), 0o644); err != nil {
		t.Fatalf("write tracker: %v", err)
	}
	report := `---
state: applied
state_history:
  - {state: applied, date: "2026-06-01"}
---

**Company:** Acme
`
	if err := os.WriteFile(filepath.Join(reportsDir, "001-acme.md"), []byte(report), 0o644); err != nil {
		t.Fatalf("write report: %v", err)
	}

	apps := ParseApplications(tempDir)
	if len(apps) != 1 {
		t.Fatalf("expected 1 app, got %d", len(apps))
	}
	if err := UpdateApplicationStatus(tempDir, apps[0], "Interview"); err != nil {
		t.Fatalf("UpdateApplicationStatus: %v", err)
	}
	updatedTracker, err := os.ReadFile(filepath.Join(dataDir, "applications.md"))
	if err != nil {
		t.Fatalf("read tracker: %v", err)
	}
	if !strings.Contains(string(updatedTracker), "| Interview |") {
		t.Fatalf("tracker status not updated: %s", updatedTracker)
	}
	updatedReport, err := os.ReadFile(filepath.Join(reportsDir, "001-acme.md"))
	if err != nil {
		t.Fatalf("read report: %v", err)
	}
	if !strings.Contains(string(updatedReport), "state: interview") {
		t.Fatalf("report frontmatter not updated: %s", updatedReport)
	}
	logPath := filepath.Join(dataDir, "status-log.tsv")
	logRaw, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("status log missing: %v", err)
	}
	if !strings.Contains(string(logRaw), "Interview") {
		t.Fatalf("status log missing transition: %s", logRaw)
	}
}
