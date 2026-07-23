import type { PromptOptimizationIssue, PromptOptimizationResult } from '../types';

const conflictPairs: Array<[RegExp, RegExp, string]> = [
  [/no\s+(text|captions|subtitles)/i, /(add|show|include)\s+(text|captions|subtitles)/i, 'The prompt both forbids and requests on-screen text.'],
  [/no\s+(speech|voice|narration|talking)/i, /(say|speaks|narration|voiceover|voice-over)/i, 'The prompt both forbids and requests spoken audio.'],
  [/camera\s+(fixed|locked|static)/i, /(handheld|camera movement|pan|zoom|tracking)/i, 'The camera is described as both static and moving.'],
  [/do not rotate/i, /(turns around|rotates|spins)/i, 'The subject is instructed both not to rotate and to rotate.'],
];

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export function optimizePrompt(prompt: string): PromptOptimizationResult {
  const normalized = prompt.trim();
  const issues: PromptOptimizationIssue[] = [];

  if (normalized.length > 3000) {
    issues.push({
      type: 'length',
      severity: 'high',
      message: 'The prompt is longer than 3,000 characters and may dilute high-priority constraints.',
    });
  } else if (normalized.length > 1800) {
    issues.push({
      type: 'length',
      severity: 'medium',
      message: 'The prompt is long. Consolidating repeated constraints will improve instruction priority.',
    });
  }

  for (const [negativePattern, positivePattern, message] of conflictPairs) {
    if (negativePattern.test(normalized) && positivePattern.test(normalized)) {
      issues.push({ type: 'conflict', severity: 'high', message });
    }
  }

  const lines = normalized
    .split(/\n+|(?<=[.!?])\s+/)
    .map(normalizeLine)
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const fingerprint = line.toLocaleLowerCase().replace(/[^a-z0-9á-ú]+/gi, ' ').trim();
    if (seen.has(fingerprint)) {
      issues.push({
        type: 'redundancy',
        severity: 'medium',
        message: `Repeated instruction removed: “${line.slice(0, 90)}${line.length > 90 ? '…' : ''}”`,
      });
      continue;
    }
    seen.add(fingerprint);
    uniqueLines.push(line);
  }

  const ambiguousTerms = normalized.match(/\b(something|somehow|etc\.?|maybe|nice|beautiful|good quality)\b/gi) ?? [];
  if (ambiguousTerms.length > 0) {
    issues.push({
      type: 'ambiguity',
      severity: 'medium',
      message: `Replace ambiguous wording: ${Array.from(new Set(ambiguousTerms)).join(', ')}.`,
    });
  }

  const sections = {
    objective: uniqueLines.filter((line) => /create|generate|video|image|objective|goal/i.test(line)),
    continuity: uniqueLines.filter((line) => /same|identical|preserve|reference|consistent/i.test(line)),
    action: uniqueLines.filter((line) => /move|walk|turn|show|hold|camera|action/i.test(line)),
    constraints: uniqueLines.filter((line) => /\b(no|never|do not|without|avoid)\b/i.test(line)),
  };

  const categorized = new Set(Object.values(sections).flat());
  const details = uniqueLines.filter((line) => !categorized.has(line));
  const outputParts: string[] = [];

  const addSection = (title: string, values: string[]) => {
    if (values.length === 0) return;
    outputParts.push(`${title}:\n${values.map((value) => `- ${value}`).join('\n')}`);
  };

  addSection('OBJECTIVE', sections.objective);
  addSection('REFERENCE & CONTINUITY', sections.continuity);
  addSection('SCENE & ACTION', [...details, ...sections.action]);
  addSection('NEGATIVE CONSTRAINTS', sections.constraints);

  const optimizedPrompt = outputParts.join('\n\n') || normalized;
  const severityPenalty = issues.reduce((total, issue) => {
    if (issue.severity === 'high') return total + 15;
    if (issue.severity === 'medium') return total + 7;
    return total + 3;
  }, 0);
  const structureBonus = outputParts.length >= 3 ? 8 : 0;
  const qualityScore = Math.max(0, Math.min(100, 88 - severityPenalty + structureBonus));

  return {
    originalLength: normalized.length,
    optimizedLength: optimizedPrompt.length,
    issues,
    optimizedPrompt,
    qualityScore,
  };
}
