#!/usr/bin/env node
/**
 * Сжимает видео для сайта и делает обложку. Нужен установленный ffmpeg.
 *
 * Запуск:
 *   node scripts/compress-videos.mjs --type linii media-inbox/videos/898.mp4 media-inbox/videos/900.mp4
 *   node scripts/compress-videos.mjs --type klassika --max 15 мое-видео.mp4
 *
 * --type  папка вида потолка: klassika | paryashchiy | tenevoy | linii
 * --max   максимальная длина в секундах (по умолчанию 20)
 * --start с какой секунды начинать (по умолчанию 0)
 *
 * Результат: src/assets/videos/<type>/<имя>.mp4 и <имя>.jpg (обложка).
 * Видео сразу появится в разделе «Работы».
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const TYPES = ['klassika', 'paryashchiy', 'tenevoy', 'linii'];
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const type = opt('--type');
const max = Number(opt('--max', 20));
const start = Number(opt('--start', 0));
const files = args;

if (!TYPES.includes(type) || files.length === 0) {
  console.log('Укажите вид потолка и файлы, например:\n  node scripts/compress-videos.mjs --type linii видео.mp4');
  process.exit(1);
}

const outDir = join(process.cwd(), 'src', 'assets', 'videos', type);
mkdirSync(outDir, { recursive: true });

// Короткая сторона не больше 720 px, пропорции сохраняются
const scale = "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'";

for (const file of files) {
  const name = basename(file, extname(file));
  const mp4 = join(outDir, `${name}.mp4`);
  const jpg = join(outDir, `${name}.jpg`);
  const duration = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim(),
  );
  const length = Math.min(max, Math.max(1, duration - start));

  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-ss', String(start), '-t', String(length), '-i', file,
    '-vf', scale,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an',
    mp4,
  ]);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-ss', String(Math.min(1, length / 4)), '-i', mp4,
    '-frames:v', '1', '-q:v', '3', '-update', '1',
    jpg,
  ]);
  console.log(`${name}: готово (${length.toFixed(1)} с)`);
}
