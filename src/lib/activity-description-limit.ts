/**
 * Pure helper module (no Firebase imports) so Jest can unit-test without
 * bootstrapping auth/firestore. Issue #198.
 *
 * The constant matches `firestore.rules`:
 *   request.resource.data.description.size() <= 300
 */
export const MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH = 300

export function truncateActivityDescription(raw: string): string {
  return raw.length > MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH
    ? raw.slice(0, MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH - 1) + '…'
    : raw
}
