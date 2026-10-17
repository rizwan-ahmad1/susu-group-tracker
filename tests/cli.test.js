'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PassThrough, Writable } = require('node:stream');
const { runCli } = require('../src/cli');

describe('CLI', () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'susu-cli-test-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  async function runWithAnswers(answers) {
    const input = new PassThrough();
    const answerQueue = [...answers];
    let stdout = '';
    const output = new Writable({
      write(chunk, encoding, callback) {
        const text = chunk.toString();
        stdout += text;
        if (/\b(?:Group name|Weekly contribution \(e\.g\.|Member ID \(unique\)|Member name|Choose an option|Paying member ID|Payment amount \(e\.g\.)/.test(text)) {
          const answer = answerQueue.shift();
          if (answer !== undefined) {
            setImmediate(() => {
              input.write(`${answer}\n`);
              if (answerQueue.length === 0) input.end();
            });
          }
        }
        callback();
      },
    });
    await runCli({ input, output, dataFile: path.join(directory, 'data', 'susu-group.json') });
    return stdout;
  }

  test('creates a group, tracks payments, closes a week, and reloads saved data', async () => {
    const firstRun = await runWithAnswers([
      'Friday Susu', '25.00',
      '1', 'ama', 'Ama',
      '1', 'kojo', 'Kojo',
      '2',
      '3', 'ama', '25.00',
      '3', 'kojo', '25.00',
      '5',
      '6',
    ]);

    expect(firstRun).toContain('Week 1 closed. Ama (ama) receives 50.00.');

    const savedGroup = JSON.parse(
      await fs.readFile(path.join(directory, 'data', 'susu-group.json'), 'utf8'),
    );
    expect(savedGroup.weeks[0].closed).toBe(true);

    const secondRun = await runWithAnswers(['4', '6']);
    expect(secondRun).toContain('Loaded "Friday Susu"');
    expect(secondRun).toContain('Week 1 - closed');
    expect(secondRun).toContain('Next payout: Kojo [kojo]');
  });

  test('keeps an incomplete week open and displays member balances when closing fails', async () => {
    const result = await runWithAnswers([
      'Friday Susu', '25.00',
      '1', 'ama', 'Ama',
      '1', 'kojo', 'Kojo',
      '2',
      '3', 'ama', '25.00',
      '5',
      '4',
      '6',
    ]);

    expect(result).toContain('Cannot close week');
    expect(result).toContain('Kojo (kojo) owes 25.00.');
    expect(result).toContain('Week 1 - open');
  });
});
