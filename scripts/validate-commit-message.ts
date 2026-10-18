import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const conventionalHeader =
  /^(?:feat|fix|refactor|docs|style|test|perf|build|ci|chore|revert|init)(?:\([^()\r\n]+\))?!?: \S[^\r\n]*$/u;

export function isValidCommitMessage(message: string): boolean {
  const [header = ''] = message.replace(/\r\n/gu, '\n').split('\n');
  return conventionalHeader.test(header);
}

const entryPath = process.argv[1];

if (
  entryPath !== undefined &&
  resolve(entryPath) === fileURLToPath(import.meta.url)
) {
  const messagePath = process.argv[2];

  if (messagePath === undefined) {
    process.stderr.write(
      'Usage: node scripts/validate-commit-message.ts <message-file>\n',
    );
    process.exitCode = 1;
  } else if (!isValidCommitMessage(readFileSync(messagePath, 'utf8'))) {
    process.stderr.write(
      'Invalid commit message. Use a lowercase Conventional Commit type and an imperative description.\nExample: feat(ui): add setup screen\n',
    );
    process.exitCode = 1;
  }
}
