/**
 * Firestore Schema Constants for Family Ledger
 *
 * Centralized collection path constants used across the application.
 * This ensures consistent path references throughout the codebase.
 */
export declare const FirestoreSchema: {
    readonly groups: "groups";
    readonly members: "members";
    readonly expenses: "expenses";
    readonly settlements: "settlements";
    readonly categories: "categories";
    readonly notifications: "notifications";
    readonly activityLogs: "activityLogs";
};
export type CollectionName = typeof FirestoreSchema[keyof typeof FirestoreSchema];
/**
 * Get the path for a group document
 */
export declare function groupPath(groupId: string): string;
/**
 * Get the path for the members subcollection within a group
 */
export declare function membersPath(groupId: string): string;
/**
 * Get the path for the expenses subcollection within a group
 */
export declare function expensesPath(groupId: string): string;
/**
 * Get the path for the settlements subcollection within a group
 */
export declare function settlementsPath(groupId: string): string;
/**
 * Get the path for the categories subcollection within a group
 */
export declare function categoriesPath(groupId: string): string;
/**
 * Get the path for the notifications subcollection within a group
 */
export declare function notificationsPath(groupId: string): string;
/**
 * Get the path for the activityLogs subcollection within a group
 */
export declare function activityLogsPath(groupId: string): string;
//# sourceMappingURL=firestore-schema.d.ts.map