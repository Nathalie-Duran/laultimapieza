import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import './web/motor-aventuras.js';

// Re-run the shipped, deterministic challenge handlers against a detached control
// tree. The submitted input contains positions and option indices, never code,
// selectors, handler names, or client-declared scores.
class ControlTree {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.style = {};
    this.handlers = {};
  }

  append(...items) {
    for (const item of items) {
      if (!(item instanceof ControlTree)) continue;
      this.children.push(item);
      item.parent = this;
    }
  }

  replaceChildren(...items) {
    this.children = [];
    this.append(...items);
  }

  set textContent(value) {
    this.children = [];
  }

  get childElementCount() { return this.children.length; }

  insertSibling(item, offset) {
    const index = this.parent.children.indexOf(this);
    this.parent.children.splice(index + offset, 0, item);
    item.parent = this.parent;
  }

  before(item) { this.insertSibling(item, 0); }
  after(item) { this.insertSibling(item, 1); }

  get value() {
    if (this.selection !== undefined) return this.selection;
    return this.tag === 'select' ? this.children[0]?.value : undefined;
  }

  set value(value) { this.selection = value; }

  addEventListener(event, fn) { this.handlers[event] = fn; }

  // These DOM calls in the originals set accessible descriptions and restore
  // keyboard focus. Neither focus nor presentational attributes change a rule.
  setAttribute() {}
  contains() { return false; }
  querySelector() { return null; }

  controls(result = []) {
    for (const child of this.children) {
      if (child.tag === 'button' || child.tag === 'select') result.push(child);
      else child.controls(result);
    }
    return result;
  }
}

const document = Object.freeze({ createElement: tag => new ControlTree(tag), activeElement: null });
const games = {};
for (const group of [1, 2, 3]) {
  const filename = 'valdemar-challenges-' + group + '.js';
  const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
  runInNewContext(source, {window:{Retos:games}, document}, {
    filename, timeout: 1000, contextCodeGeneration:{strings:false, wasm:false}
  });
}

function legalPosition(position) {
  return Number.isInteger(position) && position >= 0 && position < 80;
}

function validEvent(move) {
  return legalPosition(move) || (Array.isArray(move) && move.length === 2
    && legalPosition(move[0]) && legalPosition(move[1]));
}

export function verifyValdemarVictory(caseId, moves) {
  if (!Number.isInteger(caseId) || caseId < 1 || caseId > 12) return false;

  const host = new ControlTree('div');
  let won = false;
  games[caseId].mount(host, () => { won = true; });
  function apply(move) {
    if (!validEvent(move)) return false;
    const select = Array.isArray(move);
    const control = host.controls()[select ? move[0] : move];
    if (!control || control.disabled) return false;
    if (select) {
      if (control.tag !== 'select') return false;
      const option = control.children[move[1]];
      if (!option || option.tag !== 'option' || option.disabled) return false;
      control.value = option.value;
      control.handlers.change?.();
    } else {
      if (control.tag !== 'button' || !control.handlers.click) return false;
      // Audio playback is optional on the client and has no effect on the board.
      if (caseId === 4 && ['ref','actual'].includes(control.dataset.control)) return false;
      control.handlers.click();
    }
    return true;
  }
  return globalThis.MotorAventuras.reproducirPrueba(moves,{maxPasos:1024,aplicar:apply,resuelta:()=>won});
}
