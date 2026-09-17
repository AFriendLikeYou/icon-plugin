  // =========================================================================
  // Kopf / Auswahl / Startseite
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

  // ---- Startseite ---------------------------------------------------------
  // Ohne Ziel zeigt der Icon-Tab eine Startseite: Begrüßung mit Modus-Chip,
  // Checkliste „Erste Schritte“, Suchfeld und die Liste aller Icons im File.
  // Die Daten liefert der Hauptthread auf `uebersicht`.
  let uebersichtDaten = null, uebersichtZeit = 0, uebersichtTimer = null;
  let startSuche = '', startAufgebaut = false;

  function uebersichtAnfordern(sofort) {
    const jetzt = Date.now();
    const rest = 2000 - (jetzt - uebersichtZeit);
    if (!sofort && rest > 0) {                       // höchstens alle 2 s
      if (!uebersichtTimer) uebersichtTimer = setTimeout(() => {
        uebersichtTimer = null; uebersichtAnfordern(true);
      }, rest);
      return;
    }
    uebersichtZeit = jetzt;
    send({ type: 'uebersicht' });
  }
  bei('uebersicht', m => { uebersichtDaten = m; startseiteFuellen(); });
  bei('fazit', () => uebersichtAnfordern());
  // Beim Start (erste `konfig`-Antwort) einmal holen — davor kennt der
  // Hauptthread weder Konfig noch Adapter.
  bei('konfig', () => uebersichtAnfordern(true));

  function startseiteAufbauen() {
    if (startAufgebaut) return;
    const box = $('leerzustand');
    const s = document.createElement('div');
    s.className = 'startseite';
    s.id = 'startseite';
    s.innerHTML =
      '<div class="fhilfe" id="startHinweis"></div>'
      + '<div id="esKarte"></div>'
      + '<div class="start-kopf"><span class="stitel" id="startTitel"></span>'
      + '<span class="chip grau schip" id="startModus"></span></div>'
      + '<fig-input-text id="startSuche" type="search" class="start-suche"></fig-input-text>'
      + '<div class="start-summe" id="startSumme"></div>'
      + '<div class="ikarten" id="startListe"></div>';
    box.insertBefore(s, $('btnBeispiel'));
    $('startSuche').addEventListener('input', e => {
      startSuche = String((e && e.detail != null) ? e.detail : $('startSuche').value || '');
      startListeZeichnen();
    });
    startAufgebaut = true;
  }

  function startseiteFuellen() {
    if (!startAufgebaut) return;
    $('startHinweis').textContent = t('start.hinweis');
    $('startTitel').textContent = t('start.titel');
    $('startModus').textContent = adapterAktiv === 'zds' ? t('adapter.zds') : t('adapter.frei');
    $('startSuche').setAttribute('placeholder', t('start.suche'));
    ersteSchritteZeichnen($('esKarte'));
    startListeZeichnen();
  }

  function startSummeZeichnen() {
    const z = (uebersichtDaten && uebersichtDaten.zusammenfassung) || null;
    $('startSumme').textContent = z
      ? t('start.summe', { icons: z.icons || 0, ohneSet: z.ohneSet || 0, veraltet: z.veraltet || 0 })
      : '';
  }

  function startListeZeichnen() {
    const liste = $('startListe');
    if (!liste) return;
    liste.textContent = '';
    startSummeZeichnen();
    if (!uebersichtDaten) {
      const d = document.createElement('div');
      d.className = 'startleer';
      d.textContent = t('start.laden');
      liste.appendChild(d);
      return;
    }
    const alle = uebersichtDaten.eintraege || [];
    const such = startSuche.toLowerCase();
    const treffer = such ? alle.filter(e => String(e.name || '').toLowerCase().indexOf(such) >= 0) : alle;
    if (!treffer.length) {
      const d = document.createElement('div');
      d.className = 'startleer';
      d.textContent = t('start.leer');
      liste.appendChild(d);
      return;
    }
    if (such) $('startSumme').textContent = t('start.treffer', { n: treffer.length, m: alle.length });
    treffer.forEach(e => {
      const k = document.createElement('div');
      k.className = 'ikarte';
      const n = document.createElement('span');
      n.className = 'iname';
      n.textContent = e.name || '';
      k.appendChild(n);
      if (e.groessen && e.groessen.length) {
        const gr = document.createElement('span');
        gr.className = 'igroessen';
        gr.textContent = e.groessen.map(v => zahl(v)).join(' · ');
        k.appendChild(gr);
      }
      const c = document.createElement('span');
      if (!e.hatSet) { c.className = 'chip rot'; c.textContent = t('start.ohneSet'); }
      else if (e.veraltet) { c.className = 'chip geraten'; c.textContent = t('start.veraltet'); }
      else { c.className = 'chip gruen'; c.textContent = t('start.ok'); }
      k.appendChild(c);
      k.addEventListener('click', () => {
        if (beschaeftigt) return;
        send({ type: 'fokus', nodeId: e.nodeId || null });
      });
      liste.appendChild(k);
    });
  }

  // Ohne Ziel: Startseite statt der alten Erklärliste. Im ZDS-Modus bleibt
  // zusätzlich der Hinweis „Karte auswählen“, der Beispiel-Button entfällt dort.
  function leerzustandZeichnen() {
    const box = $('leerzustand');
    const zds = adapterAktiv === 'zds';
    box.hidden = hatAuswahl;
    startseiteAufbauen();
    // Leeres File: Haupt-Button „Beispiel-Icon anlegen“; sonst führt die Liste.
    const leerFile = !uebersichtDaten || !(uebersichtDaten.eintraege || []).length;
    $('leerKarte').hidden = !(zds && leerFile);
    box.querySelectorAll('ul').forEach(ul => { ul.hidden = true; });
    const kopf = box.querySelector('.gruppenkopf');
    if (kopf) kopf.hidden = true;
    $('btnBeispiel').hidden = !leerFile;
    aus($('btnBeispiel'), beschaeftigt);
    if (!hatAuswahl) startseiteFuellen();
    lizenzZeichnen();
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
