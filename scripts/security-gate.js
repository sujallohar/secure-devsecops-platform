#!/usr/bin/env node

/**
 * scripts/security-gate.js
 * 
 * Purpose: A plain Node.js security gate engine for container scanning.
 * It reads the Trivy JSON report, applies policy thresholds from gate-config.yaml,
 * factors in approved exceptions from exceptions.yaml, and fails the CI build
 * if thresholds are breached or if any exception has expired.
 * 
 * Threat addressed: Deployment of containers with known vulnerable packages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const POLICY_DIR = process.env.POLICY_DIR || path.join(ROOT_DIR, 'security/policy');

function loadYaml(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error loading ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function runGate() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("Usage: node security-gate.js <path-to-trivy-report.json>");
    process.exit(1);
  }

  // 1. Read configurations
  const configYaml = loadYaml(path.join(POLICY_DIR, 'gate-config.yaml'));
  const exceptionsYaml = loadYaml(path.join(POLICY_DIR, 'exceptions.yaml'));

  const gateConfig = configYaml.container_gate;
  const thresholds = gateConfig.thresholds;
  const exceptions = (exceptionsYaml && exceptionsYaml.exceptions) ? exceptionsYaml.exceptions : [];

  // 2. Validate exception dates immediately
  const now = new Date();
  for (const exp of exceptions) {
    const expiresOn = new Date(exp.expires_on);
    if (expiresOn < now) {
      console.error(`❌ FATAL: Exception for ${exp.cve_id} expired on ${exp.expires_on}. Please review and remediate immediately.`);
      if (gateConfig.fail_on_expired_exceptions) {
         process.exit(1);
      }
    }
  }

  // 3. Read Trivy JSON
  let reportRaw;
  try {
    reportRaw = fs.readFileSync(reportPath, 'utf8');
  } catch (err) {
    console.error(`Error reading report file ${reportPath}: ${err.message}`);
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(reportRaw);
  } catch (err) {
    console.error(`Error parsing JSON report ${reportPath}: ${err.message}`);
    process.exit(1);
  }

  // 4. Count vulnerabilities by severity
  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0
  };

  const results = report.Results || [];
  for (const result of results) {
    const vulns = result.Vulnerabilities || [];
    for (const v of vulns) {
      // Apply ignore_unfixed policy
      if (gateConfig.ignore_unfixed && !v.FixedVersion) {
        continue;
      }

      // Check exceptions
      const matchedException = exceptions.find(e => e.cve_id === v.VulnerabilityID);
      if (matchedException) {
        continue; // Excluded by valid exception
      }

      const severity = v.Severity ? v.Severity.toUpperCase() : 'UNKNOWN';
      if (counts[severity] !== undefined) {
        counts[severity]++;
      } else {
        counts.UNKNOWN++;
      }
    }
  }

  // 5. Evaluate against thresholds
  let pass = true;
  const breachMessages = [];
  
  for (const [severity, maxAllowed] of Object.entries(thresholds)) {
    if (counts[severity] > maxAllowed) {
      pass = false;
      breachMessages.push(`- **${severity}**: Found ${counts[severity]}, maximum allowed is ${maxAllowed}`);
    }
  }

  // 6. Write Markdown Summary to GITHUB_STEP_SUMMARY or stdout
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  let markdown = `### Security Gate Result: ${pass ? '✅ PASS' : '❌ FAIL'}\n\n`;
  markdown += `| Severity | Found | Allowed |\n`;
  markdown += `|----------|-------|---------|\n`;
  for (const [sev, allowed] of Object.entries(thresholds)) {
    markdown += `| ${sev} | ${counts[sev]} | ${allowed} |\n`;
  }
  
  if (!pass) {
    markdown += `\n**Thresholds Breached:**\n${breachMessages.join('\n')}\n`;
  }

  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, markdown);
    } catch(err) {
      console.warn(`Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  } else {
    // Also print to console for local testing if no summary file
    console.log(markdown);
  }

  // 7. Exit appropriately
  if (!pass && gateConfig.fail_on_threshold_breach) {
    console.error("Security gate failed due to threshold breaches.");
    process.exit(1);
  }

  console.log("Security gate passed successfully.");
  process.exit(0);
}

runGate();
