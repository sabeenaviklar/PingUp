const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, ROLE_WEIGHTS, hasPermission } = require('../data/store');

describe('ROLES constants', () => {
  it('ROLES.ADMIN maps to the "owner" string value', () => {
    assert.equal(ROLES.ADMIN, 'owner');
  });

  it('ROLES.MODERATOR maps to "moderator"', () => {
    assert.equal(ROLES.MODERATOR, 'moderator');
  });

  it('ROLES.MEMBER maps to "member"', () => {
    assert.equal(ROLES.MEMBER, 'member');
  });
});

describe('ROLE_WEIGHTS', () => {
  it('owner role has weight 3', () => {
    assert.equal(ROLE_WEIGHTS[ROLES.ADMIN], 3);
  });

  it('moderator role has weight 2', () => {
    assert.equal(ROLE_WEIGHTS[ROLES.MODERATOR], 2);
  });

  it('member role has weight 1', () => {
    assert.equal(ROLE_WEIGHTS[ROLES.MEMBER], 1);
  });
});

describe('hasPermission', () => {
  it('owner has permission over moderator', () => {
    assert.ok(hasPermission(ROLES.ADMIN, ROLES.MODERATOR));
  });

  it('owner has permission over member', () => {
    assert.ok(hasPermission(ROLES.ADMIN, ROLES.MEMBER));
  });

  it('moderator does not have permission over owner', () => {
    assert.ok(!hasPermission(ROLES.MODERATOR, ROLES.ADMIN));
  });

  it('member does not have permission over moderator', () => {
    assert.ok(!hasPermission(ROLES.MEMBER, ROLES.MODERATOR));
  });
});
