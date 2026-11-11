import net from 'node:net';

/**
 * Minimal, conservative SMTP recipient probe. Sends: (banner) EHLO, MAIL FROM, RCPT TO ..., QUIT.
 * It NEVER issues DATA, so no message is ever sent. Uses at most `rcpts.length` RCPT commands per connection.
 * Returns { ok, banner, results: [{ rcpt, code, message }] } or { ok:false, error, kind } where kind is
 * 'connect' | 'timeout' | 'protocol'. Port 25 is often blocked on residential/cloud networks: that yields kind 'connect'/'timeout'.
 */
export function smtpProbe(host, { from, rcpts, ehloName = 'verifier.invalid', port = 25, timeoutMs = 8000 }) {
  return new Promise((resolve) => {
    const results = []; let buf = ''; let stage = 'banner'; let idx = 0; let banner = ''; let done = false;
    const sock = net.connect({ host, port });
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { sock.write('QUIT\r\n'); } catch {} sock.destroy(); resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout', kind: 'timeout', results }), timeoutMs);
    sock.setEncoding('utf8');
    sock.on('error', (e) => finish({ ok: false, error: e.code || e.message, kind: 'connect', results }));
    sock.on('close', () => finish({ ok: results.length > 0, error: results.length ? undefined : 'closed', kind: 'protocol', results }));
    const send = (s) => sock.write(s + '\r\n');
    sock.on('data', (chunk) => {
      buf += chunk;
      let m;
      // A complete reply ends with a line "NNN text" (space after code, not '-').
      while ((m = buf.match(/^(?:\d{3}-.*\r?\n)*(\d{3}) ?(.*)\r?\n/))) {
        buf = buf.slice(m[0].length);
        const code = Number(m[1]); const message = m[0].trim().split(/\r?\n/).pop().slice(4);
        if (stage === 'banner') { banner = message; if (code !== 220) return finish({ ok: false, error: `banner ${code}`, kind: 'protocol', results, banner }); stage = 'ehlo'; send(`EHLO ${ehloName}`); }
        else if (stage === 'ehlo') { if (code >= 400) { stage = 'helo'; send(`HELO ${ehloName}`); } else { stage = 'mail'; send(`MAIL FROM:<${from}>`); } }
        else if (stage === 'helo') { if (code >= 400) return finish({ ok: false, error: `helo ${code}`, kind: 'protocol', results, banner }); stage = 'mail'; send(`MAIL FROM:<${from}>`); }
        else if (stage === 'mail') { if (code >= 400) return finish({ ok: false, error: `mail from rejected ${code}`, kind: 'protocol', code, results, banner }); stage = 'rcpt'; send(`RCPT TO:<${rcpts[idx]}>`); }
        else if (stage === 'rcpt') { results.push({ rcpt: rcpts[idx], code, message }); idx++; if (idx < rcpts.length) send(`RCPT TO:<${rcpts[idx]}>`); else return finish({ ok: true, results, banner }); }
      }
    });
  });
}
