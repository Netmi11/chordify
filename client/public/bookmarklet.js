(() => {
  const existing = document.getElementById('chordshift-toolbar');
  if (existing) { existing.hidden = !existing.hidden; return; }
  const root = document.querySelector('#songContentTPL');
  if (!root) { alert('ChordShift: לא נמצא אזור השיר בדף הזה.'); return; }
  const sharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const flat = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const chordPattern = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|M|7|9|11|13|6|\+|°|\([^)]*\))*?(?:\/[A-G](?:#|b)?)?$/;
  let shift = 0;
  let flats = false;
  const original = [];
  const mod = (n) => (n % 12 + 12) % 12;
  const transpose = (value) => value.replace(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/, (_, rootNote, suffix, bass) => {
    const source = rootNote.includes('b') ? flat : sharp;
    const output = flats ? flat : sharp;
    const rootIndex = source.indexOf(rootNote);
    if (rootIndex < 0) return value;
    const nextBass = bass ? output[mod(source.indexOf(bass) + shift)] : '';
    return `${output[mod(rootIndex + shift)]}${suffix}${nextBass ? `/${nextBass}` : ''}`;
  });
  const isSequence = (text) => {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => chordPattern.test(token));
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('#chordshift-toolbar') || parent.classList.contains('chordshift-chord')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const text = node.nodeValue || '';
    if (!text.trim() || !isSequence(text)) return;
    original.push({ node, text });
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
    node.parentNode?.replaceChild(fragment, node);
  });
  const style = document.createElement('style');
  style.id = 'chordshift-style';
  style.textContent = `#chordshift-toolbar{position:fixed;z-index:2147483647;right:12px;bottom:12px;width:min(300px,calc(100vw - 24px));box-sizing:border-box;padding:12px;border:1px solid #526075;border-radius:14px;background:#101a28;color:#f5f7fb;box-shadow:0 10px 35px #0008;font:14px system-ui,sans-serif;direction:rtl}#chordshift-toolbar *{box-sizing:border-box}#chordshift-toolbar .cs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}#chordshift-toolbar .cs-brand{font-weight:800;color:#f4b448}#chordshift-toolbar .cs-close{border:0;background:transparent;color:#b8c2d1;font-size:20px;line-height:1;cursor:pointer}#chordshift-toolbar .cs-row{display:flex;align-items:center;gap:7px}#chordshift-toolbar button{min-height:38px;border:1px solid #59667a;border-radius:9px;background:#1b2839;color:#f5f7fb;font:inherit;font-weight:700;cursor:pointer;padding:7px 10px}#chordshift-toolbar button:active{transform:scale(.97)}#chordshift-toolbar .cs-step{min-width:68px;text-align:center;color:#f4b448;font-size:18px}#chordshift-toolbar .cs-plus{background:#f4b448;color:#121a25;border-color:#f4b448}#chordshift-toolbar .cs-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:8px}#chordshift-toolbar .cs-note{margin-top:8px;color:#aeb9c8;font-size:11px;text-align:center}.chordshift-chord{color:#c98523!important;font-weight:700!important}`;
  document.head.appendChild(style);
  const toolbar = document.createElement('aside');
  toolbar.id = 'chordshift-toolbar';
  toolbar.innerHTML = '<div class="cs-head"><span class="cs-brand">ChordShift</span><button class="cs-close" type="button" aria-label="סגור">×</button></div><div class="cs-row"><button class="cs-minus" type="button">−</button><strong class="cs-step">0</strong><button class="cs-plus" type="button">+</button></div><div class="cs-actions"><button class="cs-seven" type="button">+7</button><button class="cs-reset" type="button">מקור</button><button class="cs-flats" type="button">♯</button></div><div class="cs-note">האקורדים משתנים במקום, המילים נשארות</div>';
  document.body.appendChild(toolbar);
  const render = () => {
    root.querySelectorAll('.chordshift-chord').forEach((span) => { span.textContent = transpose(span.dataset.original || ''); });
    toolbar.querySelector('.cs-step').textContent = shift > 0 ? `+${shift}` : `${shift}`;
  };
  toolbar.querySelector('.cs-minus').onclick = () => { shift -= 1; render(); };
  toolbar.querySelector('.cs-plus').onclick = () => { shift += 1; render(); };
  toolbar.querySelector('.cs-seven').onclick = () => { shift = 7; render(); };
  toolbar.querySelector('.cs-reset').onclick = () => { shift = 0; flats = false; toolbar.querySelector('.cs-flats').textContent = '♯'; render(); };
  toolbar.querySelector('.cs-flats').onclick = (event) => { flats = !flats; event.currentTarget.textContent = flats ? '♭' : '♯'; render(); };
  toolbar.querySelector('.cs-close').onclick = () => { toolbar.hidden = true; };
  render();
})();
