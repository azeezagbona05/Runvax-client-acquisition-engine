// Generates one mp3 per scene with OpenAI TTS, then writes durations.json (seconds). Needs OPENAI_API_KEY.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const n = JSON.parse(fs.readFileSync(new URL('./narration.json', import.meta.url)));
const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY missing');
const durations = {};
for (const s of n.scenes) {
  const f = path.join(out, `${s.id}.mp3`);
  const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: n.voice, input: s.text, instructions: n.instructions, response_format: 'mp3' }) });
  if (!r.ok) throw new Error(`${s.id}: ${r.status} ${await r.text()}`);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  durations[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  console.log(s.id, durations[s.id].toFixed(1) + 's');
}
fs.writeFileSync(path.join(out, 'durations.json'), JSON.stringify(durations, null, 2));
