-- Database Cleanup Script for Receipt OCR Importer
-- Execute these commands in Supabase SQL Editor

-- WARNING: This will permanently delete data. Make sure to backup if needed.
-- Review each command before executing.

-- 1. Drop unused tables
DROP TABLE IF EXISTS public.detection_results CASCADE;
DROP TABLE IF EXISTS public.detection_rules CASCADE;
DROP TABLE IF EXISTS public.detection_statistics CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;

-- 2. Remove unused columns from items table
ALTER TABLE public.items DROP COLUMN IF EXISTS receipt_id;
ALTER TABLE public.items DROP COLUMN IF EXISTS registered_at;

-- 3. Add currency column to items table (if not already exists)
-- Note: This column appears to be used in the application but missing from the schema
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT '¥';

-- 4. Update items table to match the cleaned schema
-- Verify the final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Optional: Add constraints for data integrity
-- ALTER TABLE public.items ADD CONSTRAINT items_currency_check CHECK (currency IN ('¥', '$', '€', '£'));
-- ALTER TABLE public.items ADD CONSTRAINT items_quantity_positive CHECK (quantity > 0);
-- ALTER TABLE public.items ADD CONSTRAINT items_price_positive CHECK (price >= 0);

-- 6. Clean up any orphaned data (if needed)
-- DELETE FROM public.items WHERE user_id NOT IN (SELECT id FROM auth.users);