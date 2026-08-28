import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidMemberDisplayName } from './memberDisplayName';

test('acepta un guion bajo en medio del Nombre Visible del Miembro', () => {
  assert.equal(isValidMemberDisplayName('Milan_OnO7'), true);
});

test('rechaza guiones bajos incompatibles con un usuario de Roblox', () => {
  assert.equal(isValidMemberDisplayName('_Milan'), false);
  assert.equal(isValidMemberDisplayName('Milan_'), false);
  assert.equal(isValidMemberDisplayName('Milan_OnO7_'), false);
});

test('mantiene los limites y los caracteres admitidos', () => {
  assert.equal(isValidMemberDisplayName('Mi Pollito 7'), true);
  assert.equal(isValidMemberDisplayName('ab'), false);
  assert.equal(isValidMemberDisplayName('a'.repeat(16)), false);
  assert.equal(isValidMemberDisplayName('Milan!'), false);
});
