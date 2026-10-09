import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { roomNames, type CeilingType } from '../config/site';
import { calcOrder, calcRoom, makeId, newRoom, perimeterOf, type Room } from '../lib/pricing';
import { emptyContact, type Contact } from '../lib/whatsapp';

const safeJson = <T>(fallback: () => T, normalize: (v: unknown) => T) => ({
  encode: JSON.stringify,
  decode: (raw: string): T => {
    try {
      return normalize(JSON.parse(raw));
    } catch {
      return fallback();
    }
  },
});

const asRoom = (v: unknown) => newRoom(typeof v === 'object' && v ? (v as Partial<Room>) : {});

/** Комнаты в заказе */
export const $rooms = persistentAtom<Room[]>(
  'santlada:rooms',
  [],
  safeJson(
    () => [],
    (v) => (Array.isArray(v) ? v.map(asRoom) : []),
  ),
);

/** Комната, которую сейчас собирают в калькуляторе */
export const $draft = persistentAtom<Room>('santlada:draft', newRoom(), safeJson(() => newRoom(), asRoom));

/** Контакты из формы — чтобы не вводить заново */
export const $contact = persistentAtom<Contact>(
  'santlada:contact',
  emptyContact,
  safeJson(
    () => emptyContact,
    (v) => ({ ...emptyContact, ...(typeof v === 'object' && v ? v : {}) }),
  ),
);

export const $cartOpen = atom(false);
/** Калькулятор на экране — мобильная панель показывает кнопку «Добавить в заказ» */
export const $calcInView = atom(false);
export const $notice = atom<{ id: number; text: string } | null>(null);

export const $order = computed($rooms, (rooms) => calcOrder(rooms));
export const $draftCalc = computed($draft, (room) => calcRoom(room));
export const $isEditing = computed([$draft, $rooms], (draft, rooms) => rooms.some((r) => r.id === draft.id));

export function updateDraft(patch: Partial<Room>) {
  $draft.set({ ...$draft.get(), ...patch });
}

export function setDraftType(type: CeilingType) {
  const draft = $draft.get();
  const patch: Partial<Room> = { type };
  // Для световых линий сразу подставляем примерную длину, чтобы цена была честной
  if (type === 'linii' && !draft.linesM) patch.linesM = Math.max(4, Math.round(perimeterOf(draft) * 0.4));
  updateDraft(patch);
}

export function toggleRef(id: string) {
  const refs = $draft.get().refs;
  updateDraft({ refs: refs.includes(id) ? refs.filter((r) => r !== id) : [...refs, id] });
}

function nextRoomName(rooms: Room[]): string {
  const used = new Set(rooms.map((r) => r.name));
  return roomNames.find((n) => !used.has(n)) ?? `Комната ${rooms.length + 1}`;
}

let noticeId = 0;
export function notify(text: string) {
  const id = ++noticeId;
  $notice.set({ id, text });
  setTimeout(() => {
    if ($notice.get()?.id === id) $notice.set(null);
  }, 4000);
}

/** Добавляет собранную комнату в заказ (или сохраняет изменения) и готовит следующую */
export function commitDraft() {
  const draft = $draft.get();
  const rooms = $rooms.get();
  const editing = rooms.some((r) => r.id === draft.id);
  const next = editing ? rooms.map((r) => (r.id === draft.id ? draft : r)) : [...rooms, draft];
  $rooms.set(next);
  $draft.set(newRoom({ name: nextRoomName(next), type: draft.type, canvas: draft.canvas }));
  notify(editing ? `Сохранили изменения: ${draft.name}` : `Добавили в заказ: ${draft.name}`);
}

export function resetDraft() {
  $draft.set(newRoom({ name: nextRoomName($rooms.get()) }));
}

export function editRoom(id: string) {
  const room = $rooms.get().find((r) => r.id === id);
  if (!room) return;
  $draft.set({ ...room });
  $cartOpen.set(false);
  scrollToCalc();
}

export function duplicateRoom(id: string) {
  const rooms = $rooms.get();
  const room = rooms.find((r) => r.id === id);
  if (!room) return;
  const copy = { ...room, id: makeId(), name: nextRoomName(rooms) };
  $rooms.set([...rooms, copy]);
}

export function removeRoom(id: string) {
  $rooms.set($rooms.get().filter((r) => r.id !== id));
  if ($draft.get().id === id) resetDraft();
}

export function clearOrder() {
  $rooms.set([]);
  resetDraft();
}

/** «Хочу такой»: выбирает вид потолка, запоминает пример и ведёт к калькулятору */
export function wantLike(work: { id: string; type: CeilingType }) {
  const draft = $draft.get();
  setDraftType(work.type);
  if (!draft.refs.includes(work.id)) updateDraft({ refs: [...$draft.get().refs, work.id] });
  notify('Пример добавлен в расчёт');
  // Переход — в следующем тике, чтобы закрытие просмотра успело обновить адрес страницы
  if (document.getElementById('calc')) setTimeout(scrollToCalc, 0);
  else setTimeout(() => window.location.assign('/#calc'), 0);
}

export function scrollToCalc() {
  const el = document.getElementById('calc');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
