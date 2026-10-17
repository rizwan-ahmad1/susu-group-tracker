'use strict';

const {
  Member,
  SusuGroup,
  WeekNotReadyError,
  formatPesewas,
  parseMoneyToPesewas,
} = require('../src');

function makeGroup() {
  const group = new SusuGroup('Friday Susu', 2500);
  group.addMember('ama', 'Ama');
  group.addMember('kojo', 'Kojo');
  group.addMember('efua', 'Efua');
  group.startWeek();
  return group;
}

describe('SusuGroup', () => {
  test('tracks partial payments and reports the remaining amount', () => {
    const group = makeGroup();
    group.recordPayment('ama', 1000);
    group.recordPayment('ama', 500);

    const report = group.getReport();
    expect(report.currentWeek.payments[0].paidPesewas).toBe(1500);
    expect(report.currentWeek.outstanding).toContainEqual({
      memberId: 'ama',
      memberName: 'Ama',
      paidPesewas: 1500,
      owedPesewas: 1000,
    });
  });

  test('rejects an unknown member', () => {
    const group = makeGroup();
    expect(() => group.recordPayment('unknown', 100)).toThrow('Unknown member');
  });

  test('rejects duplicate member registrations', () => {
    const group = new SusuGroup('Friday Susu', 2500);
    group.addMember('ama', 'Ama');
    expect(() => group.addMember('ama', 'Another Ama')).toThrow('already in the group');
  });

  test('rejects zero, negative, and non-integer payments', () => {
    const group = makeGroup();
    expect(() => group.recordPayment('ama', 0)).toThrow('greater than zero');
    expect(() => group.recordPayment('ama', -1)).toThrow('non-negative safe integer');
    expect(() => group.recordPayment('ama', 1.5)).toThrow('non-negative safe integer');
  });

  test('rejects a payment that would overpay the weekly contribution', () => {
    const group = makeGroup();
    group.recordPayment('ama', 2000);
    expect(() => group.recordPayment('ama', 501)).toThrow('exceeds');
  });

  test('does not close a week while any member owes money', () => {
    const group = makeGroup();
    group.recordPayment('ama', 2500);
    group.recordPayment('kojo', 1500);

    expect(() => group.closeWeek()).toThrow(WeekNotReadyError);
    try {
      group.closeWeek();
    } catch (error) {
      expect(error.outstanding).toContainEqual({
        memberId: 'kojo',
        memberName: 'Kojo',
        paidPesewas: 1500,
        owedPesewas: 1000,
      });
      expect(error.outstanding).toContainEqual({
        memberId: 'efua',
        memberName: 'Efua',
        paidPesewas: 0,
        owedPesewas: 2500,
      });
    }
    expect(group.getReport().currentWeek.status).toBe('open');
  });

  test('pays out the full pot in join order and rotates each closed week', () => {
    const group = makeGroup();
    for (const id of ['ama', 'kojo', 'efua']) group.recordPayment(id, 2500);

    expect(group.closeWeek()).toEqual({
      weekNumber: 1,
      recipientId: 'ama',
      recipientName: 'Ama',
      payoutPesewas: 7500,
    });
    expect(group.getReport().nextRecipient.id).toBe('kojo');

    group.startWeek();
    for (const id of ['ama', 'kojo', 'efua']) group.recordPayment(id, 2500);
    expect(group.closeWeek().recipientId).toBe('kojo');
  });

  test('locks membership once the first week starts', () => {
    const group = makeGroup();
    expect(() => group.addMember('new', 'New Member')).toThrow('after the first week starts');
  });

  test('parses and formats decimal money without floating point arithmetic', () => {
    expect(parseMoneyToPesewas('12.3')).toBe(1230);
    expect(parseMoneyToPesewas('0.09')).toBe(9);
    expect(formatPesewas(1230)).toBe('12.30');
    expect(parseMoneyToPesewas('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => parseMoneyToPesewas('1.234')).toThrow('at most two');
    expect(() => parseMoneyToPesewas('90071992547409.92')).toThrow('safe integer range');
  });

  test('rejects a membership change that would make the pot unsafe', () => {
    const group = new SusuGroup('Large Susu', Number.MAX_SAFE_INTEGER);
    group.addMember('ama', 'Ama');
    expect(() => group.addMember('kojo', 'Kojo')).toThrow('Group pot would exceed');
    expect(group.members.map((member) => member.id)).toEqual(['ama']);
  });

  test('Member exposes immutable identity data', () => {
    const member = new Member('ama', 'Ama');
    expect(member.id).toBe('ama');
    expect(Object.isFrozen(member)).toBe(true);
  });

  test('restores an open and closed week from saved group data', () => {
    const group = makeGroup();
    group.recordPayment('ama', 2500);
    group.recordPayment('kojo', 2500);
    group.recordPayment('efua', 2500);
    group.closeWeek();
    group.startWeek();
    group.recordPayment('ama', 500);

    const restored = SusuGroup.fromJSON(JSON.parse(JSON.stringify(group.toJSON())));
    const report = restored.getReport();
    expect(report.weeks[0].status).toBe('closed');
    expect(report.weeks[1].payments[0].paidPesewas).toBe(500);
    expect(report.nextRecipient.id).toBe('kojo');
  });

  test('rejects invalid saved group data', () => {
    expect(() => SusuGroup.fromJSON({ version: 2 })).toThrow('unsupported or invalid format');
  });
});
