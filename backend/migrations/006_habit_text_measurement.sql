ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_measurement_type_check;
ALTER TABLE habits ADD CONSTRAINT habits_measurement_type_check CHECK (measurement_type IN ('boolean','quantity','duration','text'));
