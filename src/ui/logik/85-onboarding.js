  // =========================================================================
  // Onboarding — Slideshow beim ersten Start, Merker, Checkliste „Erste Schritte“
  // =========================================================================

  // ---- Merker (clientStorage über den Hauptthread) ------------------------
  function merkerLaden(schluessel) { send({ type: 'merkerLaden', schluessel: schluessel }); }
  function merkerSetzen(schluessel, w) { send({ type: 'merkerSetzen', schluessel: schluessel, wert: w }); }

  let onboardingGesehen = null;          // null = noch nicht beantwortet
  let ersteSchritte = { auswahl: false, vorschau: false, bauen: false };
  let ersteSchritteAus = false;

  bei('merker', m => {
    if (!m) return;
    if (m.schluessel === 'onboardingGesehen') {
      onboardingGesehen = !!m.wert;
      if (!onboardingGesehen) obAuf(0);
    }
    if (m.schluessel === 'ersteSchritte' && m.wert && typeof m.wert === 'object') {
      ersteSchritte = {
        auswahl: !!m.wert.auswahl, vorschau: !!m.wert.vorschau, bauen: !!m.wert.bauen
      };
      ersteSchritteZeichnen($('esKarte'));
    }
    if (m.schluessel === 'ersteSchritteAus') {
      ersteSchritteAus = !!m.wert;
      ersteSchritteZeichnen($('esKarte'));
    }
  });

  // ---- Checkliste „Erste Schritte“ ---------------------------------------
  function esMarkieren(feld) {
    if (ersteSchritte[feld]) return;
    ersteSchritte[feld] = true;
    merkerSetzen('ersteSchritte', ersteSchritte);
    ersteSchritteZeichnen($('esKarte'));
  }
  bei('auswahl', m => { if (m && m.ziel) esMarkieren('auswahl'); });
  bei('diff', () => esMarkieren('vorschau'));
  bei('fazit', () => esMarkieren('bauen'));

  function ersteSchritteZeichnen(halter) {
    if (!halter) return;
    const fertig = ersteSchritte.auswahl && ersteSchritte.vorschau && ersteSchritte.bauen;
    halter.textContent = '';
    if (ersteSchritteAus || fertig) return;
    const karte = document.createElement('div');
    karte.className = 'eskarte';
    const kopf = document.createElement('div');
    kopf.className = 'eskopf';
    const ti = document.createElement('span');
    ti.className = 'estitel';
    ti.textContent = t('es.titel');
    kopf.appendChild(ti);
    const weg = document.createElement('fig-button');
    weg.setAttribute('variant', 'ghost');
    weg.textContent = t('es.ausblenden');
    weg.addEventListener('click', () => {
      ersteSchritteAus = true;
      merkerSetzen('ersteSchritteAus', true);
      ersteSchritteZeichnen(halter);
    });
    kopf.appendChild(weg);
    karte.appendChild(kopf);
    const liste = document.createElement('div');
    liste.className = 'esliste';
    [['auswahl', 'es.auswahl'], ['vorschau', 'es.vorschau'], ['bauen', 'es.bauen']].forEach(p => {
      const z = document.createElement('div');
      z.className = 'eszeile' + (ersteSchritte[p[0]] ? ' fertig' : '');
      const h = document.createElement('span');
      h.className = 'haken';
      h.textContent = '✓';
      z.appendChild(h);
      const s = document.createElement('span');
      s.textContent = t(p[1]);
      z.appendChild(s);
      liste.appendChild(z);
    });
    karte.appendChild(liste);
    halter.appendChild(karte);
  }

  // ---- Slides aus den Inhalten (§39.9) ------------------------------------
  // Texte und Grafiken stehen in src/ui/inhalte/welcome.mjs und
  // src/ui/inhalte/onboarding.mjs — hier wird nur noch ausgewählt und gefüllt.
  const OB_SLIDES = Array.isArray(INHALTE.onboarding) ? INHALTE.onboarding : [];
  const OB_ANZ = OB_SLIDES.length + 1;      // Slide 1 ist der Welcome-Screen
  let obSchritt = 0, obOffen = false;

  // Manche Slides haben eine eigene Fassung je erkanntem Modus.
  function obModusFeld(s, basis) {
    const zds = adapterAktiv === 'zds';
    const spezial = zds ? s[basis + 'Zds'] : s[basis + 'Frei'];
    return spezial || s[basis];
  }
  function obInhalt(i) {
    if (i === 0) {
      const w = INHALTE.welcome || {};
      // `animiert: false` in welcome.mjs schaltet auf die statische Fassung um
      // (siehe docs/INHALTE.md, Abschnitt „Animierte Welcome-Grafik“).
      const bild = w.animiert === false ? (w.svgStatisch || w.svg || '') : (w.svg || '');
      return { welcome: true, bild: bild, titel: inh(w.titel), text: inh(w.text),
        primaer: inh(w.primaer) || t('ob.weiter'), sekundaer: inh(w.sekundaer) || t('ob.ueberspringen') };
    }
    const s = OB_SLIDES[i - 1] || {};
    const modus = adapterAktiv === 'zds' ? t('adapter.zds') : t('adapter.frei');
    return {
      bild: obModusFeld(s, 'svg') || '',
      titel: inh(s.titel, { modus: modus }),
      text: inh(obModusFeld(s, 'text'), { modus: modus }),
      profile: s.extra === 'profile',
      lizenz: s.extra === 'lizenz'
    };
  }

  function obZeichnen() {
    const s = obInhalt(obSchritt);
    const dlg = $('dlgOnboarding');
    // Slide 1 ist ein opulenter Welcome-Screen: große Bühne, kein Zähler,
    // keine Punkte, zwei gleichwertige Wege hinein (§39.8).
    dlg.classList.toggle('welcome', !!s.welcome);
    $('obBild').innerHTML = s.bild;
    // Die Welcome-Grafik animiert nur, solange der Dialog offen ist und sie
    // sichtbar ist — die Keyframes im SVG hängen an `.an` am Container.
    $('obBild').classList.toggle('an', !!s.welcome && obOffen);
    $('obFuss').hidden = !!s.welcome;
    $('obZaehler').hidden = !!s.welcome;
    $('obZaehler').textContent = t('ob.zaehler', { i: obSchritt + 1, n: OB_ANZ });
    $('obTitel').textContent = s.titel;
    $('obText').textContent = s.text;
    $('obSkip').textContent = t('ob.ueberspringen');
    $('obSkip').hidden = !!s.welcome;
    if (s.welcome) {
      $('obZurueck').textContent = s.sekundaer;
      aus($('obZurueck'), false);
      $('obWeiter').textContent = s.primaer;
    } else {
      $('obZurueck').textContent = t('ob.zurueck');
      aus($('obZurueck'), false);
      $('obWeiter').textContent = obSchritt === OB_ANZ - 1 ? t('ob.los') : t('ob.weiter');
    }

    // Profilwahl auf dem Modus-Slide
    const extra = $('obExtra');
    extra.textContent = '';
    if (s.lizenz) {
      const h = document.createElement('div');
      h.className = 'fhilfe';
      h.textContent = t('liz.figma');
      extra.appendChild(h);
    }
    if (s.profile) {
      const info = (profilInfo && profilInfo.length)
        ? profilInfo
        : (profile || []).map(n => ({ name: n, titel: t('profil.' + n), beschreibung: '' }));
      // Eigene scrollbare Zone; das Fade unten zeigt an, dass mehr folgt.
      const zone = document.createElement('div');
      zone.className = 'profilzone';
      const liste = document.createElement('div');
      liste.className = 'profilliste';
      const fadePruefen = () => {
        const mehr = liste.scrollHeight - liste.clientHeight - liste.scrollTop > 4;
        zone.classList.toggle('mehr', mehr);
      };
      liste.addEventListener('scroll', fadePruefen);
      info.forEach(p => {
        const k = document.createElement('div');
        k.className = 'profilkarte';
        const ti = document.createElement('div');
        ti.className = 'ptitel';
        ti.textContent = (p.titel || t('profil.' + p.name)) + ' — ' + t('ob.2.profil');
        k.appendChild(ti);
        if (p.beschreibung) {
          const b = document.createElement('div');
          b.className = 'pbeschr';
          b.textContent = p.beschreibung;
          k.appendChild(b);
        }
        k.addEventListener('click', () => {
          profilWahl = p.name;
          wartetAufSpeichern = false;
          send({ type: 'konfigZuruecksetzen', profil: p.name });
          liste.querySelectorAll('.profilkarte').forEach(x => x.classList.remove('gewaehlt'));
          k.classList.add('gewaehlt');
        });
        liste.appendChild(k);
      });
      zone.appendChild(liste);
      extra.appendChild(zone);
      // Erst nach dem Layout messbar.
      requestAnimationFrame(fadePruefen);
    }

    // Punkt-Navigation
    const dots = $('obDots');
    dots.textContent = '';
    dots.hidden = !!s.welcome;
    for (let i = 0; i < OB_ANZ; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      if (i === obSchritt) b.className = 'an';
      b.setAttribute('aria-label', t('ob.punkt', { i: i + 1 }));
      b.addEventListener('click', () => obGehe(i));
      dots.appendChild(b);
    }
  }

  // Wechsel mit kurzer Ein-/Ausblendung (CSS, 180 ms).
  function obGehe(i) {
    if (i < 0 || i >= OB_ANZ || i === obSchritt) return;
    const dlg = $('dlgOnboarding');
    dlg.classList.add('bh-wechsel');
    setTimeout(() => {
      obSchritt = i;
      obZeichnen();
      dlg.classList.remove('bh-wechsel');
    }, 180);
  }

  function obAuf(schritt) {
    obSchritt = schritt || 0;
    obOffen = true;
    obZeichnen();
    dialogAuf('dlgOnboarding');
  }
  function obZu() {
    obOffen = false;
    $('obBild').classList.remove('an');   // Animation anhalten
    dialogZu('dlgOnboarding');
    if (!onboardingGesehen) { onboardingGesehen = true; merkerSetzen('onboardingGesehen', true); }
    paywallStartPruefen();
  }

  $('obSkip').addEventListener('click', obZu);
  // Auf dem Welcome-Screen ist der linke Knopf „Direkt loslegen“.
  $('obZurueck').addEventListener('click', () => {
    if (obSchritt === 0) obZu(); else obGehe(obSchritt - 1);
  });
  $('obWeiter').addEventListener('click', () => {
    if (obSchritt === OB_ANZ - 1) obZu(); else obGehe(obSchritt + 1);
  });
  $('btnRundgang').addEventListener('click', () => obAuf(0));
  // Esc schließt den Dialog von selbst — das zählt als „überspringen“.
  $('dlgOnboarding').addEventListener('close', () => {
    if (obOffen) obZu();
  });
  document.addEventListener('keydown', e => {
    if (!obOffen) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); obGehe(obSchritt + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); obGehe(obSchritt - 1); }
  });

  merkerLaden('onboardingGesehen');
  merkerLaden('ersteSchritte');
  merkerLaden('ersteSchritteAus');
