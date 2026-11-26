import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyValdemarVictory} from '../valdemar-replay.mjs';

test('Every season board opens with no reward and rejects unknown controls', () => {
  for (let id=1; id<=12; id++) {
    assert.equal(verifyValdemarVictory(id,[]),false);
    assert.equal(verifyValdemarVictory(id,[79]),false);
    assert.equal(verifyValdemarVictory(id,[0]),false);
  }
});

test('The proof must be bounded and describe only legal controls and options', () => {
  for (const moves of [true, {won:true}, null, [null], [-1], [false], [1.5],
    [80], [[0,0,0]], [[0,-1]], [['0',1]], Array(1025).fill(0)]) {
    assert.equal(verifyValdemarVictory(1,moves),false);
  }
  for (const id of ['1',0,13,null,NaN]) assert.equal(verifyValdemarVictory(id,[0]),false);
  assert.equal(verifyValdemarVictory(2,[[0,70]]),false);
});
