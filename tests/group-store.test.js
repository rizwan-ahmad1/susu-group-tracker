'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SusuGroup } = require('../src/susu-group');
const { loadGroup, saveGroup } = require('../src/group-store');

describe('group store', () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'susu-group-test-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  test('persists and restores members, payments, and payout rotation', async () => {
    const filePath = path.join(directory, 'data', 'group.json');
    const group = new SusuGroup('Friday Susu', 2500);
    group.addMember('ama', 'Ama');
    group.addMember('kojo', 'Kojo');
    group.startWeek();
    group.recordPayment('ama', 2500);
    group.recordPayment('kojo', 2500);
    group.closeWeek();
    group.startWeek();
    group.recordPayment('ama', 500);

    await saveGroup(filePath, group);
    const restored = await loadGroup(filePath);

    expect(restored.getReport().weeks[0].status).toBe('closed');
    expect(restored.getReport().currentWeek.payments[0].paidPesewas).toBe(500);
    expect(restored.getReport().nextRecipient.id).toBe('kojo');
  });

  test('returns null when the group file does not exist', async () => {
    await expect(loadGroup(path.join(directory, 'missing.json'))).resolves.toBeNull();
  });

  test('reports malformed saved JSON instead of silently resetting the group', async () => {
    const filePath = path.join(directory, 'group.json');
    await fs.writeFile(filePath, '{not json', 'utf8');
    await expect(loadGroup(filePath)).rejects.toThrow('Could not parse saved group file');
  });
});
