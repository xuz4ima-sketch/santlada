import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import type { ReadableAtom } from 'nanostores';

/** true после первого рендера в браузере */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Значение из хранилища, которое пишется в localStorage.
 * До монтирования возвращает значение по умолчанию — так разметка с сервера
 * совпадает с первой отрисовкой в браузере.
 */
export function useClientStore<T>(store: ReadableAtom<T>, serverValue: T): T {
  const value = useStore(store);
  return useMounted() ? value : serverValue;
}
