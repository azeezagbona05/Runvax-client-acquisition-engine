// Places each scene's voiceover at the moment that scene began, then encodes 1080p mp4. usage: node mux.mjs <workdir> <out.mp4>
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [work, out] = process.argv.slice(2);
const starts = JSON.parse(fs.readFileSync(path.join(work, 'starts.json')));
const vid = fs.readdirSync(path.join(work, 'video')).filter((f) => f.endsWith('.webm')).map((f) => path.join(work, 'video', f))[0];
const LEAD = Number(process.env.LEAD ?? 0.4); // seconds the video lags the wall clock at scene start
const ids = Object.keys(starts); const args = ['-y', '-i', vid]; const filt = [];
ids.forEach((id, i) => { args.push('-i', path.join(work, 'audio', id + '.mp3')); const ms = Math.max(0, Math.round((starts[id] + LEAD) * 1000)); filt.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.6[a${i}]`); });
filt.push(ids.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${ids.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5[aout]`);
args.push('-filter_complex', filt.join(';'), '-map', '0:v', '-map', '[aout]', '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
