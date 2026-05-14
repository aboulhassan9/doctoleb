import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserDisplayName,
  getUserInitials,
  getDoctorLabel,
} from '../../../packages/core/lib/userDisplay.js';

describe('getUserDisplayName', () => {
  it('joins first + last name', () => {
    assert.equal(getUserDisplayName({ first_name: 'Maya', last_name: 'Haddad' }), 'Maya Haddad');
  });

  it('returns just first name when last is missing', () => {
    assert.equal(getUserDisplayName({ first_name: 'Maya' }), 'Maya');
  });

  it('returns fallback for null user', () => {
    assert.equal(getUserDisplayName(null), 'Doctor');
  });

  it('honors a custom fallback', () => {
    assert.equal(getUserDisplayName(null, 'Anonymous'), 'Anonymous');
  });

  it('returns fallback when first_name is missing', () => {
    assert.equal(getUserDisplayName({ last_name: 'Haddad' }), 'Doctor');
  });
});

describe('getUserInitials', () => {
  it('uppercases first letter of first + last name', () => {
    assert.equal(getUserInitials({ first_name: 'maya', last_name: 'haddad' }), 'MH');
  });

  it('returns just first initial when last is missing', () => {
    assert.equal(getUserInitials({ first_name: 'Maya' }), 'M');
  });

  it('returns fallback for null user', () => {
    assert.equal(getUserInitials(null), '?');
  });

  it('honors a custom fallback', () => {
    assert.equal(getUserInitials(null, '??'), '??');
  });
});

describe('getDoctorLabel', () => {
  it('returns "Dr. LastName" when last_name is present', () => {
    assert.equal(getDoctorLabel({ first_name: 'Maya', last_name: 'Haddad' }), 'Dr. Haddad');
  });

  it('falls back to first name when last is missing', () => {
    assert.equal(getDoctorLabel({ first_name: 'Maya' }), 'Dr. Maya');
  });

  it('returns fallback for null user', () => {
    assert.equal(getDoctorLabel(null), 'Doctor');
  });
});
