(function(root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const illustrations = {
    'archivo-ausencias':'archivo-ausencias.jpg', 'ciudad-invisible':'partida-barrio-archivo.webp',
    'frecuencia-17':'frecuencia-17.jpg', 'habitacion-309':'habitacion-309.jpg',
    'jardin-invierno':'jardin-invierno.jpg', 'marea-quieta':'marea-quieta.jpg',
    'mesa-13':'mesa-13.jpg', 'retrato-prestado':'retrato-prestado.jpg',
    'tren-detenido':'tren-detenido.jpg', 'ultima-funcion':'ultima-funcion.jpg',
    'ultima-invitacion':'ultima-invitacion.jpg', 'ultimo-coro':'ultimo-coro.jpg'
  };
  const paragraphs = lines => (lines || []).map(line => '<p>'+escape(line)+'</p>').join('');

  function evidence(entry, role) {
    if (!entry) return '';
    return `<section class="evidence pe-role" data-role="${escape(role)}">
      <div class="pe-meta">Tu expediente · ${escape(role)}</div>
      <h3>${escape(entry.title)}</h3><p>${escape(entry.text)}</p></section>`;
  }

  function reading(story, node, role, solo, first) {
    const introduction = first && story.introduction?.length
      ? `<details class="pe-context"><summary>Quiénes sois en esta historia</summary>${paragraphs(story.introduction)}</details>`
      : '';
    const otherRole = role === 'B' ? 'A' : 'B';
    const otherEvidence = solo && node.evidence?.[otherRole]
      ? `<details class="pe-alternate"><summary>Consultar también el expediente ${otherRole}</summary>${evidence(node.evidence[otherRole],otherRole)}</details>`
      : '';
    return `<div class="pe-reading">${paragraphs(node.text)}</div>
      ${evidence(node.evidence?.[role],role)}${otherEvidence}${introduction}`;
  }

  function endReading(session, story, ending) {
    const explanation = session.investigation?.solvedAt || story.season !== 1
      ? `<section class="evidence pe-role"><h3>Así encajaban las piezas.</h3><p>${escape(ending.explanation)}</p></section>`
      : '<p class="investigation-state">La explicación completa se abre al contrastar tu enigma. Tus decisiones narrativas ya están guardadas.</p>';
    let coda;
    if (story.season === 1) {
      coda = `<p>${escape(ending.professionalCoda)}</p>`;
      if (ending.romanticCoda && ending.romanticCoda !== ending.professionalCoda) {
        coda += `<details class="optional-coda pe-alternate"><summary>Un momento más entre los dos</summary><p>${escape(ending.romanticCoda)}</p><p class="micro">Una escena opcional entre los personajes. Puedes leerla sin cambiar vuestro final ni la puntuación.</p></details>`;
      }
    } else {
      const romantic = session.history.some(turn => (turn.effects?.romanticismo || 0) > 0);
      coda = `<p>${escape(romantic ? ending.romanticCoda : ending.professionalCoda)}</p>`;
    }
    return `<div class="pe-reading">${paragraphs(ending.text)}</div>${explanation}
      <div class="pe-reading"><p class="ending-reflection">${escape(ending.reflection)}</p>${coda}</div>`;
  }

  function chapter(session, story, node, ending, role, first) {
    const meta = ending ? ['Desenlace', ending.subtitle] : [node.chapter,story.roles?.[role]?.name || 'Investigador '+role];
    const title = ending ? ending.title : node.title;
    const illustration = illustrations[story.id];
    const image = illustration ? `<img class="pe-photo" src="/${illustration}" alt="" decoding="async">` : '';
    const body = ending ? endReading(session,story,ending) : reading(story,node,role,session.mode === 'solo',first);
    return `<article id="game-reading" class="chapter pe-dossier${ending ? ' pe-ending' : ''}" tabindex="-1" aria-labelledby="pe-chapter-title">
      <header class="pe-cover${image ? '' : ' pe-no-photo'}"><div class="pe-title"><span class="pe-meta">${meta.filter(Boolean).map(escape).join(' · ')}</span>
      <h1 id="pe-chapter-title">${escape(title)}</h1></div>${image}</header>
      <div class="pe-body">${body}</div></article>`;
  }

  function shortcuts(session, ending, review, hasMedia) {
    const items = [['game-reading',ending ? 'Leer desenlace' : 'Leer historia']];
    if (hasMedia) items.push(['media-desk-title','Ver pistas']);
    if (ending) items.push(['game-epilogue','Ver epílogo']);
    else if (review) items.push(['game-choices','Revisar decisión']);
    else if (session.status === 'waiting') items.push(['game-team','Ver equipo']);
    else items.push(['game-choices','Elegir camino']);
    return `<nav class="game-shortcuts pe-steps" aria-label="Acciones de la escena">${items.map(([target,label],i) =>
      `<button type="button" data-action="game-section" data-target="${target}"><span class="pe-step-number" aria-hidden="true">${i+1}</span><span>${label}</span></button>`
    ).join('')}</nav>`;
  }
  root.EscenaClasica = {chapter,shortcuts};
})(window);
