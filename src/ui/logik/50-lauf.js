  // =========================================================================
  // Laufsteuerung
  // =========================================================================
  // Fortschritt: Start des Laufs für die Restzeit-Schätzung.
  let fortStart = 0;
  function zeitText(sek) {
    if (sek < 90) return t('fort.sek', { n: Math.max(1, Math.round(sek)) });
    return t('fort.min', { n: Math.max(1, Math.round(sek / 60)) });
  }
  // `progress` wird in 95-nachrichten.js bereits roh angezeigt; hier kommt die
  // verständliche Fassung („Baue 3/76 · arrow-left“) samt Restzeit darüber.
  bei('progress', m => {
    const i = Number(m.i) || 0, n = Number(m.n) || 0;
    $('zahl').textContent = t('fort.baue', { i: i, n: n }) + (m.name ? ' · ' + m.name : '');
    const rest = $('restzeit');
    if (!fortStart) { fortStart = Date.now(); rest.textContent = ''; return; }
    if (n >= 5 && i >= 2) {
      const proStueck = (Date.now() - fortStart) / i;
      rest.textContent = t('fort.rest', { zeit: zeitText(proStueck * Math.max(0, n - i) / 1000) });
    } else rest.textContent = '';
  });

  function sperren(an) {
    beschaeftigt = an;
    if (an) { chipLeeren(); fortStart = Date.now(); $('restzeit').textContent = ''; }
    aus($('btnRun'), an || !hatAuswahl);
    aus($('btnDiff'), an || !hatAuswahl);
    aus($('btnAudit'), an);
    aus($('btnAlle'), an);
    aus($('btnBeispiel'), an);
    aus($('btnBericht'), an);
    aus($('btnExport'), an);
    aus($('btnVorschauMit'), an || !hatAuswahl || !cfgLokal);
    // Abbrechen bleibt bis 'fertig' klickbar und verschwindet danach.
    $('btnAbbrechen').hidden = !an;
    aus($('btnAbbrechen'), false);
    $('fortschritt').classList.toggle('an', an);
    if (!an) { $('balken').style.width = '0%'; $('zahl').textContent = '';
      $('restzeit').textContent = ''; fortStart = 0; }
  }
  $('btnAbbrechen').addEventListener('click', () => {
    if (!beschaeftigt) return;
    send({ type: 'abbrechen' });
    aus($('btnAbbrechen'), true);
  });
  $('btnBeispiel').addEventListener('click', () => {
    if (beschaeftigt) return;
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'beispielAnlegen' });
  });

  // ---- Trockenlauf ---------------------------------------------------------
  function planAnfordern(umfang) {
    planUmfang = umfang;
    planDaten = null;
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'planen', umfang: umfang,
      snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
  }
  function bauenSenden(umfang) {
    $('fazit').className = 'fazit';
    if (umfang === 'alle') logLeeren();
    sperren(true);
    if (umfang === 'alle') send({ type: 'alle', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
    else send({ type: 'run', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
  }
  function planZeichnen() {
    if (!planDaten) return;
    const alle = planUmfang === 'alle';
    $('planTitel').textContent = t(alle ? 'dlg.plan.titelAlle' : 'dlg.plan.titelEins');
    $('planText').textContent = t(alle ? 'dlg.plan.textAlle' : 'dlg.plan.textEins');
    $('planSchalterZeile').hidden = alle;
    anhaken($('chkTrockenEinzel'), trockenlaufEinzel);
    const liste = $('planListe');
    liste.textContent = '';
    const eintraege = planDaten.eintraege || [];
    if (!eintraege.length) {
      const d = document.createElement('div');
      d.className = 'berichtleer';
      d.textContent = t('dlg.plan.leer');
      liste.appendChild(d);
    }
    eintraege.forEach(e => {
      const z = document.createElement('div');
      z.className = 'plan-zeile';
      if (e.gesperrt) {
        const s = document.createElement('span');
        s.className = 'pschloss'; s.textContent = '🔒';
        s.title = t('plan.gesperrt');
        z.appendChild(s);
      }
      const n = document.createElement('span');
      n.className = 'pname'; n.textContent = e.name || '';
      z.appendChild(n);
      const c = document.createElement('span');
      c.className = 'chip ' + (e.aktion === 'neu' ? 'gruen' : 'grau');
      c.textContent = t(e.aktion === 'neu' ? 'plan.neu' : 'plan.aendern');
      z.appendChild(c);
      const teile = [];
      const v = e.varianten || {};
      if (v.fehlen && v.fehlen.length) teile.push(t('plan.fehlen', { liste: v.fehlen.join(', ') }));
      if (v.fremd && v.fremd.length) teile.push(t('plan.fremd', { liste: v.fremd.join(', ') }));
      teile.push(e.instanzen == null ? t('plan.instanzenUnbekannt') : t('plan.instanzen', { n: e.instanzen }));
      const d = document.createElement('span');
      d.className = 'pdetail'; d.textContent = teile.join(' · ');
      z.appendChild(d);
      if (e.warnungen && e.warnungen.length) {
        const w = document.createElement('span');
        w.className = 'pwarn'; w.textContent = '△ ' + e.warnungen.join(' · ');
        w.title = e.warnungen.join('\n');
        z.appendChild(w);
      }
      liste.appendChild(z);
    });
    const s = planDaten.zusammenfassung || {};
    let summe = t('plan.summe', {
      aendern: s.aendern || 0, neu: s.neu || 0, fehlen: s.fehlen || 0,
      gesperrt: s.gesperrt || 0, instanzen: s.instanzen == null ? '?' : s.instanzen });
    if (s.strokeHeim) summe += '\n' + t('plan.strokeHeim');
    $('planSumme').textContent = summe;
    aus($('planOk'), !eintraege.length);
  }
  $('planAbbruch').addEventListener('click', () => dialogZu('dlgPlan'));
  $('planOk').addEventListener('click', () => {
    dialogZu('dlgPlan');
    bauenSenden(planUmfang);
  });
  $('chkTrockenEinzel').addEventListener('change', e => {
    trockenlaufEinzel = !!e.target.checked;
    einstellungMelden();
  });

  $('btnRun').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    if (trockenlaufEinzel) bauenSenden('auswahl');
    else planAnfordern('auswahl'); } });
  $('btnDiff').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    $('fazit').className = 'fazit'; sperren(true);
    send({ type: 'vorschau', snap: !!$('chkSnap').checked }); } });
  $('btnAudit').addEventListener('click', () => { if (!beschaeftigt) {
    $('fazit').className = 'fazit'; logLeeren(); sperren(true);
    send({ type: 'audit' }); } });
  $('btnLeeren').addEventListener('click', logLeeren);

  function einstellungMelden() {
    send({ type: 'einstellung', snap: !!$('chkSnap').checked,
      stroke: !!$('chkStroke').checked, trockenlaufEinzel: !!trockenlaufEinzel });
  }
  $('chkStroke').addEventListener('change', einstellungMelden);
  // Snapping-Schalter aktualisiert eine offene Vorschau sofort —
  // die „neu“-Ebene zeigt sonst einen veralteten Zustand.
  $('chkSnap').addEventListener('change', () => {
    einstellungMelden();
    if (letzterDiff && hatAuswahl && !beschaeftigt) {
      $('fazit').className = 'fazit';
      sperren(true);
      send({ type: 'vorschau', snap: !!$('chkSnap').checked });
    }
  });

  function dialogAuf(id) {
    const d = $(id);
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  }
  function dialogZu(id) {
    const d = $(id);
    try { d.close(); } catch (e) { d.removeAttribute('open'); }
  }
  $('btnAlle').addEventListener('click', () => { if (!beschaeftigt) planAnfordern('alle'); });

