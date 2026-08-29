-- Add onboarding tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1;