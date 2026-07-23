import type { DocRecord } from './docStoreTypes';

export function docStoreCreateCompId(
  docRecord: DocRecord,
  prefix: string,
  compIdSetReserved?: Set<string>,
) {
  const prefixSafe = String(prefix || 'comp');
  let compId = '';
  do {
    compId = compIdCreateRandom(prefixSafe);
  } while (docRecord.compDataById[compId] || compIdSetReserved?.has(compId));
  compIdSetReserved?.add(compId);
  return compId;
}

export function compIdCreateRandom(prefix: string) {
  return `${String(prefix || 'comp')}-${idCreateRandom(8)}`;
}

const charListIdRandom = '0123456789abcdefghijklmnopqrstuvwxyz';

export function idCreateRandom(length = 8) {
  let id = '';
  for (let index = 0; index < length; index += 1) {
    id += charListIdRandom[Math.floor(Math.random() * charListIdRandom.length)];
  }
  return id;
}
