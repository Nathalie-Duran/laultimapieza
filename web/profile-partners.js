(() => {
  'use strict';

  const entities = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => entities[c]);
  const validId = id => Number.isInteger(id) && id >= 1 && id <= 48;
  const dateFormat = new Intl.DateTimeFormat('es-ES', {day:'numeric', month:'long'});
  const details = id => id <= 12 ? window.ValdemarCatalog?.get(id) : window.Mundos?.story(id);
  const title = id => details(id)?.title || 'Caso ' + id;
  const season = id => window.Colecciones?.seasons[Math.ceil(id / 12) - 1]?.name || 'Temporada ' + Math.ceil(id / 12);
  const picture = id => id <= 12 ? details(id)?.image : '/mundo-' + id + '.webp';
  const gameUrl = id => '/#' + (id <= 12 ? 'valdemar-jugar' : 'mundos-jugar') + '?id=' + id + '&retomar=1';
  const linkToPass = '<a class="button" href="/#planes">Ver mi pase</a>';

  function expiry(value) {
    if (!value) return '';
    const when = new Date(value);
    return Number.isFinite(when.getTime()) ? 'Disponible hasta el ' + dateFormat.format(when) + '.' : '';
  }

  function img(id) {
    const src = picture(id);
    return src ? '<img class="pp-cover" src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '';
  }

  function button(label, action, id, primary = false) {
    return '<button type="button" class="button' + (primary ? ' primary' : '') + '" data-partner-action="' +
      action + '" data-invitation="' + esc(id) + '">' + label + '</button>';
  }

  function shareByEmail(invite) {
    const recipient = invite.partnerEmail;
    if (!recipient || !/^[^\s@?&#,;]+@[^\s@?&#,;]+$/.test(recipient)) return '';
    const subject = 'Te invito a investigar «' + title(invite.caseId) + '»';
    const body = '¿Jugamos a «' + title(invite.caseId) + '» en La Última Pieza?\n\n' +
      'Entra con este correo para ver la invitación en tu perfil. Podrás aceptarla cuando tengas el caso abierto en tu pase.\n\n' +
      'https://www.laultimapieza.es/#perfil?seccion=pareja';
    return '<a class="button" href="mailto:' + esc(encodeURIComponent(recipient).replace('%40','@')) + '?subject=' +
      esc(encodeURIComponent(subject)) + '&amp;body=' + esc(encodeURIComponent(body)) + '">Compartir por correo</a>';
  }

  function invitationCard(invite, available, confirming) {
    const {caseId, id} = invite;
    const accepted = invite.status === 'accepted';
    const sent = invite.direction === 'sent';
    const partner = invite.partnerName || invite.partnerEmail || 'La otra persona';
    const who = (accepted ? 'Con ' : sent ? 'Para ' : 'De ') + partner;
    let detail = '', actions = '';
    if (confirming === id) {
      detail = accepted ? 'Dejaréis de compartir esta partida.' : 'La invitación dejará de estar disponible.';
      actions = button('Volver', 'cancel', id) + button(accepted ? 'Separar la pareja' : 'Retirar invitación', 'revoke', id);
    } else if (accepted) {
      detail = available ? 'Entrad desde vuestras cuentas con los dos pases activos.' : 'Necesitas acceso a este caso para continuar.';
      actions = (available ? '<a class="button primary" href="' + gameUrl(caseId) + '">Abrir partida</a>' : linkToPass) +
        button('Dejar de jugar en pareja', 'confirm-revoke', id);
    } else if (sent) {
      detail = expiry(invite.expiresAt);
      actions = shareByEmail(invite) + button('Retirar invitación', 'confirm-revoke', id);
    } else {
      detail = available ? expiry(invite.expiresAt) : 'Para aceptar, este juego tiene que estar abierto en tu propio pase.';
      actions = (available ? button('Aceptar invitación', 'accept', id, true) : linkToPass) + button('Rechazar', 'decline', id);
    }
    return '<li class="pp-card">' + img(caseId) + '<div><small>' + esc(season(caseId)) +
      '</small><h4>' + esc(title(caseId)) + '</h4><p class="pp-who">' + esc(who) + '</p>' +
      (detail ? '<p>' + esc(detail) + '</p>' : '') + '<div class="pp-actions">' + actions + '</div></div></li>';
  }

  function groupedOptions(ids, selected) {
    let options = '';
    for (let i = 1; i <= 4; i++) {
      const group = ids.filter(id => Math.ceil(id / 12) === i);
      if (group.length) options += '<optgroup label="' + esc(season(group[0])) + '">' +
        group.map(id => '<option value="' + id + '"' + (id === selected ? ' selected' : '') + '>' +
          esc(title(id)) + '</option>').join('') + '</optgroup>';
    }
    return options;
  }

  class ProfilePartners extends HTMLElement {
    connectedCallback() {
      this.selected = Number(new URLSearchParams(location.hash.split('?')[1]).get('juego'));
      this.onsubmit = event => {
        event.preventDefault();
        const form = event.target;
        if (!form.matches('.pp-form') || this.busy) return;
        const email = form.elements.email.value.trim();
        this.mutate('/api/partners', {caseId:this.selected, email}, 'Invitación guardada para ' + email + '.');
      };
      this.onchange = event => {
        if (event.target.name === 'game') {
          this.selected = Number(event.target.value);
          this.querySelector('.pp-compose').innerHTML = this.compose();
          this.querySelector('[name="game"]')?.focus();
        }
      };
      this.onclick = event => {
        const target = event.target.closest('[data-partner-action]');
        if (!target || this.busy) return;
        const action = target.dataset.partnerAction, id = target.dataset.invitation;
        if (action === 'reload') { this.refresh(); return; }
        if (action === 'confirm-revoke' || action === 'cancel') {
          this.confirming = action === 'cancel' ? null : id;
          this.paint();
          const next = action === 'cancel' ? 'confirm-revoke' : 'cancel';
          Array.from(this.querySelectorAll('[data-partner-action="' + next + '"]')).find(b => b.dataset.invitation === id)?.focus();
          return;
        }
        const notices = {accept:'Invitación aceptada. Ya podéis abrir la partida.', decline:'Has rechazado la invitación.', revoke:'Se ha retirado el vínculo para este caso.'};
        if (Object.hasOwn(notices, action)) this.mutate('/api/partners/' + encodeURIComponent(id) + '/' + action, {}, notices[action]);
      };
      this.refresh();
    }

    disconnectedCallback() { this.request = null; }

    async refresh() {
      const request = this.request = Symbol();
      this.busy = true;
      this.innerHTML = '<p role="status" class="pp-status">Cargando tus invitaciones…</p>';
      try {
        await this.read(request);
        if (this.request === request) this.paint();
      } catch (error) {
        if (this.request === request) this.innerHTML = '<div class="pp-feedback"><p role="alert">' +
          esc(error.message || 'No se han podido cargar las invitaciones.') +
          '</p><button type="button" class="button" data-partner-action="reload">Volver a intentar</button></div>';
      } finally { if (this.request === request) this.busy = false; }
    }

    async read(request) {
      const result = await window.GameAccountBridge.request('/api/partners');
      if (this.request !== request) return;
      this.available = result.availableCases.filter(validId).sort((a, b) => a - b);
      this.invites = result.invitations.filter(i => validId(i.caseId));
    }

    async mutate(endpoint, body, notice) {
      if (this.busy) return;
      const request = this.request;
      const feedback = this.querySelector('.pp-status');
      this.busy = true;
      this.setAttribute('aria-busy','true');
      let saved = false;
      try {
        await window.GameAccountBridge.request(endpoint, body);
        saved = true;
        if (this.request !== request) return;
        this.confirming = null;
        await this.read(request);
        if (this.request !== request) return;
        this.paint();
        const status = this.querySelector('.pp-status');
        status.textContent = notice;
        status.focus({preventScroll:true});
      } catch (error) {
        if (this.request !== request) return;
        feedback.textContent = saved ? notice + ' Actualiza para ver el estado.' : error.message || 'No se ha podido guardar el cambio.';
        feedback.focus({preventScroll:true});
        if (saved && endpoint === '/api/partners') this.querySelector('.pp-form')?.reset();
      } finally {
        if (this.request === request) {
          this.busy = false;
          this.removeAttribute('aria-busy');
        }
      }
    }

    compose() {
      const requested = validId(this.selected) && !this.available.includes(this.selected);
      const ids = this.available;
      if (!ids.length) return '<h3>Invitar a alguien</h3><p>' +
        (requested ? 'Para invitar a «' + esc(title(this.selected)) + '» necesitas tener ese caso abierto.' :
        'Con tu pase podrás invitar a una persona distinta a cada juego que tengas abierto.') + '</p>' + linkToPass;
      if (!this.selected || !validId(this.selected)) {
        this.selected = ids.find(id => !this.invites.some(i => i.caseId === id && (i.direction === 'sent' || i.status === 'accepted'))) || ids[0];
      }
      const current = this.selected;
      const existing = this.invites.find(i => i.caseId === current && (i.direction === 'sent' || i.status === 'accepted'));
      const form = requested ? '<p>Este caso aún está cerrado en tu pase.</p>' + linkToPass :
        existing ? '<p>' + (existing.status === 'accepted' ? 'Ya tienes pareja para este caso.' : 'Ya hay una invitación pendiente para este caso.') + '</p>' :
        '<form class="pp-form"><label for="pp-email">Correo de la persona que quieres invitar</label>' +
        '<input id="pp-email" type="email" name="email" required maxlength="254" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nombre@ejemplo.es">' +
        '<button class="button primary" type="submit">Enviar invitación</button></form>';
      return '<h3>Invitar a alguien</h3><label for="pp-game">Elige el juego</label><select id="pp-game" name="game">' +
        (requested ? '<option value="' + current + '" selected>' + esc(title(current)) + ' · cerrado</option>' : '') +
        groupedOptions(ids, current) + '</select><div class="pp-selection">' + img(current) + '<div><small>' +
        esc(season(current)) + '</small><strong>' + esc(title(current)) + '</strong></div></div>' + form;
    }

    paint() {
      const groups = [
        ['Invitaciones recibidas', this.invites.filter(i => i.direction === 'received' && i.status === 'pending')],
        ['Partidas en pareja', this.invites.filter(i => i.status === 'accepted')],
        ['Esperando respuesta', this.invites.filter(i => i.direction === 'sent' && i.status === 'pending')]
      ];
      const lists = groups.filter(([,items]) => items.length).map(([heading, items]) =>
        '<section><h3>' + heading + '</h3><ul class="pp-list">' + items.map(i =>
          invitationCard(i, this.available.includes(i.caseId), this.confirming)).join('') + '</ul></section>').join('');
      this.innerHTML = '<section class="pp-panel" aria-labelledby="pp-title"><header><h2 id="pp-title">Jugar en pareja</h2>' +
        '<p>Elige con quién investigar cada caso. Cada persona juega desde su cuenta y necesita tener ese juego abierto en su propio pase.</p></header>' +
        '<div class="pp-layout"><section class="pp-compose">' + this.compose() + '</section><div class="pp-inbox">' +
        (lists || '<section><h3>Tus invitaciones</h3><p>Cuando te inviten al correo de esta cuenta, podrás responder aquí. También verás las invitaciones que envíes.</p></section>') +
        '<button type="button" class="text-button" data-partner-action="reload">Actualizar invitaciones</button></div></div>' +
        '<p role="status" aria-live="polite" tabindex="-1" class="pp-status"></p></section>';
    }
  }
  if (!customElements.get('profile-partners')) customElements.define('profile-partners', ProfilePartners);
})();
