'use strict';

module.exports = function assert(isTrue, msg) {
  if (!isTrue) {
    throw new Error(msg || 'Assertion failed');
  }
}
