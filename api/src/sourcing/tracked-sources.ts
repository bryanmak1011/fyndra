// Seed list of companies/boards to crawl. This is operational config, not
// engineering — populating a full tracked-company list is ongoing product
// work, not something to fabricate here. These are the real, verified
// tenants used to confirm each ATS provider's API shape this session
// (see tasks.md T048's build-status note); a real deployment would grow
// this list (and likely move it to the database) as more HK/TW-relevant
// companies on each platform are identified.
export const TRACKED_SOURCES = {
  yourator: true, // single Taiwan-wide board, no per-company param
  greenhouse: ['gitlab'] as string[],
  lever: ['tri'] as string[],
  ashby: ['Ramp'] as string[],
  workable: ['suade', 'workmotion'] as string[],
};
