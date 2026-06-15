/**
 * seeding.ts — DISABLED
 *
 * All controllers now use real production data from MongoDB.
 * Seeding with mock/dummy data has been removed to prevent
 * hardcoded values appearing in the app.
 *
 * If you need test data, insert real records via the API endpoints.
 */
export const seedMockDataIfEmpty = async (_userId: string): Promise<void> => {
  // No-op: seeding disabled intentionally
};
