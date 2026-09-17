  // =========================================================================
  // Nachrichten vom Hauptthread
  // =========================================================================
  onmessage = e => {
    const m = e.data.pluginMessage; if (!m) return;

    if (m.type === 'auswahl') {
      const vorher = ziel ? ziel.name : null;
      ziel = m.ziel || null;
      hatAuswahl = !!ziel;
      if (!ziel || vorher !== ziel.name) chipLeeren();
      auswahlZeichnen();
      if (!beschaeftigt) { aus($('btnRun'), !hatAuswahl); aus($('btnDiff'), !hatAuswahl);
        aus($('btnVorschauMit'), !hatAuswahl || !cfgLokal); }
    }

    if (m.type === 'log') {
      logListe.push({ art: m.art || '', text: m.text || '', hinweis: m.hinweis || '', nodeId: m.nodeId || null });
      protokollZeichnen();
    }

    if (m.type === 'progress') {
      $('balken').style.width = Math.round(100 * m.i / m.n) + '%';
      $('zahl').textContent = m.i + '/' + m.n + (m.name ? ' · ' + m.name : '');
    }

    if (m.type === 'fazit') {
      if (m.beiAuswahl) {
        const c = $('auswahlStatus');
        c.className = 'chip ' + (m.gut ? 'gruen' : 'rot');
        c.textContent = m.text;
      } else {
        $('fazit').className = 'fazit ' + (m.gut ? 'gruen' : 'rot');
        $('fazit').textContent = m.text;
      }
    }

    if (m.type === 'diff') {
      letzterDiff = m;
      if (m.temporaer) tabWechseln('icon');
      renderDiff();
      const c = $('auswahlStatus');
      c.className = 'chip ' + (m.temporaer ? 'geraten' : 'blau');
      c.textContent = m.temporaer ? t('chip.ungespeichert') : t('btn.vorschau');
    }

    if (m.type === 'plan') {
      planDaten = m;
      if (m.umfang) planUmfang = m.umfang;
      planZeichnen();
      dialogAuf('dlgPlan');
    }

    if (m.type === 'bericht') {
      bericht = m;
      berichtZeichnen();
      tabWechseln('bericht');
    }

    if (m.type === 'exportDaten') {
      try { exportEmpfangen(m); } catch (err) {
        logListe.push({ art: 'err', text: String(err && err.message || err) });
        protokollZeichnen();
      }
    }

    if (m.type === 'mess') {
      (async () => {
        const werte = [];
        for (const p of m.paare) {
          try {
            const r1 = await analysiere(p.px1, false, false);
            const fehler = await treue(p.px1, p.px8);
            werte.push({ aa: r1.aa, fehler });
          } catch (err) { werte.push({ aa: 999, fehler: 999 }); }
        }
        send({ type: 'messwert', id: m.id, werte });
      })();
    }

    if (m.type === 'einstellungen') {
      anhaken($('chkSnap'), m.snap);
      anhaken($('chkStroke'), m.stroke);
      // Fehlt das Feld, bleibt es beim Standard: Trockenlauf anzeigen.
      trockenlaufEinzel = m.trockenlaufEinzel === true;
      anhaken($('chkTrockenEinzel'), trockenlaufEinzel);
    }

    if (m.type === 'konfig') konfigUebernehmen(m);

    if (m.type === 'farben') {
      farben = m;
      farbenAngefragt = false;
      varListeZeichnen();
      gewaehlteVariableZeichnen(null);
    }

    if (m.type === 'farbeGeprueft') gewaehlteVariableZeichnen(m);

    if (m.type === 'fertig') sperren(false);

    (HANDLER[m.type] || []).forEach(fn => { try { fn(m); } catch (err) { console.error('Handler', m.type, err); } });
  };

