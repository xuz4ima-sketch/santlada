/**
 * Собирает примеры из src/assets/works/<вид>/ (и видео из src/assets/videos/<вид>/, если они включены),
 * фото с объектов Исы — из src/assets/objects/<вид>/, и готовит оптимизированные картинки.
 * Выполняется при сборке сайта.
 */
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { ceilingTypes, ceilingOrder, type CeilingType } from '../config/site';
import { featured, showVideos, workInfo } from '../data/works';

export interface WorkImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

export interface Work {
  /** w-… для примеров, o-… для фото с объектов, v-… для видео — по нему строится ссылка в заявке */
  id: string;
  file: string;
  kind: 'photo' | 'video';
  types: CeilingType[];
  caption: string;
  thumb: WorkImage;
  full: WorkImage;
  video?: string;
}

const photoFiles = import.meta.glob<{ default: ImageMetadata }>('/src/assets/works/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
});
const objectFiles = import.meta.glob<{ default: ImageMetadata }>('/src/assets/objects/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
});
const videoFiles = import.meta.glob<string>('/src/assets/videos/*/*.{mp4,MP4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const posterFiles = import.meta.glob<{ default: ImageMetadata }>('/src/assets/videos/*/*.{jpg,jpeg,png,webp}', { eager: true });

const parse = (path: string) => {
  const [, type, file] = path.match(/\/([^/]+)\/([^/]+)\.[a-z0-9]+$/i) ?? [];
  return { type: type as CeilingType, file };
};

async function optimize(img: ImageMetadata): Promise<{ thumb: WorkImage; full: WorkImage }> {
  const thumb = await getImage({ src: img, widths: [360, 540, 720, 1080].filter((w) => w <= img.width), format: 'webp', quality: 72 });
  const full = await getImage({ src: img, format: 'webp', quality: 82 });
  return {
    thumb: { src: thumb.src, srcset: thumb.srcSet.attribute, width: img.width, height: img.height },
    full: { src: full.src, srcset: full.srcSet.attribute, width: img.width, height: img.height },
  };
}

const order = (file: string) => {
  const i = featured.indexOf(file);
  return i >= 0 ? i : featured.length;
};

let cache: Promise<Work[]> | undefined;
let objectsCache: Promise<Work[]> | undefined;

/** Примеры потолков для галереи, слайдов и калькулятора */
export function getWorks(): Promise<Work[]> {
  cache ??= build();
  return cache;
}

/** Фото с объектов Исы для блока «С объектов Исы» */
export function getObjects(): Promise<Work[]> {
  objectsCache ??= photos(objectFiles, 'o').then(sort);
  return objectsCache;
}

async function photos(files: Record<string, { default: ImageMetadata }>, prefix: string): Promise<Work[]> {
  const works: Work[] = [];
  for (const [path, mod] of Object.entries(files)) {
    const { type, file } = parse(path);
    if (!ceilingOrder.includes(type)) continue;
    const info = workInfo[file];
    works.push({
      id: `${prefix}-${file}`,
      file,
      kind: 'photo',
      types: [type, ...(info?.also ?? []).filter((t) => t !== type)],
      caption: info?.caption ?? ceilingTypes[type].name,
      ...(await optimize(mod.default)),
    });
  }
  return works;
}

async function build(): Promise<Work[]> {
  const works = await photos(photoFiles, 'w');

  for (const [path, url] of Object.entries(showVideos ? videoFiles : {})) {
    const { type, file } = parse(path);
    if (!ceilingOrder.includes(type)) continue;
    const poster = Object.entries(posterFiles).find(([p]) => parse(p).file === file && parse(p).type === type)?.[1];
    if (!poster) continue;
    const info = workInfo[file];
    works.push({
      id: `v-${file}`,
      file,
      kind: 'video',
      types: [type, ...(info?.also ?? []).filter((t) => t !== type)],
      caption: info?.caption ?? ceilingTypes[type].name,
      video: url,
      ...(await optimize(poster.default)),
    });
  }

  return sort(works);
}

// Сначала избранные, затем от новых постов к старым (имя файла — номер поста), остальные по имени
const sort = (works: Work[]) =>
  works.sort((a, b) => order(a.file) - order(b.file) || Number(b.file) - Number(a.file) || a.file.localeCompare(b.file, 'ru', { numeric: true }));

/** Работы для галереи на главной: по несколько каждого вида, чтобы фильтры не были пустыми */
export function pickForHome(works: Work[], limit = 24): Work[] {
  const picked = works.filter((w) => featured.includes(w.file));
  for (const type of ceilingOrder) {
    for (const w of works) {
      if (picked.length >= limit) break;
      if (w.types[0] === type && !picked.includes(w) && picked.filter((p) => p.types[0] === type).length < limit / 4) picked.push(w);
    }
  }
  return works.filter((w) => picked.includes(w)).slice(0, limit);
}
