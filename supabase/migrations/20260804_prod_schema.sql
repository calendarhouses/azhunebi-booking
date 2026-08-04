-- Azhunebi prod schema hardening (run in Supabase SQL editor once).
-- Safe to re-run: IF NOT EXISTS / OR REPLACE where possible.

-- Bookings: ensure columns used by migrate-db + DAL
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS guest_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS change_history jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS bookings_room_dates_idx
  ON public.bookings (room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS bookings_phone_idx
  ON public.bookings (phone);
CREATE INDEX IF NOT EXISTS bookings_status_idx
  ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx
  ON public.bookings (created_at);

-- Rooms extras live in rules._extras JSONB (no extra columns required)
CREATE INDEX IF NOT EXISTS rooms_active_idx ON public.rooms (active);

-- Settings / guest profiles
CREATE INDEX IF NOT EXISTS settings_key_idx ON public.settings (key);
CREATE INDEX IF NOT EXISTS guest_profiles_updated_at_idx
  ON public.guest_profiles (updated_at);

-- Keep-alive ping row (Supabase Free pause prevention)
INSERT INTO public.settings (key, value)
VALUES ('__keepalive', to_jsonb(now()::text))
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

-- Lock down: deny anon/authenticated direct table access (app uses service role)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_bookings ON public.bookings;
CREATE POLICY deny_all_bookings ON public.bookings
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_rooms ON public.rooms;
CREATE POLICY deny_all_rooms ON public.rooms
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_settings ON public.settings;
CREATE POLICY deny_all_settings ON public.settings
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_guest_profiles ON public.guest_profiles;
CREATE POLICY deny_all_guest_profiles ON public.guest_profiles
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
