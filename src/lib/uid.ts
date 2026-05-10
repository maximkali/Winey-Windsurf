import { randomUUID } from 'crypto';

export function newUid() {
  return randomUUID();
}
