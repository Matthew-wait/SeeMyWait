-- ============================================================================
-- Drop duplicate (latitude, longitude) B-tree indexes.
-- ============================================================================
-- `idx_clinics_location` and `clinics_lat_lng_idx` are both plain btree
-- indexes on the exact same (latitude, longitude) columns — an accidental
-- duplicate from an earlier migration. Neither is needed any more: the old
-- bounding-box radius search they supported has been replaced by the GiST
-- `geog` index (20260928000001), and no other query in the codebase filters
-- lat/lng by range directly (confirmed via grep — everything goes through
-- nearby_clinics() or plain text search). Dropping both reclaims real disk
-- on a project that is currently near its disk cap.
-- ============================================================================

drop index concurrently if exists public.idx_clinics_location;
drop index concurrently if exists public.clinics_lat_lng_idx;
