import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidCommitMessage } from './validate-commit-message.ts';

void test('accepts RS School Conventional Commit headers', () => {
  const validMessages = [
    'chore: initialize game repository',
    'feat(ui): add setup screen',
    'fix(storage): handle invalid saved data\r\n\r\nExplain the change.',
    'refactor!: simplify state transitions',
    'feat(game)!: change the recipe format\n\nBREAKING CHANGE: use ranges',
    'revert: remove unused controls',
    'init: set up project',
  ];

  for (const message of validMessages) {
    assert.equal(isValidCommitMessage(message), true, message);
  }
});

void test('rejects malformed, empty and uppercase headers', () => {
  const invalidMessages = [
    '',
    'update files',
    'Feat: add setup screen',
    'unknown: add setup screen',
    'feat:add setup screen',
    'feat: ',
    'feat:  ',
    'feat(): add setup screen',
    'feat(ui: add setup screen',
    '\nfeat: add setup screen',
  ];

  for (const message of invalidMessages) {
    assert.equal(isValidCommitMessage(message), false, message);
  }
});
