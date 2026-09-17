  // =========================================================================
  // Kopf / Auswahl
  // =========================================================================
  function adapterChipSetzen() {
    const c = $('adapterChip');
    if (!adapterAktiv) { c.textContent = ''; c.className = 'chip kopfchip'; return; }
    c.className = 'chip grau kopfchip';
    c.textContent = adapterAktiv === 'zds' ? t('adapter.zds') : t('adapter.frei');
  }
  function chipLeeren() { const c = $('auswahlStatus'); c.className = 'chip'; c.textContent = ''; }

  function auswahlZeichnen() {
    const txt = $('auswahlText');
    txt.textContent = hatAuswahl && ziel ? ziel.name : t('auswahl.leer');
    txt.className = hatAuswahl ? 'name' : 'hinweis';
    $('auswahl').classList.toggle('aktiv', hatAuswahl);

    const frei = !!(ziel && ziel.adapter === 'frei');
    const kchip = $('klasseChip');
    if (hatAuswahl && ziel && ziel.klasse && !frei) {
      kchip.className = 'chip grau';
      kchip.textContent = ziel.klasse + (ziel.klasseQuelle === 'heuristik' ? ' · ' + t('klasse.geraten') : '');
    } else { kchip.className = 'chip'; kchip.textContent = ''; }

    // Frei-Modus: Klasse ist änderbar.
    $('klassenzeile').hidden = !(hatAuswahl && frei);
    if (hatAuswahl && frei) {
      wert($('klasseSel'), ziel.klasse || 'Square');
      const g = $('klasseGeraten');
      g.hidden = ziel.klasseQuelle !== 'heuristik';
      g.textContent = t('klasse.geraten');
    }
    leerzustandZeichnen();
  }

  // Ohne Ziel: im Frei-Modus die drei Erklärzeilen + Beispiel-Button,
  // im ZDS-Modus nur den Hinweis „Karte auswählen“.
  function leerzustandZeichnen() {
    const box = $('leerzustand');
    const zds = adapterAktiv === 'zds';
    box.hidden = hatAuswahl;
    $('leerKarte').hidden = !zds;
    box.querySelectorAll('ul').forEach(ul => { ul.hidden = zds; });
    const kopf = box.querySelector('.gruppenkopf');
    if (kopf) kopf.hidden = zds;
    $('btnBeispiel').hidden = zds;
    aus($('btnBeispiel'), beschaeftigt);
  }

  $('auswahl').addEventListener('click', () => {
    if (hatAuswahl && !beschaeftigt) send({ type: 'fokus' });
  });
  $('klasseSel').addEventListener('change', e => {
    const k = (e && e.detail) || $('klasseSel').value;
    if (!k || !hatAuswahl || beschaeftigt) return;
    if (ziel && ziel.klasse === k) return;
    send({ type: 'klasseSetzen', klasse: k });
  });

