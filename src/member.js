'use strict';

class Member {
  #id;
  #name;

  constructor(id, name) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError('Member id must be a non-empty string.');
    }
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError('Member name must be a non-empty string.');
    }

    this.#id = id.trim();
    this.#name = name.trim();
    Object.freeze(this);
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }
}

module.exports = { Member };
