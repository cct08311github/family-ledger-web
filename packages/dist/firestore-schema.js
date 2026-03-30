/**
 * Firestore Schema Constants for Family Ledger
 *
 * Centralized collection path constants used across the application.
 * This ensures consistent path references throughout the codebase.
 */
export const FirestoreSchema = {
    groups: 'groups',
    members: 'members',
    expenses: 'expenses',
    settlements: 'settlements',
    categories: 'categories',
    notifications: 'notifications',
    activityLogs: 'activityLogs',
};
/**
 * Get the path for a group document
 */
export function groupPath(groupId) {
    return `groups/${groupId}`;
}
/**
 * Get the path for the members subcollection within a group
 */
export function membersPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.members}`;
}
/**
 * Get the path for the expenses subcollection within a group
 */
export function expensesPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.expenses}`;
}
/**
 * Get the path for the settlements subcollection within a group
 */
export function settlementsPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.settlements}`;
}
/**
 * Get the path for the categories subcollection within a group
 */
export function categoriesPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.categories}`;
}
/**
 * Get the path for the notifications subcollection within a group
 */
export function notificationsPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.notifications}`;
}
/**
 * Get the path for the activityLogs subcollection within a group
 */
export function activityLogsPath(groupId) {
    return `groups/${groupId}/${FirestoreSchema.activityLogs}`;
}
