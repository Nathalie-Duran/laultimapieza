import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyValdemarVictory} from '../valdemar-replay.mjs';

test('el recorrido admite soluciones alternativas pero termina en el primer estado resuelto', () => {
  const replay=pasos=>{
    let pos=0;
    return globalThis.MotorAventuras.reproducirPrueba(pasos,{
      maxPasos:6,resuelta:()=>pos===3,aplicar:paso=>{
        if(![1,-1].includes(paso))return false;
        pos+=paso;
        return pos>=0;
      }
    });
  };
  assert.ok(replay([1,1,1]));
  assert.ok(replay([1,-1,1,1,1]));
  for(const intento of [[1,1],[1,1,1,-1],[-1,1,1,1,1],[1,1,2],[],Array(7).fill(1)])assert.equal(replay(intento),false);
});

test('las listas para pruebas selladas conservan el orden y el tipo de las piezas originales', () => {
  const {canonizarPiezas}=globalThis.MotorAventuras;
  assert.deepEqual(canonizarPiezas('conjunto',[20,11,3],3),[3,11,20]);
  assert.deepEqual(canonizarPiezas('conjunto',['esmalte','broquel'],2),['broquel','esmalte']);
  assert.deepEqual(canonizarPiezas('secuencia',['O','O'],2),['O','O']);
  assert.equal(canonizarPiezas('conjunto',['O','O'],2),null);
  assert.equal(canonizarPiezas('secuencia',Array(2),2),null);
});

test('el circuito rotatorio respeta las salidas, los giros simétricos y cualquier fuga de la red conectada', () => {
  const {evaluarPrueba}=globalThis.MotorAventuras;
  const circuito=(tubos,moviles,salidas)=>({
    tipo:'mecanica',mecanica:'circuito-rotatorio',parametros:{tubos,moviles,salidas,fuente:[0,0]}
  });
  const recto=circuito([['E','NS','O']],[[1,0]],[[2,0]]);
  assert.equal(evaluarPrueba(recto,[1]),true);
  assert.equal(evaluarPrueba(recto,[3]),true);
  assert.equal(evaluarPrueba(recto,[0]),false);
  const codo=circuito([['E','NE'],['','N']],[[1,0]],[[1,1]]);
  assert.equal(evaluarPrueba(codo,[2]),true);
  assert.equal(evaluarPrueba(codo,[3]),false);
  const fuga=circuito([['E','NSO','O']],[[1,0]],[[2,0]]);
  assert.equal(evaluarPrueba(fuga,[1]),false);
  const desconectada=circuito([['E','NS','O'],['','','N']],[[1,0]],[[2,0],[2,1]]);
  assert.equal(evaluarPrueba(desconectada,[3]),false);
});

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
