import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'gate');

before(() => {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Mock policy directory
  const POLICY_DIR = path.join(FIXTURES_DIR, 'policy');
  fs.mkdirSync(POLICY_DIR, { recursive: true });

  // 1. Gate Config
  fs.writeFileSync(path.join(POLICY_DIR, 'gate-config.yaml'), `
container_gate:
  ignore_unfixed: true
  thresholds:
    CRITICAL: 0
    HIGH: 0
    MEDIUM: 5
    LOW: 20
  fail_on_threshold_breach: true
  fail_on_expired_exceptions: true
`);

  // 2. Exceptions Config (Valid)
  fs.writeFileSync(path.join(POLICY_DIR, 'exceptions-valid.yaml'), `
exceptions:
  - cve_id: "CVE-VALID"
    expires_on: "2030-01-01"
`);

  // 3. Exceptions Config (Expired)
  fs.writeFileSync(path.join(POLICY_DIR, 'exceptions-expired.yaml'), `
exceptions:
  - cve_id: "CVE-EXPIRED"
    expires_on: "2020-01-01"
`);

  // 4. Trivy Clean
  fs.writeFileSync(path.join(FIXTURES_DIR, 'trivy-clean.json'), JSON.stringify({
    Results: [{ Vulnerabilities: [] }]
  }));

  // 5. Trivy Over Threshold
  fs.writeFileSync(path.join(FIXTURES_DIR, 'trivy-over-threshold.json'), JSON.stringify({
    Results: [{
      Vulnerabilities: [
        { VulnerabilityID: "CVE-HIGH-1", Severity: "HIGH", FixedVersion: "1.0" }
      ]
    }]
  }));

  // 6. Trivy At Threshold
  fs.writeFileSync(path.join(FIXTURES_DIR, 'trivy-at-threshold.json'), JSON.stringify({
    Results: [{
      Vulnerabilities: Array(5).fill(null).map((_, i) => ({ VulnerabilityID: `CVE-MED-${i}`, Severity: "MEDIUM", FixedVersion: "1.0" }))
    }]
  }));

  // 7. Trivy With Exception
  fs.writeFileSync(path.join(FIXTURES_DIR, 'trivy-with-exception.json'), JSON.stringify({
    Results: [{
      Vulnerabilities: [
        { VulnerabilityID: "CVE-VALID", Severity: "CRITICAL", FixedVersion: "1.0" }
      ]
    }]
  }));
  
  // 8. Trivy Unfixed
  fs.writeFileSync(path.join(FIXTURES_DIR, 'trivy-unfixed.json'), JSON.stringify({
    Results: [{
      Vulnerabilities: [
        { VulnerabilityID: "CVE-CRIT-UNFIXED", Severity: "CRITICAL" } // No FixedVersion
      ]
    }]
  }));
});

describe('Security Gate Engine', () => {
  const gateScript = path.join(__dirname, '..', '..', 'scripts', 'security-gate.js');

  const runGate = (reportFile, exceptionsFile = 'exceptions-valid.yaml') => {
    const reportPath = path.join(FIXTURES_DIR, reportFile);
    const policyDir = path.join(FIXTURES_DIR, 'policy');
    
    const summaryFile = path.join(FIXTURES_DIR, 'summary.md');
    if (fs.existsSync(summaryFile)) fs.rmSync(summaryFile);
    
    // Copy the chosen exceptions to exceptions.yaml so the script finds it
    fs.copyFileSync(path.join(policyDir, exceptionsFile), path.join(policyDir, 'exceptions.yaml'));

    let output = '';
    let status = 0;
    try {
      output = execSync(`node "${gateScript}" "${reportPath}"`, {
        env: { ...process.env, POLICY_DIR: policyDir, GITHUB_STEP_SUMMARY: summaryFile },
        encoding: 'utf8'
      });
    } catch (err) {
      status = err.status;
      output = err.stdout + (err.stderr || '');
    }
    const summary = fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, 'utf8') : '';
    return { status, output, summary };
  };

  it('should pass when report is clean', () => {
    const { status, output } = runGate('trivy-clean.json');
    assert.strictEqual(status, 0);
    assert.ok(output.includes('Security gate passed successfully'));
  });

  it('should fail when thresholds are exceeded', () => {
    const { status, output, summary } = runGate('trivy-over-threshold.json');
    assert.strictEqual(status, 1);
    assert.ok(output.includes('Security gate failed due to threshold breaches'));
    assert.ok(summary.includes('Found 1, maximum allowed is 0'));
  });

  it('should pass when at threshold limit', () => {
    const { status, output } = runGate('trivy-at-threshold.json');
    assert.strictEqual(status, 0);
    assert.ok(output.includes('Security gate passed successfully'));
  });

  it('should pass when vulnerability is matched by valid exception', () => {
    const { status, output } = runGate('trivy-with-exception.json');
    assert.strictEqual(status, 0);
    assert.ok(output.includes('Security gate passed successfully'));
  });
  
  it('should ignore unfixed vulnerabilities', () => {
    const { status, output } = runGate('trivy-unfixed.json');
    assert.strictEqual(status, 0);
    assert.ok(output.includes('Security gate passed successfully'));
  });

  it('should fail if any exception is expired', () => {
    const { status, output } = runGate('trivy-clean.json', 'exceptions-expired.yaml');
    assert.strictEqual(status, 1);
    assert.ok(output.includes('FATAL: Exception for CVE-EXPIRED expired'));
  });
});
