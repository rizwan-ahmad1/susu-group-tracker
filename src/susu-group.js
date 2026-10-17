'use strict';

const { assertMinorUnits } = require('./money');
const { Member } = require('./member');

class WeekNotReadyError extends Error {
  constructor(outstanding) {
    const details = outstanding
      .map(({ memberName, owedPesewas }) => `${memberName} owes ${owedPesewas} pesewas`)
      .join(', ');
    super(`Cannot close week: outstanding contributions remain (${details}).`);
    this.name = 'WeekNotReadyError';
    this.outstanding = outstanding.map((item) => ({ ...item }));
  }
}

class SusuGroup {
  #name;
  #weeklyContributionPesewas;
  #members = [];
  #membersById = new Map();
  #weeks = [];

  constructor(name, weeklyContributionPesewas) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError('Group name must be a non-empty string.');
    }
    if (!Number.isSafeInteger(weeklyContributionPesewas) || weeklyContributionPesewas <= 0) {
      throw new TypeError('Weekly contribution must be a positive safe integer in pesewas.');
    }

    this.#name = name.trim();
    this.#weeklyContributionPesewas = weeklyContributionPesewas;
  }

  get name() {
    return this.#name;
  }

  get weeklyContributionPesewas() {
    return this.#weeklyContributionPesewas;
  }

  get members() {
    return this.#members.map(({ id, name }) => new Member(id, name));
  }

  addMember(id, name) {
    if (this.#weeks.length > 0) {
      throw new Error('Members cannot be added after the first week starts.');
    }
    const member = id instanceof Member ? id : new Member(id, name);
    if (this.#membersById.has(member.id)) {
      throw new Error(`Member "${member.id}" is already in the group.`);
    }
    if (this.#weeklyContributionPesewas > Math.floor(Number.MAX_SAFE_INTEGER / (this.#members.length + 1))) {
      throw new RangeError('Group pot would exceed the safe integer range.');
    }

    this.#members.push(member);
    this.#membersById.set(member.id, member);
    return member;
  }

  startWeek() {
    if (this.#members.length === 0) {
      throw new Error('Add at least one member before starting a week.');
    }
    if (this.#weeks.length > 0 && !this.#weeks[this.#weeks.length - 1].closed) {
      throw new Error('The current week is still open.');
    }

    const week = {
      number: this.#weeks.length + 1,
      paymentsByMemberId: new Map(),
      closed: false,
      recipientId: null,
    };
    this.#weeks.push(week);
    return week.number;
  }

  recordPayment(memberId, amountPesewas) {
    const week = this.#getOpenWeek();
    const member = this.#membersById.get(memberId);
    if (!member) {
      throw new Error(`Unknown member "${memberId}".`);
    }
    assertMinorUnits(amountPesewas, 'Payment');
    if (amountPesewas === 0) {
      throw new RangeError('Payment must be greater than zero.');
    }

    const paidSoFar = week.paymentsByMemberId.get(memberId) || 0;
    const total = paidSoFar + amountPesewas;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Payment total is outside the safe integer range.');
    }
    if (total > this.#weeklyContributionPesewas) {
      throw new RangeError(
        `Payment exceeds ${member.name}'s remaining weekly contribution of ${this.#weeklyContributionPesewas - paidSoFar} pesewas.`,
      );
    }

    week.paymentsByMemberId.set(memberId, total);
    return total;
  }

  closeWeek() {
    const week = this.#getOpenWeek();
    const outstanding = this.#getOutstanding(week);
    if (outstanding.length > 0) {
      throw new WeekNotReadyError(outstanding);
    }

    const recipient = this.#members[(week.number - 1) % this.#members.length];
    week.closed = true;
    week.recipientId = recipient.id;

    return {
      weekNumber: week.number,
      recipientId: recipient.id,
      recipientName: recipient.name,
      payoutPesewas: this.#weeklyContributionPesewas * this.#members.length,
    };
  }

  getReport() {
    const currentWeek = this.#weeks[this.#weeks.length - 1] || null;
    const nextRecipient = this.#members.length > 0
      ? this.#members[this.#weeks.filter((week) => week.closed).length % this.#members.length]
      : null;

    return {
      groupName: this.#name,
      weeklyContributionPesewas: this.#weeklyContributionPesewas,
      memberCount: this.#members.length,
      rotationOrder: this.#members.map(({ id, name }) => ({ id, name })),
      nextRecipient: nextRecipient ? { id: nextRecipient.id, name: nextRecipient.name } : null,
      weeks: this.#weeks.map((week) => this.#weekReport(week)),
      currentWeek: currentWeek ? this.#weekReport(currentWeek) : null,
    };
  }

  toJSON() {
    return {
      version: 1,
      name: this.#name,
      weeklyContributionPesewas: this.#weeklyContributionPesewas,
      members: this.#members.map(({ id, name }) => ({ id, name })),
      weeks: this.#weeks.map((week) => ({
        closed: week.closed,
        payments: [...week.paymentsByMemberId].map(([memberId, amountPesewas]) => ({
          memberId,
          amountPesewas,
        })),
      })),
    };
  }

  static fromJSON(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1) {
      throw new TypeError('Saved group data has an unsupported or invalid format.');
    }
    if (!Array.isArray(data.members) || !Array.isArray(data.weeks)) {
      throw new TypeError('Saved group data must contain members and weeks arrays.');
    }

    const group = new SusuGroup(data.name, data.weeklyContributionPesewas);
    for (const member of data.members) {
      if (!member || typeof member !== 'object') {
        throw new TypeError('Saved member data is invalid.');
      }
      group.addMember(member.id, member.name);
    }

    for (const savedWeek of data.weeks) {
      if (!savedWeek || typeof savedWeek !== 'object' ||
          typeof savedWeek.closed !== 'boolean' || !Array.isArray(savedWeek.payments)) {
        throw new TypeError('Saved week data is invalid.');
      }
      group.startWeek();
      const seenMemberIds = new Set();
      for (const payment of savedWeek.payments) {
        if (!payment || typeof payment !== 'object' ||
            typeof payment.memberId !== 'string' || seenMemberIds.has(payment.memberId)) {
          throw new TypeError('Saved payment data is invalid or duplicated.');
        }
        seenMemberIds.add(payment.memberId);
        group.recordPayment(payment.memberId, payment.amountPesewas);
      }
      if (savedWeek.closed) {
        group.closeWeek();
      }
    }

    return group;
  }

  #getOpenWeek() {
    const week = this.#weeks[this.#weeks.length - 1];
    if (!week || week.closed) {
      throw new Error('Start an open week before recording payments or closing it.');
    }
    return week;
  }

  #getOutstanding(week) {
    return this.#members.flatMap((member) => {
      const paidPesewas = week.paymentsByMemberId.get(member.id) || 0;
      const owedPesewas = this.#weeklyContributionPesewas - paidPesewas;
      return owedPesewas > 0
        ? [{ memberId: member.id, memberName: member.name, paidPesewas, owedPesewas }]
        : [];
    });
  }

  #weekReport(week) {
    const paidPesewas = [...week.paymentsByMemberId.values()]
      .reduce((total, amount) => total + amount, 0);
    return {
      weekNumber: week.number,
      status: week.closed ? 'closed' : 'open',
      paidPesewas,
      potPesewas: this.#weeklyContributionPesewas * this.#members.length,
      recipientId: week.recipientId,
      payments: this.#members.map((member) => ({
        memberId: member.id,
        memberName: member.name,
        paidPesewas: week.paymentsByMemberId.get(member.id) || 0,
      })),
      outstanding: this.#getOutstanding(week),
    };
  }
}

module.exports = { SusuGroup, WeekNotReadyError };
