-- Step 1: Drop the existing constraint
ALTER TABLE internal_notifications DROP CONSTRAINT IF EXISTS internal_notifications_publico_check;

-- Step 2: Update existing data to canonical values
UPDATE internal_notifications SET publico = 'clientes' WHERE publico = 'cliente';
UPDATE internal_notifications SET publico = 'prestadores' WHERE publico = 'prestador';
UPDATE internal_notifications SET publico = 'todos' WHERE publico = 'ambos';

-- Step 3: Add the new constraint with canonical values
ALTER TABLE internal_notifications ADD CONSTRAINT internal_notifications_publico_check 
  CHECK (publico = ANY (ARRAY['clientes'::text, 'prestadores'::text, 'todos'::text]));