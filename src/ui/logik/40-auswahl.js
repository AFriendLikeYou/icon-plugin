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

  // Titelzeile: Name, Klassen-Chip, Status-Chip (§39.7b). Die Klasse ist kein
  // eigenes Feld mehr — im ZDS-Modus steht sie fest (sie kommt aus dem Grid),
  // im freien Modus öffnet der Chip ein kleines Menü mit den vier Klassen.
  function auswahlZeichnen() {
    const txt = $('auswahlText');
    txt.textContent = hatAuswahl && ziel ? ziel.name : t('auswahl.leer');
    txt.className = 'tname' + (hatAuswahl ? '' : ' leer');
    $('auswahl').hidden = !hatAuswahl;

    const frei = !!(ziel && ziel.adapter === 'frei');
    const geraten = !!(ziel && ziel.klasseQuelle === 'heuristik');
    const kchip = $('klasseChip');
    if (hatAuswahl && ziel && ziel.klasse) {
      kchip.className = 'chip grau klassechip' + (frei ? ' klickbar' : '');
      kchip.textContent = ziel.klasse + (geraten ? ' ?' : '');
      kchip.title = geraten ? t('klasse.geratenTip') : (frei ? t('klasse.wechselnTip') : t('klasse.festTip'));
    } else { kchip.className = 'chip klassechip'; kchip.textContent = ''; kchip.title = ''; }
    if (!frei) klasseMenuSetzen(false);
    leerzustandZeichnen();
  }

  // ---- Klassen-Menü (nur Frei-Modus) --------------------------------------
  function klasseMenuSetzen(auf) {
    const m = $('klasseMenu');
    if (!m) return;
    try { m.open = auf; } catch (e) { if (auf) m.setAttribute('open', 'true'); else m.removeAttribute('open'); }
  }
  $('klasseChip').addEventListener('click', e => {
    if (!hatAuswahl || beschaeftigt) return;
    if (!ziel || ziel.adapter !== 'frei') return;
    e.stopPropagation();
    klasseMenuSetzen(!$('klasseMenu').open);
  });
  $('klasseMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-klasse]');
    if (!b) return;
    klasseMenuSetzen(false);
    const k = b.getAttribute('data-klasse');
    if (!k || beschaeftigt || !hatAuswahl || (ziel && ziel.klasse === k)) return;
    send({ type: 'klasseSetzen', klasse: k });
  });
  document.addEventListener('click', e => {
    if ($('klasseMenu').open && !$('klasseMenu').contains(e.target) && e.target !== $('klasseChip')) {
      klasseMenuSetzen(false);
    }
  }, true);

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
  bei('uebersicht', m => { uebersichtDaten = m; startseiteFuellen(); libSummeZeichnen(); });
  bei('fazit', () => uebersichtAnfordern());
  // Beim Start (erste `konfig`-Antwort) einmal holen — davor kennt der
  // Hauptthread weder Konfig noch Adapter.
  bei('konfig', () => uebersichtAnfordern(true));

  // ---- Umfang: Dieses Icon | Ganze Library (§34) --------------------------
  // Der Umschalter ersetzt die früheren Gruppen. „Ganze Library“ ist zugleich
  // die Startseite: die Icon-Liste steht dort, wo sonst die Vorschau liegt.
  let umfang = 'icon', ausListe = false;
  // Klick in der Library-Liste führt ins Icon: dort steht die Vorschau.
  bei('auswahl', m => {
    if (!ausListe) return;
    ausListe = false;
    if (m && m.ziel) umfangSetzen('icon', true);
  });
  function umfangAnwenden(melden) {
    const lib = umfang === 'library';
    $('grpIcon').hidden = lib;
    $('grpLibrary').hidden = !lib;
    $('titelzeile').hidden = lib;
    $('libSumme').hidden = !lib;
    try { $('segUmfang').setAttribute('value', umfang); } catch (e) {}
    if (lib) uebersichtAnfordern();
    libSummeZeichnen();
    leerzustandZeichnen();
    if (melden) send({ type: 'merkerSetzen', schluessel: 'umfang', wert: umfang });
  }
  function umfangSetzen(v, melden) {
    const neu = v === 'library' ? 'library' : 'icon';
    if (neu === umfang) return;
    umfang = neu;
    umfangAnwenden(melden);
  }
  function libSummeZeichnen() {
    const z = (uebersichtDaten && uebersichtDaten.zusammenfassung) || null;
    $('libSumme').textContent = z
      ? t('start.summe', { icons: z.icons || 0, ohneSet: z.ohneSet || 0, veraltet: z.veraltet || 0 })
      : t('start.laden');
  }
  $('segUmfang').addEventListener('change', e => {
    umfangSetzen(String((e && e.detail) || $('segUmfang').value || 'icon'), true);
  });
  bei('merker', m => {
    if (!m || m.schluessel !== 'umfang') return;
    if (m.wert !== 'icon' && m.wert !== 'library') return;
    umfang = m.wert;
    umfangAnwenden(false);
  });
  send({ type: 'merkerLaden', schluessel: 'umfang' });

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
        ausListe = true;
        send({ type: 'fokus', nodeId: e.nodeId || null });
      });
      liste.appendChild(k);
    });
  }

  // „Ganze Library“ zeigt die Icon-Liste (Startseite) an der Stelle der
  // Vorschau. „Dieses Icon“ ohne Auswahl zeigt nur einen kurzen Hinweis und
  // den Beispiel-Button.
  function leerzustandZeichnen() {
    const box = $('leerzustand');
    const zds = adapterAktiv === 'zds';
    const lib = umfang === 'library';
    box.hidden = !lib && hatAuswahl;
    startseiteAufbauen();
    const leerFile = !uebersichtDaten || !(uebersichtDaten.eintraege || []).length;
    $('startseite').hidden = !lib;
    $('leerHinweis').hidden = lib || hatAuswahl;
    $('leerKarte').hidden = !(zds && !lib && !hatAuswahl);
    $('btnBeispiel').hidden = !leerFile || (lib && !leerFile);
    aus($('btnBeispiel'), beschaeftigt);
    if (lib) startseiteFuellen();
    // Die Vorschau gehört zum Modus „Dieses Icon“.
    if (lib) $('diff').classList.remove('an');
    else if (letzterDiff) $('diff').classList.add('an');
    lizenzZeichnen();
  }

  $('auswahl').addEventListener('click', () => {
    if (hatAuswahl && !beschaeftigt) send({ type: 'fokus' });
  });
