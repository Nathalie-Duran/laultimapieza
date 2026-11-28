import test from 'node:test';
import assert from 'node:assert/strict';
import {createMansionNotebook} from '../mansion-notebook.mjs';
import {mansionFixture} from './mansion-fixture.mjs';

test('las observaciones pertenecen a una casa, una sala y una etapa ya accesible',()=>{
  const {rooms,levels}=mansionFixture;
  const book=createMansionNotebook(rooms,levels),state={current:1};
  const roomId=rooms[0][0],id=book.idFor(levels[0].evidence[0]);
  const input={world:'A',roomId,evidenceId:id};
  assert.throws(()=>book.observe(state,'B',input),{status:403});
  assert.throws(()=>book.observe(state,'A',{...input,world:'B'}),{status:403});
  assert.throws(()=>book.observe(state,'A',{...input,roomId:rooms[1][0]}),{status:404});
  assert.throws(()=>book.observe(state,'solo',{...input,roomId:rooms[1][0],evidenceId:book.idFor(levels[1].evidence[0])}),{status:404});
  assert.ok(book.observe(state,'A',input).changed);
  assert.equal(book.observe(state,'A',input).changed,false);
  const ambient=book.roomPlace(roomId,'B');
  assert.ok(book.observe(state,'B',{world:'B',roomId,evidenceId:ambient.id}).changed);
  const reloaded=JSON.parse(JSON.stringify({...state,current:7}));
  assert.deepEqual(book.known(reloaded,'A').map(item=>item.id),[id]);
  assert.deepEqual(book.known(reloaded,'B').map(item=>item.id),[ambient.id]);
  assert.equal(book.known(reloaded,'solo').length,2);
});
