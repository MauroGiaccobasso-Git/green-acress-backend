-- Normaliza los datos existentes antes de aplicar restricciones.
UPDATE "Proveedor"
SET
  "nombre" = REGEXP_REPLACE(BTRIM("nombre"), '[[:space:]]+', ' ', 'g'),
  "contacto" = REGEXP_REPLACE(BTRIM("contacto"), '[[:space:]]+', ' ', 'g'),
  "telefono" = BTRIM("telefono"),
  "email" = LOWER(BTRIM("email"));

-- Los datos principales del proveedor son obligatorios.
ALTER TABLE "Proveedor"
  ALTER COLUMN "contacto" SET NOT NULL,
  ALTER COLUMN "telefono" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL;

-- Impide valores vacíos aunque no sean NULL.
ALTER TABLE "Proveedor"
  ADD CONSTRAINT "Proveedor_nombre_not_blank"
    CHECK (BTRIM("nombre") <> ''),
  ADD CONSTRAINT "Proveedor_contacto_not_blank"
    CHECK (BTRIM("contacto") <> ''),
  ADD CONSTRAINT "Proveedor_telefono_not_blank"
    CHECK (BTRIM("telefono") <> ''),
  ADD CONSTRAINT "Proveedor_email_not_blank"
    CHECK (BTRIM("email") <> '');

-- Impide nombres duplicados ignorando mayúsculas y espacios repetidos.
CREATE UNIQUE INDEX "Proveedor_nombre_normalizado_key"
ON "Proveedor" (
  LOWER(REGEXP_REPLACE(BTRIM("nombre"), '[[:space:]]+', ' ', 'g'))
);

-- Impide emails duplicados ignorando mayúsculas y espacios externos.
CREATE UNIQUE INDEX "Proveedor_email_normalizado_key"
ON "Proveedor" (LOWER(BTRIM("email")));

-- Optimiza el listado y filtrado administrativo.
CREATE INDEX "Proveedor_estado_nombre_idx"
ON "Proveedor" ("estado", "nombre");