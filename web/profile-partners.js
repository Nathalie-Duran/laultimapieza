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
  const gameUrl = (id, resume = false) => '/#' + (id <= 12 ? 'valdemar-jugar' : 'mundos-jugar') + '?id=' + id + (resume ? '&retomar=1' : '');
  const linkToPass = '<a class="button" href="/#planes">Ver mi pase</a>';
  const euros = new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'});

  function promotionCopy(offer) {
    if (!offer || offer.percentOff !== 50 || offer.currency !== 'eur') return null;
    if (offer.status === 'eligible' && offer.eligible === true) {
      const rate = Number.isInteger(offer.amountCents) && offer.amountCents > 0 ? euros.format(offer.amountCents / 100) + ' por cuota. ' : '';
      return {title:'50 % en tus próximas cuotas', body:rate + 'El descuento se aplica a la siguiente factura de cada uno mientras os tengáis guardados mutuamente y mantengáis las dos suscripciones activas. Si cambia la pareja o termina uno de los pases, las siguientes cuotas vuelven al precio habitual.'};
    }
    if (offer.status === 'saved') return {title:'Tu promoción del 50 % está pendiente',
      body:'Cada alta se paga al precio habitual. Cuando os tengáis guardados mutuamente y cada uno tenga su propia suscripción activa, ambos recibiréis el 50 % desde vuestra siguiente factura.'};
    if (offer.status === 'no_partner') return {title:'Juega en pareja con un 50 % en tus cuotas',
      body:'Guardad el correo del otro y contratad vuestro propio pase. Cada alta se paga al precio habitual. Desde la siguiente factura, ambos tendréis el 50 % mientras sigáis en pareja y los dos pases estén activos.'};
    return null;
  }

  class PreferredPartner extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `<section class="pp-preference" aria-labelledby="pp-preference-title">
        <div class="pp-preference-intro"><h2 id="pp-preference-title">Tu compañero de juego</h2>
        <p id="pp-preference-help">Guardad el correo del otro para jugar juntos en los cuatro tableros.</p></div>
        <form class="pp-preference-form"><label for="pp-preferred-email">Correo de tu compañero de juego</label>
        <div class="pp-preference-controls"><input id="pp-preferred-email" type="email" name="email" required maxlength="254"
          autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nombre@ejemplo.es" aria-describedby="pp-preference-help">
        <button class="button primary" type="submit">Guardar correo</button></div>
        <div class="pp-preference-feedback"><span role="status" aria-live="polite"></span>
        <button class="text-button" type="button" data-pref-remove hidden>Quitar correo</button>
        <button class="text-button" type="button" data-pref-retry hidden>Volver a intentar</button></div>
        <div class="pp-confirm" role="group" aria-labelledby="pp-confirm-title" hidden><strong id="pp-confirm-title">Revisa el cambio de compañero</strong>
        <p data-pref-impact></p><div><button type="button" class="button" data-pref-cancel>Conservar mi correo</button>
        <button type="button" class="button primary" data-pref-confirm>Confirmar cambio</button></div></div></form>
        <aside class="pp-offer" aria-label="Promoción para jugar en pareja" hidden></aside></section>`;
      const form = this.querySelector('form');
      form.onsubmit = event => {
        event.preventDefault();
        if (!this.busy) this.change(form.elements.email.value.trim());
      };
      form.elements.email.oninput = () => this.dismissChange();
      this.querySelector('[data-pref-remove]').onclick = () => this.change(null);
      this.querySelector('[data-pref-retry]').onclick = () => this.sync();
      this.querySelector('[data-pref-cancel]').onclick = () => {
        this.dismissChange();
        form.elements.email.value = this.savedEmail;
        form.elements.email.focus();
      };
      this.querySelector('[data-pref-confirm]').onclick = () => {
        const pending = this.pendingChange;
        this.dismissChange();
        if (pending) this.sync(pending);
      };
      this.sync();
    }

    disconnectedCallback() { this.readToken = null; this.busy = false; }

    dismissChange() {
      this.pendingChange = null;
      this.querySelector('.pp-confirm').hidden = true;
    }

    change(email) {
      if (this.busy) return;
      const same = (email || '').toLowerCase() === (this.savedEmail || '').toLowerCase();
      const membership = window.ClubAccess?.state;
      const paid = membership?.ownAccess === true && membership.role !== 'admin';
      const changesPrice = paid && this.offer?.status === 'eligible' && this.offer.eligible === true;
      if (same || !this.hasPartnerGames && !changesPrice) {
        this.dismissChange();
        this.sync({email});
        return;
      }
      const impact = [];
      if (this.hasPartnerGames) {
        impact.push(email ? 'Se cerrarán las solicitudes y las partidas en pareja que no correspondan al nuevo compañero.' :
          'Se cerrarán las solicitudes pendientes y las partidas en pareja con este compañero.');
        impact.push('Cada persona conservará su progreso para seguir a solas.');
      }
      if (changesPrice) {
        const price = Number.isInteger(this.offer.regularAmountCents) && this.offer.regularAmountCents > 0 ?
          ' de ' + euros.format(this.offer.regularAmountCents / 100) + '/mes' : '';
        impact.push('La promoción de vuestra pareja terminará. Las próximas cuotas aún no emitidas volverán a la tarifa habitual' + price + ', salvo que se cumplan de nuevo las condiciones del descuento.');
      }
      const confirmation = this.querySelector('.pp-confirm');
      this.pendingChange = {email};
      confirmation.querySelector('[data-pref-impact]').textContent = impact.join(' ');
      confirmation.querySelector('[data-pref-confirm]').textContent = email ? 'Confirmar y cambiar el correo' : 'Confirmar y quitar el correo';
      confirmation.hidden = false;
      confirmation.querySelector('[data-pref-cancel]').focus();
    }

    async sync(body) {
      if (this.busy) return;
      const token = this.readToken = Symbol();
      const form = this.querySelector('form');
      const email = form.elements.email, save = form.querySelector('[type="submit"]');
      const remove = form.querySelector('[data-pref-remove]'), retry = form.querySelector('[data-pref-retry]');
      const status = form.querySelector('[role="status"]');
      const reading = body === undefined;
      this.busy = true;
      email.disabled = save.disabled = remove.disabled = true;
      retry.hidden = true;
      this.setAttribute('aria-busy','true');
      status.textContent = reading ? 'Cargando…' : 'Guardando…';
      try {
        const data = reading ? undefined : {...body, expectPartnerGames:this.hasPartnerGames,
          ...(typeof this.offer?.eligible === 'boolean' ? {expectEligible:this.offer.eligible} : {})};
        const response = await window.GameAccountBridge.request('/api/partners/preferred', data);
        if (this.readToken !== token) return;
        this.applyPreference(response);
        email.value = this.savedEmail;
        status.textContent = reading ? '' : this.savedEmail ? 'Correo guardado.' : 'Correo retirado.';
        if(!reading)this.parentElement?.querySelector('profile-partners')?.refresh();
      } catch (error) {
        if (this.readToken !== token) return;
        if (!reading && ['PARTNER_OFFER_CHANGED','PARTNER_GAMES_CHANGED'].includes(error.code)) {
          try {
            const current = await window.GameAccountBridge.request('/api/partners/preferred');
            if (this.readToken !== token) return;
            this.applyPreference(current);
            email.value = body.email ?? this.savedEmail;
            status.textContent = error.code === 'PARTNER_GAMES_CHANGED' ? 'Han cambiado tus partidas en pareja. Revisa el cambio antes de confirmar.' :
              'La promoción ha cambiado. Revisa las condiciones actualizadas antes de confirmar tu elección.';
          } catch {
            if (this.readToken !== token) return;
            retry.hidden = false;
            status.textContent = 'Actualiza los datos de tu compañero antes de volver a intentarlo.';
          }
        } else {
          retry.hidden = !reading;
          status.textContent = error.message || 'No se ha podido consultar el correo.';
        }
      } finally {
        if (this.readToken === token) {
          this.busy = false;
          this.removeAttribute('aria-busy');
          email.disabled = save.disabled = remove.disabled = !retry.hidden;
          if (!reading) email.focus({preventScroll:true});
        }
      }
    }

    applyPreference(response) {
      this.savedEmail = response.preferredEmail || '';
      this.hasPartnerGames = response.hasPartnerGames === true;
      this.offer = response.partnerOffer;
      this.querySelector('[data-pref-remove]').hidden = !this.savedEmail;
      this.showPromotion(this.offer);
    }

    showPromotion(offer) {
      const club = window.ClubAccess;
      if (offer && club?.state && typeof club.set === 'function') club.set({...club.state, partnerOffer:offer});
      const panel = this.querySelector('.pp-offer');
      if (club?.state?.role === 'admin' && offer?.status === 'editorial' && offer.percentOff === 50) {
        panel.hidden = false;
        panel.innerHTML = '<div><h3>Oferta para jugadores</h3><p>Cada alta se paga al precio habitual. Si dos jugadores se guardan mutuamente y ambos tienen una suscripción activa, cada uno recibe el 50 % desde su siguiente factura. La promoción continúa mientras sigan en pareja y con los dos pases activos.</p><span>Tu acceso editorial ya está incluido.</span></div>';
        return;
      }
      const promo = club?.state?.role === 'admin' ? null : promotionCopy(offer);
      panel.hidden = !promo;
      if (!promo) { panel.replaceChildren(); return; }
      const price = Number.isInteger(offer.regularAmountCents) && offer.regularAmountCents > 0 ?
        '<span>Tarifa individual habitual · ' + esc(euros.format(offer.regularAmountCents / 100)) + '/mes</span>' : '';
      const label = offer.eligible && club?.state?.ownAccess ? 'Ver las condiciones de mi pase' : 'Ver el pase y las condiciones';
      panel.innerHTML = '<div><h3>' + esc(promo.title) + '</h3><p>' + esc(promo.body) + '</p>' + price +
        '</div><a class="button" href="/#planes">' + label + '</a>';
    }
  }

  function expiry(value) {
    if (!value) return '';
    const when = new Date(value);
    return Number.isFinite(when.getTime()) ? 'Disponible hasta el ' + dateFormat.format(when) + '.' : '';
  }

  function img(id) {
    const src = picture(id);
    return src ? '<img class="pp-cover" src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '';
  }

  function caseCard(record, available, hasContact) {
    const {caseId, status, direction} = record;
    const accepted = status === 'accepted';
    const first = direction === 'sent';
    const story = details(caseId);
    const role = (first ? story?.roleA : story?.roleB) || story?.roles?.[first ? 0 : 1];
    const assignment = accepted ? '<p class="pp-role"><strong>Juegas el papel ' + (first ? 1 : 2) + '</strong>' +
      (role ? '<span>' + esc(role) + '</span>' : '') + '</p>' : '';
    const message = accepted ? 'Vuestra partida está lista para continuar.' : first ?
      'Ya has elegido «En pareja». Falta que tu compañero lo elija en este juego.' :
      'Tu compañero ya ha elegido «En pareja». Abre el juego y confirma desde tu cuenta.';
    const partner = record.partnerName || record.partnerEmail;
    const who = partner ? '<p class="pp-who">Con ' + esc(partner) + '</p>' : '';
    const note = !accepted && record.expiresAt ? '<p>' + esc(expiry(record.expiresAt)) + '</p>' : '';
    const open = '<a class="button primary" href="' + gameUrl(caseId, accepted) + '">' +
      (accepted ? 'Continuar la partida' : 'Abrir el juego') + '</a>';
    return '<li class="pp-card">' + img(caseId) + '<div><small>' + esc(season(caseId)) + '</small><h4>' +
      esc(title(caseId)) + '</h4>' + who + assignment + '<p>' + esc(message) + '</p>' + note +
      (!hasContact && !first && !accepted ? '<p>En el juego podrás guardar a esta persona como tu compañero.</p>' : '') +
      (!available ? '<p>Necesitas acceso a este juego en tu cuenta.</p>' : '') +
      '<div class="pp-actions">' + (available ? open : open + linkToPass) + '</div></div></li>';
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
      this.onchange = event => {
        if (event.target.name !== 'game') return;
        this.selected = Number(event.target.value);
        this.querySelector('.pp-compose').innerHTML = this.compose();
        this.querySelector('[name="game"]')?.focus();
      };
      this.onclick = event => {
        if (event.target.closest('[data-partner-reload]')) this.refresh();
      };
      this.refresh();
    }

    disconnectedCallback() { this.request = null; }

    async refresh() {
      const request = this.request = Symbol();
      this.innerHTML = '<p role="status" class="pp-status">Cargando las partidas en pareja…</p>';
      try {
        const result = await window.GameAccountBridge.request('/api/partners');
        if (this.request !== request) return;
        this.available = result.availableCases.filter(validId).sort((a, b) => a - b);
        this.records = result.invitations.filter(i => validId(i.caseId));
        this.preferredEmail = result.preferredEmail || '';
        this.paint();
      } catch (error) {
        if (this.request === request) this.innerHTML = '<div class="pp-feedback"><p role="alert">' +
          esc(error.message || 'No se han podido cargar las partidas.') +
          '</p><button type="button" class="button" data-partner-reload>Volver a intentar</button></div>';
      }
    }

    compose() {
      const ids = this.available;
      if (!ids.length) return '<h3>Acceso a los juegos</h3><p>Los casos que abras con tu pase aparecerán aquí.</p>' + linkToPass;
      if (!validId(this.selected)) this.selected = ids[0];
      const current = this.selected;
      const available = ids.includes(current);
      return '<label for="pp-game">Elige un juego de tus tableros</label><select id="pp-game" name="game">' +
        (available ? '' : '<option value="' + current + '" selected>' + esc(title(current)) + ' · cerrado</option>') +
        groupedOptions(ids, current) + '</select><div class="pp-selection">' + img(current) + '<div><small>' +
        esc(season(current)) + '</small></div></div>' +
        (available ? '<a class="button primary" href="' + gameUrl(current) + '">Abrir el juego</a>' :
          '<p>Este juego aún está cerrado en tu cuenta.</p>' + linkToPass);
    }

    paint() {
      const groups = [
        ['Falta tu confirmación', this.records.filter(i => i.direction === 'received' && i.status === 'pending')],
        ['Jugando en pareja', this.records.filter(i => i.status === 'accepted')],
        ['Esperando a tu compañero', this.records.filter(i => i.direction === 'sent' && i.status === 'pending')]
      ];
      const lists = groups.filter(([,items]) => items.length).map(([heading, items]) =>
        '<section><h3>' + heading + '</h3><ul class="pp-list">' + items.map(i =>
          caseCard(i, this.available.includes(i.caseId), !!this.preferredEmail)).join('') + '</ul></section>').join('');
      this.innerHTML = '<section class="pp-panel" aria-labelledby="pp-title"><header><h2 id="pp-title">Partidas compartidas</h2></header><div class="pp-layout"><section class="pp-compose">' + this.compose() + '</section><div class="pp-inbox">' +
        (lists || (this.available.length?'<p>Abrid el mismo caso y elegid «En pareja» desde ambas cuentas.</p>':'')) +
        '<button type="button" class="text-button" data-partner-reload>Actualizar partidas</button></div></div></section>';
    }
  }
  if (!customElements.get('preferred-partner')) customElements.define('preferred-partner', PreferredPartner);
  if (!customElements.get('profile-partners')) customElements.define('profile-partners', ProfilePartners);
})();
