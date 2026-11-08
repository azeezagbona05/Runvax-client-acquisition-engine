/* RUNVAX Visibility Agent: shows the articles your agent publishes, right on your own page.
   <div id="runvax-posts"></div><script async src="https://YOUR-RUNVAX/runvax-agent.js" data-key="rva_..."></script>
   Options on the script tag: data-target (element id), data-limit (1-20), data-theme (light|dark), data-open (true: first article open). */
(function () {
  var s = document.currentScript; if (!s) return;
  var key = s.getAttribute('data-key'); if (!key) return;
  var origin = new URL(s.src, location.href).origin;
  var limit = Math.min(20, Math.max(1, parseInt(s.getAttribute('data-limit') || '6', 10) || 6));
  var dark = s.getAttribute('data-theme') === 'dark';
  var host = document.getElementById(s.getAttribute('data-target') || 'runvax-posts');
  if (!host) { host = document.createElement('div'); s.parentNode.insertBefore(host, s); }
  var c = dark ? { fg: '#e5e7eb', mut: '#9ca3af', line: '#374151', bg: '#111827', ac: '#c4b5fd' } : { fg: '#0f172a', mut: '#64748b', line: '#e2e8f0', bg: '#ffffff', ac: '#7e22ce' };
  var css = '.rvx{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:' + c.fg + ';max-width:760px;margin:0 auto}.rvx article{border:1px solid ' + c.line + ';background:' + c.bg + ';border-radius:14px;padding:18px 20px;margin:0 0 14px}.rvx h3{margin:0 0 4px;font-size:20px;line-height:1.3}.rvx time{color:' + c.mut + ';font-size:13px}.rvx p.s{margin:8px 0 0;color:' + c.mut + '}.rvx details summary{cursor:pointer;color:' + c.ac + ';font-weight:600;margin-top:10px}.rvx .b h2{font-size:18px;margin:18px 0 6px}.rvx .b h3{font-size:16px;margin:14px 0 4px}.rvx .b a{color:' + c.ac + '}.rvx .b blockquote{margin:12px 0;padding-left:12px;border-left:3px solid ' + c.line + ';color:' + c.mut + '}.rvx footer{font-size:12px;color:' + c.mut + ';text-align:right}.rvx footer a{color:' + c.mut + '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  fetch(origin + '/api/site-agent/' + encodeURIComponent(key) + '/posts?limit=' + limit, { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.posts || !d.posts.length) return;
      var wrap = el('div', null, 'rvx'); var ld = [];
      d.posts.forEach(function (p, i) {
        var a = document.createElement('article'); a.setAttribute('itemscope', ''); a.setAttribute('itemtype', 'https://schema.org/BlogPosting');
        var h = el('h3', p.title); h.setAttribute('itemprop', 'headline'); a.appendChild(h);
        var t = el('time', new Date(p.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })); t.setAttribute('datetime', p.publishedAt); a.appendChild(t);
        a.appendChild(el('p', p.summary, 's'));
        var det = document.createElement('details'); if (i === 0 && s.getAttribute('data-open') === 'true') det.open = true;
        det.appendChild(el('summary', 'Read the article'));
        var body = el('div', null, 'b'); body.innerHTML = p.body; /* sanitised by the server to a small tag allow-list */ det.appendChild(body); a.appendChild(det);
        wrap.appendChild(a);
        ld.push({ '@type': 'BlogPosting', headline: p.title, description: p.summary, datePublished: p.publishedAt, articleBody: body.textContent, author: { '@type': 'Organization', name: d.agent.business || d.agent.name } });
      });
      var f = el('footer'); var l = document.createElement('a'); l.href = origin; l.target = '_blank'; l.rel = 'noopener'; l.textContent = 'Articles by RUNVAX agents'; f.appendChild(l); wrap.appendChild(f);
      host.appendChild(wrap);
      var j = document.createElement('script'); j.type = 'application/ld+json'; j.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }); document.head.appendChild(j);
    }).catch(function () {});
})();
