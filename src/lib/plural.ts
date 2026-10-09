/** Склонение по числу: plural(2, ['комната', 'комнаты', 'комнат']) → «комнаты» */
export function plural(n: number, forms: [string, string, string] = ['комната', 'комнаты', 'комнат']): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
