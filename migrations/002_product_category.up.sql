-- Many-to-many product ↔ category via product_category.
CREATE TABLE IF NOT EXISTS product_category (
    id           BIGSERIAL PRIMARY KEY,
    category_id  BIGINT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    product_id   BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    UNIQUE (category_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category (product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category (category_id);

-- Migrate legacy product.category_id rows (no-op if column already dropped).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product' AND column_name = 'category_id'
  ) THEN
    INSERT INTO product_category (category_id, product_id)
    SELECT category_id, id FROM product WHERE category_id IS NOT NULL
    ON CONFLICT (category_id, product_id) DO NOTHING;

    DROP INDEX IF EXISTS idx_product_category;
    ALTER TABLE product DROP COLUMN category_id;
  END IF;
END $$;
