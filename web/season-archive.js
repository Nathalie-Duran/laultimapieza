(() => {
  'use strict';
  const modes = {solo:'En solitario',duo:'En pareja',legacy:'Sin modalidad elegida'};
  function element(tag, value, className) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function caseCard(game) {
    const first = game.id <= 12;
    const story = first ? window.ValdemarCatalog.get(game.id) : window.Mundos.story(game.id);
    if (!story) return null;
    const world = first ? 'Valdemar' : window.Mundos.nameOf(story.world);
    const item = element('li', null, 'sa-card');
    item.dataset.seasonCase = game.id;
    const cover = element('img');
    cover.src = first ? story.image : '/mundo-'+game.id+'.webp';
    cover.alt = ''; cover.loading = 'lazy'; cover.decoding = 'async';
    const info = element('div', null, 'sa-card-info');
    info.append(element('small',world),element('h4',story.title));
    const stage = game.finished ? 'Desenlace guardado' :
      game.current >= game.total ? 'Pendiente de desenlace' : 'Etapa '+(game.current+1)+' de '+game.total;
    info.append(element('p',(modes[game.mode] || modes.legacy)+' · '+stage));
    const action = element('a',game.available ? game.finished ? 'Ver desenlace' : 'Continuar' : 'Consultar mi pase','sa-action');
    action.href = game.available ? '#'+(first?'valdemar-jugar':'mundos-jugar')+'?id='+game.id : '#planes';
    action.setAttribute('aria-label',action.textContent+' · '+story.title);
    item.append(cover,info,action);
    return item;
  }
  class SeasonArchive extends HTMLElement {
    connectedCallback() { this.load(); }
    disconnectedCallback() { this.requestId = null; }
    async load() {
      const bridge = window.GameAccountBridge;
      if (!bridge?.isSignedIn()) return;
      const requestId = this.requestId = Symbol();
      this.setAttribute('aria-busy','true');
      const status = element('p','Cargando tus partidas de temporada…','sa-message');
      status.setAttribute('role','status');
      this.replaceChildren(status);
      try {
        const {games} = await bridge.request('/api/valdemar/partidas');
        if (this.requestId !== requestId || !bridge.isSignedIn()) return;
        if (!games.length) {
          this.replaceChildren();
          if (!this.hasAttribute('data-with-classic')) {
            const empty = element('p','Todavía no tienes partidas guardadas.','sa-message');
            const link = element('a','Explorar los casos','button primary');
            link.href = '#casos';
            this.append(empty,link);
          }
          return;
        }
        this.draw(games);
      } catch {
        if (this.requestId !== requestId || !bridge.isSignedIn()) return;
        status.textContent = 'No se han podido cargar tus partidas de temporada.';
        const retry = element('button','Volver a intentar','button');
        retry.type = 'button'; retry.addEventListener('click', () => this.load());
        this.append(retry);
      } finally {
        if (this.requestId === requestId) this.removeAttribute('aria-busy');
      }
    }
    draw(games) {
      const head = element('div',null,'sa-head');
      head.append(element('h2','Temporadas'));
      const body = element('div');
      const visibleModes = new Set(games.map(game=>game.mode || 'legacy'));
      const groups = (mode='all') => {
        body.replaceChildren();
        const visible = games.filter(game => mode==='all' || (game.mode || 'legacy')===mode);
        for (const complete of [false,true]) {
          const items = visible.filter(game=>Boolean(game.finished)===complete).map(caseCard).filter(Boolean);
          if (!items.length) continue;
          const group = element('section',null,'sa-group');
          const heading = element('h3',complete ? 'Terminadas' : 'En curso');
          const list = element('ul',null,'sa-list');
          list.append(...items); group.append(heading,list); body.append(group);
        }
      };
      if (visibleModes.size > 1) {
        const filter = element('label',null,'sa-filter');
        const select = element('select');
        const all = element('option','Todas'); all.value='all'; select.append(all);
        for (const [id,label] of Object.entries(modes)) {
          if (!visibleModes.has(id)) continue;
          const option = element('option',label); option.value=id; select.append(option);
        }
        filter.append(element('span','Modalidad'),select); head.append(filter);
        select.addEventListener('change',()=>groups(select.value));
      }
      groups(); this.replaceChildren(head,body);
    }
  }
  customElements.define('season-archive',SeasonArchive);
})();
