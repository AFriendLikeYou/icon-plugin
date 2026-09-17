  // =========================================================================
  // Tabs
  // =========================================================================
  function panelsSetzen(v) {
    $('panelIcon').hidden = v !== 'icon';
    $('panelBericht').hidden = v !== 'bericht';
    $('panelCfg').hidden = v !== 'cfg';
    if (v === 'cfg') {
      if (!KONFIG) send({ type: 'konfigLaden' });
      if (cfgLokal && cfgLokal.farbe && cfgLokal.farbe.modus === 'variable') farbenAnfordern();
    }
  }
  // Tab von Hand umschalten (fig-tabs spiegelt das value-Attribut auf die Kinder).
  function tabWechseln(v) {
    const tabs = $('tabs');
    if ((tabs.getAttribute('value') || '') !== v) tabs.setAttribute('value', v);
    document.querySelectorAll('#tabs fig-tab').forEach(tb => {
      const an = tb.getAttribute('value') === v;
      if (an) tb.setAttribute('selected', 'true'); else tb.removeAttribute('selected');
    });
    panelsSetzen(v);
  }
  $('tabs').addEventListener('change', e => {
    panelsSetzen((e && e.detail) || $('tabs').value || 'icon');
  });

