// Tiny event bus so the profile screen can tell list screens
// (Active Members, etc.) that interest / shortlist / ignore changed.
const listeners = new Set();

/** event: { userId, type: "interest" | "shortlist" | "ignore", value: boolean } */
export function emitMemberAction(event) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeMemberAction(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}