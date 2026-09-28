#!/usr/bin/env node
/**
 * AST-based Static Analysis for JavaScript/TypeScript using @babel/parser
 * Receives code via stdin or file argument, parses AST, runs security/quality checks,
 * and outputs structured JSON findings.
 */

const fs = require('fs');

let parser = null;
let traverse = null;
try {
  parser = require('@babel/parser');
  traverse = require('@babel/traverse').default || require('@babel/traverse');
} catch (e) {
  // Graceful fallback to regex if @babel/parser is not yet installed in local environment
}

function analyzeWithBabel(code, filePath) {
  const findings = [];
  try {
    const ast = parser.parse(code, {
      sourceType: 'unambiguous',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'asyncGenerators',
        'dynamicImport',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'nullishCoalescingOperator'
      ],
      errorRecovery: true
    });

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        // Check for eval()
        if (callee.type === 'Identifier' && callee.name === 'eval') {
          findings.push({
            file_path: filePath,
            line_number: callee.loc ? callee.loc.start.line : 1,
            severity: 'critical',
            category: 'security',
            rule_id: 'JS_SEC001',
            message: 'Avoid dynamic code execution via eval(), which introduces Remote Code Execution vulnerabilities.'
          });
        }
        // Check for Function() constructor
        if (callee.type === 'Identifier' && callee.name === 'Function') {
          findings.push({
            file_path: filePath,
            line_number: callee.loc ? callee.loc.start.line : 1,
            severity: 'critical',
            category: 'security',
            rule_id: 'JS_SEC002',
            message: 'Function constructor acts like eval() and allows arbitrary string code execution.'
          });
        }
        // Check for document.write()
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'document' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'write'
        ) {
          findings.push({
            file_path: filePath,
            line_number: callee.loc ? callee.loc.start.line : 1,
            severity: 'high',
            category: 'security',
            rule_id: 'JS_SEC003',
            message: 'document.write() bypasses DOM safety checks and facilitates Cross-Site Scripting (XSS).'
          });
        }
      },
      DebuggerStatement(path) {
        findings.push({
          file_path: filePath,
          line_number: path.node.loc ? path.node.loc.start.line : 1,
          severity: 'low',
          category: 'style',
          rule_id: 'JS_BUG001',
          message: 'Found debugger statement leftover from debugging. Remove before merging.'
        });
      },
      AssignmentExpression(path) {
        // innerHTML assignment
        if (
          path.node.left.type === 'MemberExpression' &&
          path.node.left.property &&
          path.node.left.property.name === 'innerHTML'
        ) {
          findings.push({
            file_path: filePath,
            line_number: path.node.loc ? path.node.loc.start.line : 1,
            severity: 'high',
            category: 'security',
            rule_id: 'JS_SEC004',
            message: 'Direct assignment to innerHTML can lead to Cross-Site Scripting (XSS). Prefer textContent or sanitized DOM nodes.'
          });
        }
      }
    });
  } catch (err) {
    // If AST parsing fails completely, report parsing error or fallback to line checks
    findings.push(...fallbackRegexAnalysis(code, filePath));
  }
  return findings;
}

function fallbackRegexAnalysis(code, filePath) {
  const findings = [];
  const lines = code.split('\n');
  const secretPattern = /(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    if (/\beval\s*\(/.test(line)) {
      findings.push({
        file_path: filePath,
        line_number: lineNum,
        severity: 'critical',
        category: 'security',
        rule_id: 'JS_SEC001',
        message: 'Avoid dynamic code execution via eval(), which introduces Remote Code Execution vulnerabilities.'
      });
    }
    if (/\bdebugger\b/.test(line)) {
      findings.push({
        file_path: filePath,
        line_number: lineNum,
        severity: 'low',
        category: 'style',
        rule_id: 'JS_BUG001',
        message: 'Found debugger statement leftover from debugging. Remove before merging.'
      });
    }
    if (/\.innerHTML\s*=/.test(line)) {
      findings.push({
        file_path: filePath,
        line_number: lineNum,
        severity: 'high',
        category: 'security',
        rule_id: 'JS_SEC004',
        message: 'Direct assignment to innerHTML can lead to Cross-Site Scripting (XSS).'
      });
    }
    if (secretPattern.test(line)) {
      findings.push({
        file_path: filePath,
        line_number: lineNum,
        severity: 'high',
        category: 'security',
        rule_id: 'JS_SEC005',
        message: 'Possible hardcoded secret or credential token detected in source code.'
      });
    }
  });
  return findings;
}

function main() {
  const filePath = process.argv[2] || 'unknown.js';
  let code = '';

  if (process.argv[3]) {
    code = fs.readFileSync(process.argv[3], 'utf-8');
  } else {
    try {
      code = fs.readFileSync(0, 'utf-8');
    } catch (e) {
      code = '';
    }
  }

  let findings = [];
  if (parser && traverse) {
    findings = analyzeWithBabel(code, filePath);
  } else {
    findings = fallbackRegexAnalysis(code, filePath);
  }

  console.log(JSON.stringify(findings));
}

main();
