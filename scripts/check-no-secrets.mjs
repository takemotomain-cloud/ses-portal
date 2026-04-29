import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith('credentials/'))
  .filter((file) => file !== 'scripts/check-no-secrets.mjs');

const patterns = [
  { label: 'Anthropic API key', regex: /sk-ant-[A-Za-z0-9_-]+/g },
  { label: 'OpenAI API key', regex: /sk-[A-Za-z0-9]{20,}/g },
  { label: 'Resend API key', regex: /re_[A-Za-z0-9]{20,}/g },
  { label: 'Google OAuth client secret', regex: /GOCSPX-[A-Za-z0-9_-]+/g },
  { label: 'Google API key', regex: /AIza[0-9A-Za-z\-_]{20,}/g },
  {
    label: 'Private key material',
    regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  },
];

const findings = [];

for (const file of trackedFiles) {
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${pattern.label}: ${file}`);
    }
    pattern.regex.lastIndex = 0;
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found in tracked files:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('No obvious secrets found in tracked files.');
