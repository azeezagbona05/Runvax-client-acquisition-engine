/* RUNVAX chat agent: a chat bubble for your website (receptionist, sales, support, booking, shopping...).
   <script async src="https://YOUR-RUNVAX/runvax-chat.js" data-key="rva_..."></script>
   Options: data-color (hex, default #7e22ce), data-position (right|left). */
(function () {
  var s = document.currentScript; if (!s) return;
  var key = s.getAttribute('data-key'); if (!key || window.__rvxChat) return; window.__rvxChat = 1;
  var origin = new URL(s.src, location.href).origin, api = origin + '/api/site-agent/' + encodeURIComponent(key) + '/chat';
  var color = /^#[0-9a-f]{6}$/i.test(s.getAttribute('data-color') || '') ? s.getAttribute('data-color') : '#7e22ce';
  var side = s.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var sid; try { sid = localStorage.getItem('rvx_sid'); if (!sid) { sid = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('rvx_sid', sid); } } catch (e) { sid = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function el(t, css, text) { var e = document.createElement(t); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  fetch(api, { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
    if (!cfg) return;
    var root = el('div', 'position:fixed;bottom:18px;' + side + ':18px;z-index:2147483000;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif');
    var btn = el('button', 'width:58px;height:58px;border-radius:50%;border:0;background:' + color + ';color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)', '💬'); btn.setAttribute('aria-label', 'Chat with ' + cfg.name);
    var box = el('div', 'display:none;position:absolute;bottom:72px;' + side + ':0;width:min(360px,calc(100vw - 36px));height:min(520px,calc(100vh - 120px));background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden;flex-direction:column');
    var head = el('div', 'background:' + color + ';color:#fff;padding:12px 16px;font-weight:700;line-height:1.25', cfg.name); head.appendChild(el('div', 'font-weight:500;font-size:12px;opacity:.9', 'AI assistant'));
    var log = el('div', 'flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc');
    var form = el('form', 'display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff');
    var inp = el('input', 'flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font:inherit;min-width:0'); inp.placeholder = 'Type your message'; inp.maxLength = 1000; inp.setAttribute('aria-label', 'Your message');
    var send = el('button', 'border:0;border-radius:10px;background:' + color + ';color:#fff;padding:0 16px;font:inherit;font-weight:600;cursor:pointer', 'Send'); send.type = 'submit';
    var note = el('div', 'padding:6px 12px 8px;font-size:11px;color:#64748b;background:#fff;line-height:1.35', (cfg.disclosure || 'You are chatting with an AI assistant. Your messages are saved.') + ' ');
    if (cfg.privacyUrl) { var pa = document.createElement('a'); pa.href = cfg.privacyUrl; pa.target = '_blank'; pa.rel = 'noopener'; pa.textContent = 'Privacy'; pa.style.cssText = 'color:' + color; note.appendChild(pa); }
    form.appendChild(inp); form.appendChild(send); box.appendChild(head); box.appendChild(log); box.appendChild(form); box.appendChild(note); root.appendChild(box); root.appendChild(btn); document.body.appendChild(root);
    function bubble(text, mine) { var b = el('div', 'max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word;' + (mine ? 'align-self:flex-end;background:' + color + ';color:#fff' : 'align-self:flex-start;background:#fff;border:1px solid #e2e8f0'), text); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
    var opened = false, code = '';
    // Staff-only agents: the access code is asked first, kept for this browser tab only, and sent with each message.
    try { code = sessionStorage.getItem('rvx_code_' + key) || ''; } catch (e) {}
    function askCode() { inp.type = 'password'; inp.placeholder = 'Staff access code'; bubble('This assistant is for staff. Please type your access code.', false); }
    btn.onclick = function () { var show = box.style.display === 'none'; box.style.display = show ? 'flex' : 'none'; if (show && !opened) { opened = true; if (cfg.needsCode && !code) askCode(); else bubble(cfg.greeting, false); } if (show) inp.focus(); };
    form.onsubmit = function (e) {
      e.preventDefault(); var t = inp.value.trim(); if (!t) return; inp.value = '';
      if (cfg.needsCode && !code) { code = t; try { sessionStorage.setItem('rvx_code_' + key, code); } catch (x) {} inp.type = 'text'; inp.placeholder = 'Type your message'; bubble('••••', true); bubble(cfg.greeting, false); return; }
      bubble(t, true); var wait = bubble('…', false); send.disabled = true;
      fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sid: sid, message: t, code: code || undefined }), credentials: 'omit' })
        .then(function (r) { return r.json(); }).then(function (d) { wait.textContent = d.reply || 'Sorry, something went wrong.'; if (d.needsCode) { code = ''; try { sessionStorage.removeItem('rvx_code_' + key); } catch (x) {} askCode(); } })
        .catch(function () { wait.textContent = 'Sorry, I could not reach the team right now. Please try again.'; })
        .then(function () { send.disabled = false; log.scrollTop = log.scrollHeight; });
    };
  }).catch(function () {});
})();
