(() => {
  'use strict';
  const controls = [
    {key:'largeType', label:'Aumentar el tamaño del texto'},
    {key:'still', label:'Reducir animaciones y transiciones'}
  ];
  const key = 'lup-display-preferences-v1';
  let values = {};
  try { values = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  const apply = () => {
    for (const item of controls) {
      document.documentElement.classList.toggle('lup-' + item.key, values[item.key] === true);
    }
  };
  apply();
  class DisplayPreferences extends HTMLElement {
    connectedCallback() {
      if (this.childElementCount) return;
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Lectura y movimiento en este dispositivo';
      fieldset.append(legend);
      const status = document.createElement('p');
      status.setAttribute('role','status');
      for (const item of controls) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = values[item.key] === true;
        input.addEventListener('change', () => {
          values[item.key] = input.checked;
          apply();
          try {
            localStorage.setItem(key, JSON.stringify(values));
            status.textContent = 'Preferencias guardadas en este dispositivo.';
          } catch { status.textContent = 'Preferencias aplicadas para esta visita.'; }
        });
        label.append(input,document.createTextNode(' ' + item.label));
        fieldset.append(label);
      }
      this.append(fieldset,status);
    }
  }
  customElements.define('display-preferences', DisplayPreferences);
})();
