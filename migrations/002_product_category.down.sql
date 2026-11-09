ALTER TABLE product ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES category(id);

UPDATE product p
SET category_id = sub.category_id
FROM (
  SELECT DISTINCT ON (product_id) product_id, category_id
  FROM product_category
  ORDER BY product_id, id
) sub
WHERE p.id = sub.product_id AND p.category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_category ON product (category_id);

DROP TABLE IF EXISTS product_category;
