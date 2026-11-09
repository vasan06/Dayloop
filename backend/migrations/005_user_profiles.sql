ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(24),
    ADD COLUMN IF NOT EXISTS age SMALLINT,
    ADD COLUMN IF NOT EXISTS role VARCHAR(32),
    ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (lower(username)) WHERE username IS NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT users_age_range_check
    CHECK (age IS NULL OR age BETWEEN 13 AND 120);

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IS NULL OR role IN (
        'school_student','student','working','freelancer',
        'entrepreneur','organization','educator','other'
    ));
