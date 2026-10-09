#!/usr/bin/env node
/**
 * Скачивает фото и видео из Telegram-канала в папку media-inbox/ для отбора.
 *
 * Запуск:
 *   node scripts/telegram-sync.mjs                 — все посты, только фото и обложки видео
 *   node scripts/telegram-sync.mjs --from 900      — только посты начиная с №900
 *   node scripts/telegram-sync.mjs --videos 802,804 — скачать сами видео по номерам постов
 *
 * Результат:
 *   media-inbox/manifest.json      — список постов: номер, дата, текст, тип, ссылки
 *   media-inbox/photos/<№>.jpg     — фото
 *   media-inbox/video-thumbs/<№>.jpg — обложки видео
 *   media-inbox/videos/<№>.mp4     — видео (только с флагом --videos)
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const CHANNEL = 'SantlaDAl';
const OUT = join(process.cwd(), 'media-inbox');
const CONCURRENCY = 8;
const MISSING_STREAK_TO_STOP = 40;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fromId = Number(argValue('--from') ?? 1);
const toId = argValue('--to') ? Number(argValue('--to')) : Infinity;
const videoIds = (argValue('--videos') ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);

const exists = (p) => access(p).then(() => true, () => false);

async function fetchText(url, tries = 3) {
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 500 * t));
  }
  return null;
}

async function download(url, file, tries = 3) {
  if (await exists(file)) return true;
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 700 * t));
  }
  return false;
}

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

/** Разбирает embed-страницу одного поста. */
function parsePost(id, html) {
  if (!html || html.includes('tgme_widget_message_error')) return null;
  const date = html.match(/datetime="([^"]+)"/)?.[1] ?? null;
  const textHtml = html.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  const text = textHtml ? decode(textHtml) : '';

  const photo = html.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1];
  const videoBlock = html.match(/tgme_widget_message_video_player[\s\S]*?<\/a>/)?.[0];

  if (videoBlock) {
    const thumb = videoBlock.match(/tgme_widget_message_video_thumb"[^>]*background-image:url\('([^']+)'\)/)?.[1];
    // Берём «чистое» видео, а не размытую подложку
    const src =
      videoBlock.match(/<video src="([^"]+)" class="tgme_widget_message_video js-message_video"/)?.[1] ??
      videoBlock.match(/<video src="([^"]+)"/)?.[1];
    const duration = videoBlock.match(/message_video_duration[^>]*>([^<]+)</)?.[1] ?? null;
    const width = Number(videoBlock.match(/tgme_widget_message_video_wrap" style="width:(\d+)px/)?.[1] ?? 0);
    const ratioPad = Number(videoBlock.match(/padding-top:([\d.]+)%/)?.[1] ?? 0);
    return { id, date, text, kind: 'video', thumb, src, duration, width, aspect: ratioPad ? +(100 / ratioPad).toFixed(4) : null };
  }
  if (photo) return { id, date, text, kind: 'photo', src: photo };
  return { id, date, text, kind: 'text' };
}

async function pool(items, worker) {
  let i = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
  } catch {
    return { channel: CHANNEL, posts: {} };
  }
}

async function main() {
  await mkdir(join(OUT, 'photos'), { recursive: true });
  await mkdir(join(OUT, 'video-thumbs'), { recursive: true });
  await mkdir(join(OUT, 'videos'), { recursive: true });
  const manifest = await loadManifest();

  if (videoIds.length) {
    // Ссылки на видео живут недолго, поэтому каждый раз берём свежую
    await pool(videoIds, async (id) => {
      const post = parsePost(id, await fetchText(`https://t.me/${CHANNEL}/${id}?embed=1&mode=tme&single=1`));
      if (post?.kind !== 'video' || !post.src) return console.log(`#${id}: это не видео`);
      const ok = await download(post.src, join(OUT, 'videos', `${id}.mp4`));
      console.log(`#${id}: ${ok ? 'видео скачано' : 'не удалось скачать'}`);
    });
    return;
  }

  let missingStreak = 0;
  let id = fromId;
  let found = 0;
  while (id <= toId && missingStreak < MISSING_STREAK_TO_STOP) {
    const batch = Array.from({ length: CONCURRENCY * 4 }, (_, k) => id + k).filter((n) => n <= toId);
    const results = new Map();
    await pool(batch, async (n) => {
      results.set(n, parsePost(n, await fetchText(`https://t.me/${CHANNEL}/${n}?embed=1&mode=tme&single=1`)));
    });
    for (const n of batch) {
      const post = results.get(n);
      if (!post) {
        missingStreak++;
        continue;
      }
      missingStreak = 0;
      found++;
      manifest.posts[n] = { ...manifest.posts[n], ...post };
    }
    await pool(batch.map((n) => results.get(n)).filter(Boolean), async (post) => {
      if (post.kind === 'photo') await download(post.src, join(OUT, 'photos', `${post.id}.jpg`));
      if (post.kind === 'video' && post.thumb) await download(post.thumb, join(OUT, 'video-thumbs', `${post.id}.jpg`));
    });
    process.stdout.write(`посты до №${batch.at(-1)} проверены, найдено ${found}\n`);
    id += batch.length;
  }

  manifest.updatedAt = new Date().toISOString();
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const posts = Object.values(manifest.posts);
  console.log(
    `Готово. Постов: ${posts.length}, фото: ${posts.filter((p) => p.kind === 'photo').length}, видео: ${posts.filter((p) => p.kind === 'video').length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
