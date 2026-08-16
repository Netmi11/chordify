// ==UserScript==
// @name         ChordShift for Tab4U
// @namespace    https://tab4uchord-t2tntlcw.manus.space/
// @version      1.8.0
// @description  Transpose chords directly on Tab4U while preserving lyrics.
// @match        https://tab4u.com/tabs/songs/*
// @match        https://www.tab4u.com/tabs/songs/*
// @match        https://m.tab4u.com/tabs/songs/*
// @match        https://en.tab4u.com/tabs/songs/*
// @match        https://tab4u.com/tabs/artists/154_*
// @match        https://www.tab4u.com/tabs/artists/154_*
// @updateURL    https://tab4uchord-t2tntlcw.manus.space/chordshift.user.js
// @downloadURL  https://tab4uchord-t2tntlcw.manus.space/chordshift.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const existing = document.getElementById('chordshift-toolbar');
  if (existing) { existing.classList.toggle('cs-open'); return; }
  const root = document.getElementById('songContentTPL') || document.getElementById('song') || document.querySelector('[id*="songContent"], .songContent');
  const notify = (message) => {
    const box = document.createElement('div');
    box.textContent = message;
    box.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;max-width:calc(100vw - 24px);padding:14px 16px;border-radius:12px;background:rgb(16,26,40);color:rgb(245,247,251);border:1px solid rgb(244,180,72);font:700 14px system-ui,sans-serif;direction:rtl;box-shadow:0 10px 35px rgba(0,0,0,.55)';
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  };
  const extractSongFromDocument = (doc, sourceUrl) => {
    const songRoot = doc.getElementById('songContentTPL') || doc.getElementById('song') || doc.querySelector('[id*="songContent"], .songContent');
    if (!songRoot) return null;
    const lines = [];
    const rows = [...songRoot.querySelectorAll('tr')].filter((row) => !row.querySelector('tr'));
    rows.forEach((row) => {
      const cells = [...row.children].filter((cell) => /^(TD|TH)$/.test(cell.tagName));
      if (!cells.length) return;
      if (cells.length === 1) {
        const cell = cells[0];
        if (cell.classList.contains('tabs')) { lines.push({ chord: '', lyric: '', tab: (cell.textContent || '').trimEnd() }); return; }
        const section = cell.querySelector('.titLine');
        if (section) { lines.push({ label: (section.textContent || '').trim().replace(/:$/, ''), chord: '', lyric: '' }); return; }
        const text = (cell.textContent || '').replace(/\r/g, '');
        if (!text.trim()) return;
        const isChord = cell.classList.contains('chords_en') || !!cell.querySelector('.c_C') || /chord/i.test(cell.className || '');
        lines.push(isChord ? { chord: text, lyric: '' } : { chord: '', lyric: text.trim() });
        return;
      }
      const first = (cells[0].textContent || '').trim();
      const second = (cells[1].textContent || '').trim();
      const label = first.endsWith(':') ? first.slice(0, -1) : '';
      lines.push(label ? { label, chord: second, lyric: '' } : { chord: first, lyric: second });
    });
    if (!lines.length) lines.push(...(songRoot.innerText || '').split(/\n+/).map((lyric) => ({ chord: '', lyric: lyric.trim() })).filter((line) => line.lyric));
    const artist = (doc.querySelector('.artistTitle')?.textContent || doc.querySelector('#artOnTop')?.textContent || '').trim() || 'Tab4U';
    const heading = (doc.querySelector('h1')?.textContent || doc.title || 'שיר').trim().replace(/^אקורדים לשיר\s*/i, '');
    const title = artist !== 'Tab4U' && heading.endsWith(' של ' + artist) ? heading.slice(0, -(' של ' + artist).length).trim() : heading;
    return { title, artist, sourceUrl, lines };
  };
  const popularMercedesTitles = ['הבלדה למחלקה להלבשה תחתונה', "בואי ונביא לך ת'Fאנק", 'מלאך', 'את ואני', 'סופי', 'תגידי לי את', 'זהות', 'אור', 'דאווינים', 'אני משוגע'];
  const isMercedesArtistPage = /\/tabs\/artists\/154_/.test(location.pathname);
  if (isMercedesArtistPage) {
    const toolbar = document.createElement('aside');
    toolbar.id = 'chordshift-toolbar';
    toolbar.innerHTML = '<button type="button" aria-label="הוסף 10 שירי מרסדס בנד לספרייה">10</button>';
    const style = document.createElement('style');
    style.id = 'chordshift-style';
    style.textContent = '[id="chordshift-toolbar"]{position:fixed;z-index:2147483647;top:12px;left:12px;direction:rtl}[id="chordshift-toolbar"] button{width:26px;height:26px;padding:0;border:1px solid rgb(244,180,72);border-radius:50%;background:rgb(16,26,40);color:rgb(244,180,72);box-shadow:0 5px 16px rgba(0,0,0,.48);font:800 10px system-ui,sans-serif;cursor:pointer}[id="chordshift-toolbar"] button:disabled{opacity:.55}';
    document.head.appendChild(style);
    document.body.appendChild(toolbar);
    const batchButton = toolbar.querySelector('button');
    batchButton.onclick = async () => {
      const popup = window.open('about:blank', '_blank');
      if (!popup) { notify('לא ניתן לפתוח את הספרייה. אפשר חלון קופץ ונסה שוב.'); return; }
      const links = [...document.querySelectorAll('a.searchLink[href*="/songs/"]')].map((link) => ({ title: (link.querySelector('.songNameInArtList')?.textContent || link.textContent || '').trim(), href: new URL(link.getAttribute('href'), location.href).href }));
      const selected = popularMercedesTitles.map((title) => links.find((link) => link.title === title)).filter(Boolean);
      if (selected.length !== popularMercedesTitles.length) { popup.close(); notify('לא נמצאו כל עשרת השירים בעמוד. נסה לרענן את העמוד.'); return; }
      batchButton.disabled = true;
      batchButton.textContent = '…';
      try {
        const songs = [];
        for (const link of selected) {
          const response = await fetch(link.href, { credentials: 'same-origin' });
          if (!response.ok) continue;
          const song = extractSongFromDocument(new DOMParser().parseFromString(await response.text(), 'text/html'), link.href);
          if (song) songs.push(song);
        }
        if (!songs.length) { popup.close(); notify('לא הצלחתי לקרוא את השירים. נסה שוב עם חיבור יציב.'); return; }
        popup.name = JSON.stringify({ type: 'chordshift-import-batch-v1', songs });
        popup.location.replace('https://tab4uchord-t2tntlcw.manus.space/?import=1');
      } catch (_) {
        popup.close();
        notify('הייבוא נעצר. נסה שוב עם חיבור יציב.');
      } finally {
        batchButton.disabled = false;
        batchButton.textContent = '10';
      }
    };
    return;
  }
  if (!root) { notify('ChordShift: לא נמצא אזור השיר בדף הזה.'); return; }
  const sharpSign = String.fromCharCode(35);
  const sharp = ['C','C'+sharpSign,'D','D'+sharpSign,'E','F','F'+sharpSign,'G','G'+sharpSign,'A','A'+sharpSign,'B'];
  const flat = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const chordPattern = /^[A-G](?:\x23|b)?(?:m|maj|min|dim|aug|sus|add|M|7|9|11|13|6|\+|°|\([^)]*\))*?(?:\/[A-G](?:\x23|b)?)?$/;
  const tabCells = [...root.querySelectorAll('td.tabs')];
  tabCells.forEach((cell) => { cell.dataset.chordshiftTabOriginal = cell.textContent || ''; });
  let shift = 0;
  let flats = false;
  let side = 'left';
  let tabsEnabled = false;
  try { side = localStorage.getItem('chordshift-side') || 'left'; } catch (_) {}
  const mod = (n) => (n % 12 + 12) % 12;
  const transpose = (value) => value.replace(/^([A-G](?:\x23|b)?)(.*?)(?:\/([A-G](?:\x23|b)?))?$/, (_, rootNote, suffix, bass) => {
    const source = rootNote.includes('b') ? flat : sharp;
    const output = flats ? flat : sharp;
    const rootIndex = source.indexOf(rootNote);
    if (rootIndex < 0) return value;
    const nextBass = bass ? output[mod(source.indexOf(bass) + shift)] : '';
    return output[mod(rootIndex + shift)] + suffix + (nextBass ? '/' + nextBass : '');
  });
  const transposeTabLine = (line, semitones) => {
    const parts = line.split(/(\d+)/);
    for (let i = 1; i < parts.length; i += 2) {
      const original = parts[i];
      const nextFret = Number(original) + semitones;
      if (!Number.isFinite(nextFret) || nextFret < 0 || nextFret > 24) continue;
      const next = String(nextFret);
      const delta = next.length - original.length;
      parts[i] = next;
      if (!delta) continue;
      let balanced = false;
      for (let j = i + 1; j < parts.length; j += 2) {
        const dashes = parts[j].match(/^-+/);
        if (!dashes) continue;
        if (delta > 0 && dashes[0].length >= delta) parts[j] = parts[j].slice(delta);
        else if (delta < 0) parts[j] = '-'.repeat(-delta) + parts[j];
        else continue;
        balanced = true;
        break;
      }
      if (!balanced && delta < 0) parts[parts.length - 1] += '-'.repeat(-delta);
    }
    return parts.join('');
  };
  const renderTabs = () => tabCells.forEach((cell) => {
    const original = cell.dataset.chordshiftTabOriginal || '';
    cell.textContent = tabsEnabled ? transposeTabLine(original, shift) : original;
    cell.classList.toggle('chordshift-tab-active', tabsEnabled);
  });
  const originalText = (element) => element.dataset.chordshiftTabOriginal || element.textContent || '';
  const extractSongForLibrary = () => {
    const lines = [];
    const rows = [...root.querySelectorAll('tr')].filter((row) => !row.querySelector('tr'));
    rows.forEach((row) => {
      const cells = [...row.children].filter((cell) => /^(TD|TH)$/.test(cell.tagName));
      if (!cells.length) return;
      if (cells.length === 1) {
        const cell = cells[0];
        if (cell.classList.contains('tabs')) { lines.push({ chord: '', lyric: '', tab: originalText(cell) }); return; }
        const section = cell.querySelector('.titLine');
        if (section) { lines.push({ label: (section.textContent || '').trim().replace(/:$/, ''), chord: '', lyric: '' }); return; }
        const text = (cell.textContent || '').replace(/\r/g, '');
        if (!text.trim()) return;
        const isChord = cell.classList.contains('chords_en') || !!cell.querySelector('.c_C') || /chord/i.test(cell.className || '');
        lines.push(isChord ? { chord: text, lyric: '' } : { chord: '', lyric: text.trim() });
        return;
      }
      const first = (cells[0].textContent || '').trim();
      const second = (cells[1].textContent || '').trim();
      const label = first.endsWith(':') ? first.slice(0, -1) : '';
      lines.push(label ? { label, chord: second, lyric: '' } : { chord: first, lyric: second });
    });
    if (!lines.length) lines.push(...(root.innerText || '').split(/\n+/).map((lyric) => ({ chord: '', lyric: lyric.trim() })).filter((line) => line.lyric));
    const artist = (document.querySelector('.artistTitle')?.textContent || document.querySelector('#artOnTop')?.textContent || '').trim() || 'Tab4U';
    const heading = (document.querySelector('h1')?.textContent || document.title || 'שיר').trim().replace(/^אקורדים לשיר\s*/i, '');
    const title = artist !== 'Tab4U' && heading.endsWith(' של ' + artist) ? heading.slice(0, -(' של ' + artist).length).trim() : heading;
    return { type: 'chordshift-import-v1', song: { title, artist, sourceUrl: location.href, lines } };
  };
  const openLibraryImport = () => {
    const popup = window.open('about:blank', '_blank');
    if (!popup) { notify('לא ניתן לפתוח את הספרייה. אפשר חלון קופץ ונסה שוב.'); return; }
    popup.name = JSON.stringify(extractSongForLibrary());
    popup.location.replace('https://tab4uchord-t2tntlcw.manus.space/?import=1');
  };
  const isSequence = (text) => text.trim().split(/\s+/).filter(Boolean).length > 0 && text.trim().split(/\s+/).filter(Boolean).every((token) => chordPattern.test(token));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[id="chordshift-toolbar"]') || parent.classList.contains('chordshift-chord')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let found = 0;
  nodes.forEach((node) => {
    const text = node.nodeValue || '';
    if (!text.trim() || !isSequence(text)) return;
    found += 1;
    const fragment = document.createDocumentFragment();
    text.split(/(\s+)/).forEach((part) => {
      if (/\s+/.test(part)) fragment.appendChild(document.createTextNode(part));
      else {
        const span = document.createElement('span');
        span.className = 'chordshift-chord';
        span.dataset.original = part;
        span.textContent = part;
        fragment.appendChild(span);
      }
    });
    node.parentNode && node.parentNode.replaceChild(fragment, node);
  });
  if (!found && !tabCells.length) { notify('ChordShift: הדף נטען, אך לא נמצאו אקורדים או טאבים.'); return; }
  const style = document.createElement('style');
  style.id = 'chordshift-style';
  style.textContent = '[id="chordshift-toolbar"]{position:fixed;z-index:2147483647;top:12px;left:12px;width:26px;height:26px;box-sizing:border-box;color:rgb(245,247,251);font:14px system-ui,sans-serif;direction:rtl}[id="chordshift-toolbar"][data-side="right"]{left:auto;right:12px}[id="chordshift-toolbar"] *{box-sizing:border-box}[id="chordshift-toolbar"] .cs-launcher{width:26px;height:26px;border:1px solid rgb(244,180,72);border-radius:50%;background:rgb(16,26,40);color:rgb(244,180,72);box-shadow:0 5px 16px rgba(0,0,0,.48);font:700 14px system-ui,sans-serif;cursor:pointer;display:grid;place-items:center;padding:0;transition:transform 160ms ease,opacity 160ms ease}[id="chordshift-toolbar"] .cs-panel{position:absolute;top:0;left:0;width:min(285px,calc(100vw - 24px));padding:12px;border:1px solid rgb(82,96,117);border-radius:14px;background:rgb(16,26,40);box-shadow:0 10px 35px rgba(0,0,0,.55);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-6px) scale(.98);transform-origin:top left;transition:transform 180ms ease,opacity 180ms ease,visibility 180ms ease}[id="chordshift-toolbar"][data-side="right"] .cs-panel{left:auto;right:0;transform-origin:top right}[id="chordshift-toolbar"].cs-open .cs-launcher{opacity:0;pointer-events:none;transform:scale(.9)}[id="chordshift-toolbar"].cs-open .cs-panel{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}[id="chordshift-toolbar"] .cs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}[id="chordshift-toolbar"] .cs-brand{font-weight:800;color:rgb(244,180,72)}[id="chordshift-toolbar"] .cs-panel button{min-height:38px;border:1px solid rgb(89,102,122);border-radius:9px;background:rgb(27,40,57);color:rgb(245,247,251);font:inherit;font-weight:700;cursor:pointer;padding:7px 10px}[id="chordshift-toolbar"] .cs-close{border:0!important;background:transparent!important;color:rgb(184,194,209)!important;font-size:20px!important}[id="chordshift-toolbar"] .cs-row{display:flex;align-items:center;gap:7px}[id="chordshift-toolbar"] .cs-step{min-width:68px;text-align:center;color:rgb(244,180,72);font-size:18px}[id="chordshift-toolbar"] .cs-plus{background:rgb(244,180,72)!important;color:rgb(18,26,37)!important;border-color:rgb(244,180,72)!important}[id="chordshift-toolbar"] .cs-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:8px}[id="chordshift-toolbar"] .cs-side,[id="chordshift-toolbar"] .cs-tabs,[id="chordshift-toolbar"] .cs-library{width:100%;margin-top:8px;border-color:rgb(244,180,72)!important;color:rgb(244,180,72)!important}[id="chordshift-toolbar"] .cs-tabs:disabled{opacity:.45;color:rgb(174,185,200)!important;border-color:rgb(89,102,122)!important}[id="chordshift-toolbar"] .cs-note{margin-top:8px;color:rgb(174,185,200);font-size:11px;text-align:center}.chordshift-chord{color:rgb(201,133,35)!important;font-weight:700!important}.chordshift-tab-active{font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;white-space:pre!important;color:rgb(238,203,121)!important}';
  document.head.appendChild(style);
  const toolbar = document.createElement('aside');
  toolbar.id = 'chordshift-toolbar';
  toolbar.innerHTML = '<button class="cs-launcher" type="button" aria-label="פתח את ChordShift">♫</button><section class="cs-panel"><div class="cs-head"><span class="cs-brand">ChordShift</span><button class="cs-close" type="button" aria-label="מזער">×</button></div><div class="cs-row"><button class="cs-minus" type="button">−</button><strong class="cs-step">0</strong><button class="cs-plus" type="button">+</button></div><div class="cs-actions"><button class="cs-seven" type="button">+7</button><button class="cs-reset" type="button">מקור</button><button class="cs-flats" type="button">♯</button></div><button class="cs-tabs" type="button"></button><button class="cs-library" type="button">שמור בספרייה</button><button class="cs-side" type="button"></button><div class="cs-note">טאבים משתנים רק כשמפעילים אותם</div></section>';
  document.body.appendChild(toolbar);
  const applySide = () => { toolbar.dataset.side = side; toolbar.querySelector('.cs-side').textContent = side === 'left' ? 'העבר לימין' : 'העבר לשמאל'; };
  const applyTabsControl = () => { const button = toolbar.querySelector('.cs-tabs'); button.disabled = !tabCells.length; button.textContent = tabCells.length ? (tabsEnabled ? 'טאבים: פעיל' : 'טאבים: כבוי') : 'אין טאבים בשיר'; };
  applySide();
  applyTabsControl();
  const render = () => { root.querySelectorAll('.chordshift-chord').forEach((span) => { span.textContent = transpose(span.dataset.original || ''); }); renderTabs(); toolbar.querySelector('.cs-step').textContent = shift > 0 ? '+' + shift : String(shift); };
  toolbar.querySelector('.cs-launcher').onclick = () => { toolbar.classList.toggle('cs-open'); };
  toolbar.querySelector('.cs-minus').onclick = () => { shift -= 1; render(); };
  toolbar.querySelector('.cs-plus').onclick = () => { shift += 1; render(); };
  toolbar.querySelector('.cs-seven').onclick = () => { shift = 7; render(); };
  toolbar.querySelector('.cs-reset').onclick = () => { shift = 0; flats = false; toolbar.querySelector('.cs-flats').textContent = '♯'; render(); };
  toolbar.querySelector('.cs-flats').onclick = (event) => { flats = !flats; event.currentTarget.textContent = flats ? '♭' : '♯'; render(); };
  toolbar.querySelector('.cs-tabs').onclick = () => { tabsEnabled = !tabsEnabled; applyTabsControl(); renderTabs(); };
  toolbar.querySelector('.cs-library').onclick = openLibraryImport;
  toolbar.querySelector('.cs-side').onclick = () => { side = side === 'left' ? 'right' : 'left'; try { localStorage.setItem('chordshift-side', side); } catch (_) {} applySide(); };
  toolbar.querySelector('.cs-close').onclick = () => { toolbar.classList.remove('cs-open'); };
  render();
})();
