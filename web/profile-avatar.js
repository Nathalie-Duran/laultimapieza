(function (root) {
  'use strict';

  const portraits = new Set(['cobre', 'jade', 'ambar', 'tinta', 'coral', 'plata']);

  function markup() {
    return `<div class="profile-portrait-preview">
      <span class="profile-portrait-badge" aria-hidden="true">
        <canvas class="profile-portrait-picture" width="144" height="144" hidden></canvas>
        <span class="profile-portrait-initials"></span>
      </span>
      <span class="profile-portrait-caption"><span class="profile-portrait-label">Vista previa</span><strong class="profile-portrait-name" dir="auto"></strong></span>
    </div>`;
  }

  function render(form) {
    const preview = form.querySelector('.profile-portrait-preview');
    if (!preview) return;
    const alias = String(form.elements.namedItem('name')?.value || '').trim();
    const color = String(form.elements.namedItem('color')?.value || '');
    const words = alias.split(/\s+/).filter(Boolean);
    const initials = preview.querySelector('.profile-portrait-initials');
    preview.querySelector('.profile-portrait-name').textContent = alias || 'Tu alias';
    initials.textContent = words.slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('es') || '?';
    const colorRadio = form.querySelector('input[name="color"]:checked');
    const swatch = colorRadio?.labels?.[0]?.querySelector('.color-dot');
    const selectedColor = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : swatch && root.getComputedStyle(swatch).backgroundColor;
    if (selectedColor && selectedColor !== 'transparent' && selectedColor !== 'rgba(0, 0, 0, 0)') preview.style.setProperty('--portrait-color', selectedColor);
    else preview.style.removeProperty('--portrait-color');

    const radio = form.querySelector('input[name="avatarChoice"]:checked');
    const image = portraits.has(radio?.value) ? radio.labels?.[0]?.querySelector('img') : null;
    const picture = preview.querySelector('.profile-portrait-picture');
    let drawn = false;
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const context = picture.getContext('2d');
      if (context) {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
          side, side, 0, 0, picture.width, picture.height);
        drawn = true;
      }
    }
    picture.hidden = !drawn;
    initials.hidden = drawn;
  }

  function onField(event) {
    if (['avatarChoice', 'name', 'color'].includes(event.target.name)) render(event.currentTarget);
  }

  function onPortraitLoad(event) {
    if (event.target.matches?.('.portrait-choices img')) render(event.currentTarget);
  }

  function mount(form) {
    if (!form || form.id !== 'profile-form') return;
    form.addEventListener('input', onField);
    form.addEventListener('change', onField);
    form.addEventListener('load', onPortraitLoad, true);
    form.addEventListener('error', onPortraitLoad, true);
    render(form);
  }

  root.ProfilePortraitPreview = { markup, mount };
})(window);
