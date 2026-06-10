-- Enable Row Level Security on all tables.
-- The backend connects via the postgres superuser (direct pooler URL) which
-- bypasses RLS, so existing behaviour is fully preserved.
-- This blocks any direct REST access via Supabase anon / authenticated keys.

ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Voucher"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutocompleteEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"          ENABLE ROW LEVEL SECURITY;
