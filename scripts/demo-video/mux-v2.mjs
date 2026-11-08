// usage: node mux-v2.mjs <workdir> <out.mp4>. Speeds up the long search wait (cuts.json), places each scene's voiceover, adds a chime at the switch.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [work, out] = process.argv.slice(2);
const starts = JSON.parse(fs.readFileSync(path.join(work, 'starts.json')));
const cuts = fs.existsSync(path.join(work, 'cuts.json')) ? JSON.parse(fs.readFileSync(path.join(work, 'cuts.json'))) : [];
const vid = fs.readdirSync(path.join(work, 'video')).filter((f) => f.endsWith('.webm')).map((f) => path.join(work, 'video', f))[0];
const LEAD = Number(process.env.LEAD ?? 0.4);
const map = (t) => t - cuts.reduce((a, c) => a + (t >= c.to ? (c.to - c.from) * (1 - 1 / c.factor) : t > c.from ? (t - c.from) * (1 - 1 / c.factor) : 0), 0);
// video: normal runs and sped-up runs, concatenated
const vf = []; let at = 0; const parts = [];
cuts.forEach((c, i) => {
  vf.push(`[0:v]trim=${at}:${c.from},setpts=PTS-STARTPTS[n${i}]`); parts.push(`[n${i}]`);
  vf.push(`[0:v]trim=${c.from}:${c.to},setpts=(PTS-STARTPTS)/${c.factor}[s${i}]`); parts.push(`[s${i}]`); at = c.to;
});
vf.push(`[0:v]trim=start=${at},setpts=PTS-STARTPTS[nl]`); parts.push('[nl]');
vf.push(`${parts.join('')}concat=n=${parts.length}:v=1:a=0,scale=1920:1080:flags=lanczos,fps=30[vout]`);
const ids = Object.keys(starts).filter((k) => !k.startsWith('_')); const args = ['-y', '-i', vid]; const af = [];
ids.forEach((id, i) => { args.push('-i', path.join(work, 'audio', id + '.mp3')); const ms = Math.max(0, Math.round((map(starts[id]) + LEAD) * 1000)); af.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.6[a${i}]`); });
let n = ids.length; const mix = ids.map((_, i) => `[a${i}]`);
if (starts._chime) { // a short rising three-note chime
  const ms = Math.round((map(starts._chime) + LEAD) * 1000);
  [[784, 0], [988, 140], [1319, 280]].forEach(([f, d], k) => { af.push(`aevalsrc='0.35*sin(2*PI*${f}*t)*exp(-3*t)':d=1.2:s=44100,adelay=${ms + d}|${ms + d}[c${k}]`); mix.push(`[c${k}]`); n++; });
}
af.push(`${mix.join('')}amix=inputs=${n}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5[aout]`);
args.push('-filter_complex', [...vf, ...af].join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
