import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source = file => readFile(new URL('../web/' + file, import.meta.url), 'utf8');

async function load(file) {
  const document = {};
  function createElement(tag) {
    return {
      tag, dataset:{}, attributes:{}, listeners:{}, children:[], isConnected:true,
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      nodes() { return [this, ...this.children.flatMap(child => child.nodes())]; },
      contains(child) { return this.nodes().includes(child); },
      focus() { document.activeElement = this; },
      scrollIntoView() { this.scrolled = true; },
      querySelector(selector) {
        if (selector === '[data-visit-room]') return this.nodes().find(item => item.dataset.visitRoom);
        if (selector === '.vd-taller h4') return this.nodes().find(item => item.className === 'vd-taller')?.children.find(item => item.tag === 'h4');
        return this.nodes().find(item => item.tag === selector);
      },
      querySelectorAll() { return this.nodes().filter(item => item.dataset.focusKey); }
    };
  }
  Object.assign(document, {createElement, body:createElement('body')});
  document.activeElement = document.body;
  const window = {ValdemarHour:{filterByRole() {}}, clearInterval() {}, setInterval() {}};
  runInNewContext(await source(file), {window, document, MutationObserver:class {}});
  return {window, document};
}

test('Ambos jugadores montan un único selector y guardan la modalidad antes de entrar', async () => {
  const {window, document} = await load('modalidad-juego.js');
  const frame = document.createElement('div');
  const saved = [];
  const control = window.ModalidadJuego.create(frame, {roles:['Archivo','Campo']}, null, async mode => {
    saved.push(mode);
    return {mode};
  }, null, {caseId:1, data:{}});
  const groups = control.entry.nodes().filter(item => item.attributes.role === 'group');
  assert.equal(groups.length, 1);
  const [solo, duo] = groups[0].children;
  assert.deepEqual([solo.textContent, duo.textContent], ['En solitario','En pareja']);
  assert.equal(frame.dataset.playMode, 'pending');
  await solo.listeners.click();
  assert.deepEqual(saved, ['solo']);
  assert.equal(frame.dataset.playMode, 'solo');
  assert.equal(solo.attributes['aria-pressed'], 'true');
  assert.equal(duo.attributes['aria-pressed'], 'false');
  for (const name of ['valdemar-player.js','mundos-jugador.js']) {
    const player = await source(name);
    assert.equal(player.match(/\.append\([^\n]*\bc\.modeControl\.entry\b/g)?.length, 1, name);
    assert.doesNotMatch(player, /modeControl\.change/, name);
    assert.match(player, /c\.hour(?:View)?\.enter\(\)/, name);
  }
});

test('La entrada abre el lugar actual y da foco al instrumento al explorar o reanudar', async () => {
  const {window, document} = await load('expedition-inventory.js');
  const room = {index:1, place:'La estación', items:[], links:[], visited:false};
  const first = {rooms:[{index:0, place:'El andén', items:[], links:[], visited:true},room], revision:0};
  const visited = {rooms:[first.rooms[0], {...room, visited:true, instrument:{title:'Mesa de señales'}}], revision:1};
  let writes = 0;
  window.FieldInstruments = {render(body, instrument) {
    const section = document.createElement('section');
    section.className = 'vd-taller';
    const heading = document.createElement('h4');
    heading.textContent = instrument.title;
    section.append(heading);
    body.append(section);
  }};
  const inventory = window.ExpeditionInventory.create(async request => {
    assert.equal(request.operation, 'visit');
    assert.equal(request.index, 1);
    writes++;
    return {inventory:visited};
  }, () => {});
  inventory.update(first, 1);
  assert.equal(inventory.startExploring(), true);
  assert.equal(inventory.node.open, true);
  assert.equal(document.activeElement.textContent, 'Explorar La estación');
  assert.equal(document.activeElement.scrolled, true);
  assert.equal(writes, 0);
  const visit = document.activeElement.listeners.click();
  document.activeElement = document.body;
  await visit;
  assert.equal(writes, 1);
  assert.equal(document.activeElement.textContent, 'Mesa de señales');
  assert.equal(document.activeElement.tabIndex, -1);
  assert.equal(inventory.startExploring(), true);
  assert.equal(document.activeElement.textContent, 'Mesa de señales');
  visited.rooms[1].instrumentSolved = true;
  inventory.update(visited, 1);
  assert.equal(inventory.startExploring(), false);
});
