(() => {
  'use strict';

  // Positions use the original, uncropped 3:2 town illustration.
  const positions = [
    [16, 24], [45, 36], [26, 59], [74, 11],
    [94, 42], [35, 23], [76, 66], [13, 72],
    [20, 45], [60, 80], [42, 57], [64, 42]
  ];
  const num = n => String(n).padStart(2, '0');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let mounted = null;
  let previous = null;
  let requestedFocus = null;

  function selection(items) {
    const hash = typeof location === 'undefined' ? '' : location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const value = params.get('mes');
    const month = /^[1-3]$/.test(value || '') ? Number(value) : 0;
    const places = month ? items.filter(item => item.month === month) : items;
    const id = params.get('lugar');
    const selected = /^(?:[1-9]|1[0-2])$/.test(id || '') && places.find(item => item.id === Number(id));
    return {month, places, selected:selected || places[0]};
  }

  function route(month, id) {
    const params = new URLSearchParams();
    if (month) params.set('mes', String(month));
    if (id) params.set('lugar', String(id));
    const query = params.toString();
    return '#mapa' + (query ? '?' + query : '');
  }

  function filterLink(month, current, place) {
    const stay = !month || place.month === month ? place.id : null;
    return `<a class="vdp-chip" href="${route(month,stay)}" data-vdp-focus="month-${month}"${current===month?' aria-current="true"':''}>${month?'Mes '+month:'Todos'}</a>`;
  }

  function pin(item, current, month) {
    const [x,y] = positions[item.id - 1];
    return `<a href="${route(month,item.id)}" class="vdp-pin${x>75?' is-east':''}" style="--x:${x}%;--y:${y}%" data-vdp-focus="pin-${item.id}" data-vdp-id="${item.id}" aria-label="${esc(item.place)}. ${esc(item.title)}. Ver lugar" aria-controls="vdp-place"${current===item.id?' aria-current="location"':''}><span class="vdp-pin-number" aria-hidden="true">${num(item.id)}</span><span class="vdp-pin-label" aria-hidden="true">${esc(item.place)}</span></a>`;
  }

  function indexRow(item, current, month) {
    return `<li><a class="vdp-index-link" href="${route(month,item.id)}" data-vdp-focus="idx-${item.id}" data-vdp-id="${item.id}" aria-controls="vdp-place"${current===item.id?' aria-current="location"':''}><span class="vdp-index-number" aria-hidden="true">${num(item.id)}</span><span class="vdp-index-name">${esc(item.place)}</span><small class="vdp-index-title">${esc(item.title)}</small></a></li>`;
  }

  function nearby(places, item, month, step) {
    const pos = places.indexOf(item);
    const neighbor = places[(pos + step + places.length) % places.length];
    const direction = step < 0 ? 'anterior' : 'siguiente';
    return `<a class="vdp-neighbor" href="${route(month,neighbor.id)}" data-vdp-focus="near-${direction}" data-vdp-id="${neighbor.id}" aria-controls="vdp-place" aria-label="Lugar ${direction}. ${esc(neighbor.place)}" title="Lugar ${direction}"><span aria-hidden="true">${step < 0 ? '←' : '→'}</span></a>`;
  }

  function detail(item, options, catalog, places, month) {
    const allowed = catalog.access(item,options);
    const editorial = options.admin === true || options.role === 'admin';
    const availability = editorial ? 'Disponible con tu acceso editorial.' :
      allowed ? 'Incluida en tu acceso actual.' : options.canPlay ? `Se abre con el mes ${item.month} de tu pase.` :
      `Incluida en el mes ${item.month} del pase de Valdemar.`;
    const path = catalog.path(item.id);
    const primary = allowed ? `<a class="vdp-primary" href="/#valdemar-jugar?id=${item.id}">Abrir la investigación</a><a class="vdp-secondary" href="${path}">Ver la ficha</a>` :
      `<a class="vdp-primary" href="${path}">Ver la historia</a><a class="vdp-secondary" href="/#planes">Ver el pase</a>`;
    return `<aside class="vdp-place" id="vdp-place" aria-labelledby="vdp-title">
      <header class="vdp-still"><img class="vdp-cover" src="${esc(item.image)}" alt="${esc(item.coverAlt)}" width="764" height="508" decoding="async">
        <div class="vdp-still-top"><span class="vdp-plate">Caso ${num(item.id)}</span><nav class="vdp-neighbors" aria-label="Recorrer los lugares del plano">${nearby(places,item,month,-1)}${nearby(places,item,month,1)}</nav></div>
        <div class="vdp-caption"><p class="vdp-location">${esc(item.place)}</p><h2 class="vdp-title" id="vdp-title" data-vdp-focus="detail" tabindex="-1">${esc(item.title)}</h2></div>
      </header>
      <div class="vdp-place-copy"><p class="vdp-question">${esc(item.question)}</p><ul class="vdp-format" aria-label="Formato del caso"><li>Mes ${item.month}</li><li>≈ 60 min</li><li>1–2 personas</li></ul><p class="vdp-access">${availability}</p><div class="vdp-actions">${primary}</div><button type="button" class="vdp-back-map" data-vdp-focus="return">Volver al plano</button></div></aside>`;
  }

  function remember() {
    if (!mounted || !mounted.isConnected) {
      previous = null;
      return;
    }
    const active = document.activeElement;
    const viewport = mounted.querySelector('.vdp-viewport');
    previous = {
      key:mounted.contains(active) ? active?.dataset.vdpFocus : '',
      index:mounted.querySelector('.vdp-index').open,
      left:viewport.scrollLeft,
      top:viewport.scrollTop,
      enlarged:viewport.dataset?.enlarged === 'true',
      selection:mounted.dataset.place
    };
  }

  function view(options={}) {
    remember();
    const catalog = window.ValdemarCatalog;
    const {month,places,selected} = selection(catalog.items);
    const enlarged = !!previous?.enlarged;
    return `<section class="vdp" aria-labelledby="vdp-heading" data-place="${selected.id}">
      <header class="vdp-head"><div class="vdp-mast-copy"><p class="vdp-eyebrow">Temporada 01</p><h1 id="vdp-heading">Plano secreto de <em>Valdemar</em></h1><p class="vdp-intro">Elige un lugar y descubre el misterio que guarda.</p></div></header>
      <div class="vdp-layout"><div class="vdp-map-column"><nav class="vdp-toolbar" aria-label="Filtrar lugares por mes"><div class="vdp-filter">${[0,1,2,3].map(n=>filterLink(n,month,selected)).join('')}</div><span class="vdp-count">${places.length} lugares</span></nav>
        <div class="vdp-inset"><div class="vdp-viewport" id="vdp-viewport" tabindex="0" data-vdp-focus="viewport" data-enlarged="${enlarged}" role="region" aria-label="Plano ilustrado de Valdemar"><div class="vdp-map" role="group" aria-label="Elegir un lugar"><img class="vdp-base" src="/valdemar-plano.webp" alt="" width="1536" height="1024" fetchpriority="high" decoding="async">${places.map(item=>pin(item,selected.id,month)).join('')}</div></div></div>
        <div class="vdp-map-foot"><span class="vdp-legend"><i aria-hidden="true"></i>Lugar seleccionado</span><span class="vdp-drag-hint">Arrastra para explorar</span><button type="button" class="vdp-zoom" data-vdp-focus="zoom" aria-controls="vdp-viewport" aria-pressed="${enlarged}"><i aria-hidden="true"></i><span>${enlarged ? 'Ver plano completo' : 'Ampliar plano'}</span></button></div></div>
        ${detail(selected,options,catalog,places,month)}</div>
      <div class="vdp-references"><details class="vdp-index"${previous?.index?' open':''}><summary data-vdp-focus="index"><span class="vdp-index-glyph" aria-hidden="true"></span>Índice de lugares</summary><ol class="vdp-index-list">${places.map(item=>indexRow(item,selected.id,month)).join('')}</ol></details><footer class="vdp-footer"><a href="#mapa-clasico">Plano del archivo clásico <span aria-hidden="true">↗</span></a><a href="#mapa-clasico?seccion=sello">Ver el sello clásico <span aria-hidden="true">↗</span></a></footer></div></section>`;
  }

  function centerWhenHidden(root, pin) {
    if (!pin) return;
    const viewport = root.querySelector('.vdp-viewport');
    if (viewport.scrollWidth <= viewport.clientWidth + 1 && !(viewport.scrollHeight > viewport.clientHeight + 1)) return;
    const frame = viewport.getBoundingClientRect(), spot = pin.getBoundingClientRect();
    if (spot.left < frame.left+4 || spot.right > frame.right-4) {
      viewport.scrollLeft += (spot.left + spot.right - frame.left - frame.right) / 2;
    }
    if (spot.top < frame.top+4 || spot.bottom > frame.bottom-4) {
      viewport.scrollTop += (spot.top + spot.bottom - frame.top - frame.bottom) / 2;
    }
  }

  function onMapKey(event) {
    const start = event.target.closest('.vdp-pin');
    if (!start || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const pins = [...event.currentTarget.querySelectorAll('.vdp-pin')];
    const direction = {ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[event.key];
    let next;
    if (direction) {
      const origin = positions[Number(start.dataset.vdpId)-1];
      const [dx,dy] = direction;
      let best = Infinity;
      for (const candidate of pins) {
        const point = positions[Number(candidate.dataset.vdpId)-1];
        const x = (point[0]-origin[0])*1.5, y = point[1]-origin[1];
        const forward = x*dx + y*dy;
        if (forward <= 0) continue;
        const across = x*dy - y*dx;
        const distance = forward + 3*across*across/forward;
        if (distance < best) {next=candidate;best=distance;}
      }
    }
    else if (event.key==='Home') next = pins[0];
    else if (event.key==='End') next = pins[pins.length-1];
    else return;
    event.preventDefault();
    if (!next) return;
    centerWhenHidden(event.currentTarget,next);
    next.focus({preventScroll:true});
  }

  function focusTitle(root) {
    const title = root.querySelector('.vdp-title');
    title.focus({preventScroll:true});
    // On small screens the file is below the drawing. Make the result of selecting a pin visible.
    const bounds = title.getBoundingClientRect();
    const header = document.querySelector('.sidebar')?.getBoundingClientRect?.();
    const mobileNav = document.querySelector('.mobile-nav')?.getBoundingClientRect?.();
    const bottomEdge = mobileNav?.height && mobileNav.top > 0 ? Math.min(mobileNav.top,window.innerHeight) : window.innerHeight;
    if (bounds.bottom > bottomEdge || bounds.top < (header?.bottom || 0)) {
      root.querySelector('.vdp-place').scrollIntoView({block:'start',behavior:'instant'});
    }
  }

  function beginPan(event) {
    const viewport = event.target.closest('.vdp-viewport[data-enlarged="true"]');
    if (!viewport || event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a')) return;
    const startX = event.clientX, startY = event.clientY;
    const left = viewport.scrollLeft, top = viewport.scrollTop;
    const pointerId = event.pointerId;
    viewport.setPointerCapture(pointerId);
    function move(pointer) {
      if (pointer.pointerId !== pointerId) return;
      viewport.scrollLeft = left + startX - pointer.clientX;
      viewport.scrollTop = top + startY - pointer.clientY;
    }
    viewport.addEventListener('pointermove',move);
    viewport.addEventListener('lostpointercapture',()=>viewport.removeEventListener('pointermove',move),{once:true});
  }

  function onAction(event) {
    const zoom = event.target.closest('.vdp-zoom');
    if (zoom) {
      const viewport = event.currentTarget.querySelector('.vdp-viewport');
      const enlarged = viewport.dataset.enlarged !== 'true';
      viewport.dataset.enlarged = String(enlarged);
      zoom.setAttribute('aria-pressed', String(enlarged));
      zoom.querySelector('span').textContent = enlarged ? 'Ver plano completo' : 'Ampliar plano';
      centerWhenHidden(event.currentTarget,event.currentTarget.querySelector('.vdp-pin[aria-current="location"]'));
      return;
    }
    if (event.target.closest('.vdp-back-map')) {
      const pin = event.currentTarget.querySelector('.vdp-pin[aria-current="location"]');
      centerWhenHidden(event.currentTarget,pin);
      pin.focus({preventScroll:true});
      pin.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      return;
    }
    const link = event.target.closest('a[data-vdp-focus]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const hash = link.hash;
    const isPlace = Boolean(link.dataset.vdpId);
    if (hash === location.hash) {
      if (isPlace) focusTitle(event.currentTarget);
      return;
    }
    requestedFocus = {hash, key:isPlace?'detail':link.dataset.vdpFocus};
  }

  function mount() {
    const root = document.querySelector('.vdp');
    if (!root || root === mounted) return;
    mounted = root;
    root.addEventListener('click',onAction);
    root.addEventListener('keydown',onMapKey);
    root.addEventListener('pointerdown',beginPan);
    const viewport = root.querySelector('.vdp-viewport');
    if (previous) {
      viewport.scrollLeft = previous.left;
      viewport.scrollTop = previous.top || 0;
    }
    const pin = root.querySelector('.vdp-pin[aria-current="location"]');
    if (!previous || previous.selection !== root.dataset.place) centerWhenHidden(root,pin);
    const intent = requestedFocus?.hash === location.hash ? requestedFocus.key : '';
    requestedFocus = null;
    const key = intent || previous?.key;
    if (intent === 'detail') focusTitle(root);
    else if (key) {
      const destination = [...root.querySelectorAll('[data-vdp-focus]')].find(el=>el.dataset.vdpFocus===key);
      destination?.focus({preventScroll:true});
    }
  }

  window.ValdemarPlano = Object.freeze({view,mount});
})();
