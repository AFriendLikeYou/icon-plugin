  // =========================================================================
  // Sprache / Texte
  // =========================================================================
  function effektiveSprache() {
    const s = KONFIG && KONFIG.sprache;
    if (!s || s === 'auto') return navSprache();
    return s === 'de' ? 'de' : 'en';
  }
  function texteSetzen() {
    document.querySelectorAll('[data-t]').forEach(el => {
      el.textContent = t(el.getAttribute('data-t'));
    });
    document.querySelectorAll('[data-t-text]').forEach(el => {
      el.setAttribute('text', t(el.getAttribute('data-t-text')));
    });
    document.querySelectorAll('[data-t-ph]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-t-ph')));
    });
    document.querySelectorAll('[data-t-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-t-title')));
    });
    document.querySelectorAll('[data-t-label]').forEach(el => {
      el.setAttribute('label', t(el.getAttribute('data-t-label')));
    });
    // Dropdowns spiegeln ihre <option>-Kinder in ein internes <select> —
    // nach Textwechsel neu einlesen lassen.
    document.querySelectorAll('fig-dropdown').forEach(d => {
      try { if (typeof d.slotChange === 'function') d.slotChange(); } catch (e) {}
    });
    auswahlZeichnen();
    protokollZeichnen();
    adapterChipSetzen();
    if (cfgLokal) { masterZeichnen(); groessenZeichnen(); farbeZeichnen(); schreibenZeichnen(); }
    fehlerZeichnen();
    profilListeZeichnen();
    planZeichnen();
    berichtZeichnen();
    if (letzterDiff) renderDiff();
  }
  function spracheAbgleichen() {
    const neu = effektiveSprache();
    if (neu === SPR) return false;
    SPR = neu;
    texteSetzen();
    return true;
  }

