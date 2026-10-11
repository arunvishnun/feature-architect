#!/usr/bin/env node
/**
 * Heuristic Markdown writing review. This is NOT a grammar checker or formal
 * ASD-STE100 evaluator. Manual review of the 12-point rubric is still required.
 * Node >= 18, no external dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const strict = process.argv.includes("--strict");
const files = process.argv.slice(2).filter(item => item !== "--strict");
if (!files.length) {
  console.error('Usage: node scripts/check-writing.mjs <markdown-files...>');
  process.exit(1);
}
let warnings = 0;
for (const name of files) {
  const file = path.resolve(name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error(`Missing file: ${name}`);
    process.exitCode = 1;
    continue;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inCode = false;
  console.log(`\nReviewing ${name}`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(```|~~~)/.test(line)) { inCode = !inCode; continue; }
    if (inCode || !line || /^#{1,6}\s/.test(line) || /^\|/.test(line) || /^[-*_]{3,}$/.test(line) || /^!\[/.test(line)) continue;
    // Extract explanatory prose from bullets and numbered list items.
    const prose = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/^>\s*/, '').trim();
    if (!prose || prose.startsWith('[') || /^\*\*[^*]+:\*\*/.test(prose) || /^\d+\.\d+\./.test(prose)) continue;
    // Ignore isolated code-like descriptions and short labels.
    if (/^[`\w/-]+:\s*`/.test(prose) || /^\[[^\]]+\]\([^)]+\)$/.test(prose)) continue;
    const plain = prose.replace(/`[^`]*`/g, 'CODE').replace(/\[[^\]]+\]\([^)]+\)/g, 'LINK').replace(/https?:\/\/\S+/g, 'URL').replace(/\*\*/g, '');
    const sentences = plain.split(/(?<=[.!?])\s+(?=[A-Z\d])/).filter(Boolean);
    for (const part of sentences) {
      const words = part.match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu) || [];
      const limit = /^\d+[.)]\s/.test(line) || /^[-*+]\s/.test(line) ? 20 : 25;
      if (words.length > limit) {
        warnings++;
        console.log(`  Line ${i + 1}: long_sentence (${words.length} words; preferred ${limit}).`);
      }
    }
    if (/^[-*+]\s/.test(line) && /[a-zA-Z]/.test(plain) && !/[.!?;:]$/.test(plain) && !/^\*\*.*\*\*$/.test(prose)) {
      warnings++;
      console.log(`  Line ${i + 1}: possible_fragment (explanatory bullet may lack a complete sentence).`);
    }
  }
}
console.log(`\nFound ${warnings} heuristic warning(s). Review manually; this is not a compliance score.`);
if (strict && warnings > 0) process.exitCode = 1;
