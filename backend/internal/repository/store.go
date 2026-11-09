package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/domain"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrInsufficient  = errors.New("insufficient stock")
	ErrConflict      = errors.New("conflict")
	ErrInvalidStatus = errors.New("invalid status transition")
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) CreateUser(ctx context.Context, name, email, passwordHash string) (domain.User, error) {
	var u domain.User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "user" (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, name, email, COALESCE(phone,''), COALESCE(address,'')`,
		name, email, passwordHash,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Phone, &u.Address)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return u, ErrConflict
		}
		return u, err
	}
	return u, nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	var u domain.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, password_hash, COALESCE(phone,''), COALESCE(address,'')
		FROM "user" WHERE email = $1`, email,
	).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Phone, &u.Address)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id int64) (domain.User, error) {
	var u domain.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, password_hash, COALESCE(phone,''), COALESCE(address,'')
		FROM "user" WHERE id = $1`, id,
	).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Phone, &u.Address)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) CreateAdmin(ctx context.Context, name, email, passwordHash string) (domain.Admin, error) {
	var a domain.Admin
	err := s.pool.QueryRow(ctx, `
		INSERT INTO admin (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, name, email`,
		name, email, passwordHash,
	).Scan(&a.ID, &a.Name, &a.Email)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return a, ErrConflict
		}
		return a, err
	}
	return a, nil
}

func (s *Store) AdminByEmail(ctx context.Context, email string) (domain.Admin, error) {
	var a domain.Admin
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, password_hash FROM admin WHERE email = $1`, email,
	).Scan(&a.ID, &a.Name, &a.Email, &a.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

func (s *Store) EnsureCategory(ctx context.Context, name string) (domain.Category, error) {
	var c domain.Category
	err := s.pool.QueryRow(ctx, `
		INSERT INTO category (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name`, name,
	).Scan(&c.ID, &c.Name)
	return c, err
}

func (s *Store) EnsureBrand(ctx context.Context, name string) (domain.Brand, error) {
	var b domain.Brand
	err := s.pool.QueryRow(ctx, `
		INSERT INTO brand (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name`, name,
	).Scan(&b.ID, &b.Name)
	return b, err
}

func (s *Store) ListCategories(ctx context.Context) ([]domain.Category, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name FROM category ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) ListBrands(ctx context.Context) ([]domain.Brand, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name FROM brand ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Brand
	for rows.Next() {
		var b domain.Brand
		if err := rows.Scan(&b.ID, &b.Name); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) GetBanner(ctx context.Context) (domain.Banner, error) {
	var b domain.Banner
	err := s.pool.QueryRow(ctx, `
		SELECT id, title, subtitle, COALESCE(image_url,''), COALESCE(link_url,'')
		FROM banner WHERE id = 1`,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.ImageURL, &b.LinkURL)
	return b, err
}

func (s *Store) UpdateBanner(ctx context.Context, b domain.Banner) (domain.Banner, error) {
	err := s.pool.QueryRow(ctx, `
		UPDATE banner SET title=$1, subtitle=$2, image_url=$3, link_url=$4, updated_at=NOW()
		WHERE id=1
		RETURNING id, title, subtitle, COALESCE(image_url,''), COALESCE(link_url,'')`,
		b.Title, b.Subtitle, b.ImageURL, b.LinkURL,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.ImageURL, &b.LinkURL)
	return b, err
}

func (s *Store) GetSettings(ctx context.Context) (domain.StoreSettings, error) {
	var st domain.StoreSettings
	err := s.pool.QueryRow(ctx, `
		SELECT contact_address, contact_phone, whatsapp_url, map_embed_url
		FROM store_settings WHERE id = 1`,
	).Scan(&st.ContactAddress, &st.ContactPhone, &st.WhatsAppURL, &st.MapEmbedURL)
	return st, err
}

func scanProduct(row pgx.Row) (domain.Product, error) {
	var p domain.Product
	var catID, brandID *int64
	var catName, brandName *string
	err := row.Scan(
		&p.ID, &p.SKU, &p.Barcode, &p.Name, &catID, &catName, &brandID, &brandName,
		&p.Variant, &p.Description, &p.BuyPrice, &p.SellPrice, &p.MarginPct, &p.Stock,
		&p.WeightG, &p.LengthCM, &p.WidthCM, &p.HeightCM, &p.Condition, &p.UploadStatus,
		&p.ImageURL, &p.Hidden,
	)
	if err != nil {
		return p, err
	}
	p.CategoryID = catID
	p.BrandID = brandID
	if catName != nil {
		p.CategoryName = *catName
	}
	if brandName != nil {
		p.BrandName = *brandName
	}
	return p.WithStockStatus(), nil
}

const productSelect = `
	SELECT p.id, p.sku, COALESCE(p.barcode,''), p.name, p.category_id, c.name, p.brand_id, b.name,
		COALESCE(p.variant,''), COALESCE(p.description,''), p.buy_price, p.sell_price, COALESCE(p.margin_pct,0),
		p.stock, COALESCE(p.weight_g,0), COALESCE(p.length_cm,0), COALESCE(p.width_cm,0), COALESCE(p.height_cm,0),
		COALESCE(p.condition,''), COALESCE(p.upload_status,''), COALESCE(p.image_url,''), p.hidden
	FROM product p
	LEFT JOIN category c ON c.id = p.category_id
	LEFT JOIN brand b ON b.id = p.brand_id`

func (s *Store) ProductByID(ctx context.Context, id int64, includeHidden bool) (domain.Product, error) {
	q := productSelect + ` WHERE p.id = $1`
	if !includeHidden {
		q += ` AND p.hidden = FALSE`
	}
	p, err := scanProduct(s.pool.QueryRow(ctx, q, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func (s *Store) ListProducts(ctx context.Context, f domain.ProductListFilter) ([]domain.Product, error) {
	var conds []string
	var args []any
	n := 1
	if !f.IncludeHidden {
		conds = append(conds, "p.hidden = FALSE")
	}
	if f.CategoryID != nil {
		conds = append(conds, fmt.Sprintf("p.category_id = $%d", n))
		args = append(args, *f.CategoryID)
		n++
	}
	if f.BrandID != nil {
		conds = append(conds, fmt.Sprintf("p.brand_id = $%d", n))
		args = append(args, *f.BrandID)
		n++
	}
	if f.MinPrice != nil {
		conds = append(conds, fmt.Sprintf("p.sell_price >= $%d", n))
		args = append(args, *f.MinPrice)
		n++
	}
	if f.MaxPrice != nil {
		conds = append(conds, fmt.Sprintf("p.sell_price <= $%d", n))
		args = append(args, *f.MaxPrice)
		n++
	}
	if f.Query != "" {
		conds = append(conds, fmt.Sprintf(`(
			p.name ILIKE $%d OR COALESCE(b.name,'') ILIKE $%d OR COALESCE(p.variant,'') ILIKE $%d OR p.sku ILIKE $%d
		)`, n, n, n, n))
		args = append(args, "%"+f.Query+"%")
		n++
	}
	where := ""
	if len(conds) > 0 {
		where = " WHERE " + strings.Join(conds, " AND ")
	}
	order := " ORDER BY p.name ASC"
	switch f.Sort {
	case "price_asc":
		order = " ORDER BY p.sell_price ASC"
	case "price_desc":
		order = " ORDER BY p.sell_price DESC"
	case "newest":
		order = " ORDER BY p.created_at DESC"
	}
	rows, err := s.pool.Query(ctx, productSelect+where+order, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) UpsertProduct(ctx context.Context, p domain.Product, writeInitialLedger bool) (domain.Product, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return p, err
	}
	defer tx.Rollback(ctx)

	var existingID int64
	var existingStock int
	err = tx.QueryRow(ctx, `SELECT id, stock FROM product WHERE sku = $1`, p.SKU).Scan(&existingID, &existingStock)
	isNew := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !isNew {
		return p, err
	}

	if isNew {
		err = tx.QueryRow(ctx, `
			INSERT INTO product (
				sku, barcode, name, category_id, brand_id, variant, description,
				buy_price, sell_price, margin_pct, stock, weight_g, length_cm, width_cm, height_cm,
				condition, upload_status, image_url, hidden
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
			RETURNING id`,
			p.SKU, nullStr(p.Barcode), p.Name, p.CategoryID, p.BrandID, nullStr(p.Variant), nullStr(p.Description),
			p.BuyPrice, p.SellPrice, p.MarginPct, p.Stock, p.WeightG, p.LengthCM, p.WidthCM, p.HeightCM,
			nullStr(p.Condition), nullStr(p.UploadStatus), nullStr(p.ImageURL), p.Hidden,
		).Scan(&p.ID)
		if err != nil {
			return p, err
		}
		if writeInitialLedger && p.Stock != 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty)
				VALUES (NULL, $1, $2, $3)`, domain.LedgerAdminAdd, p.ID, p.Stock); err != nil {
				return p, err
			}
		}
	} else {
		p.ID = existingID
		delta := p.Stock - existingStock
		_, err = tx.Exec(ctx, `
			UPDATE product SET
				barcode=$2, name=$3, category_id=$4, brand_id=$5, variant=$6, description=$7,
				buy_price=$8, sell_price=$9, margin_pct=$10, stock=$11, weight_g=$12,
				length_cm=$13, width_cm=$14, height_cm=$15, condition=$16, upload_status=$17,
				image_url=$18, hidden=$19, updated_at=NOW()
			WHERE id=$1`,
			p.ID, nullStr(p.Barcode), p.Name, p.CategoryID, p.BrandID, nullStr(p.Variant), nullStr(p.Description),
			p.BuyPrice, p.SellPrice, p.MarginPct, p.Stock, p.WeightG, p.LengthCM, p.WidthCM, p.HeightCM,
			nullStr(p.Condition), nullStr(p.UploadStatus), nullStr(p.ImageURL), p.Hidden,
		)
		if err != nil {
			return p, err
		}
		if delta > 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty)
				VALUES (NULL, $1, $2, $3)`, domain.LedgerAdminAdd, p.ID, delta); err != nil {
				return p, err
			}
		} else if delta < 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty)
				VALUES (NULL, $1, $2, $3)`, domain.LedgerAdminReduce, p.ID, delta); err != nil {
				return p, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return p, err
	}
	return s.ProductByID(ctx, p.ID, true)
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (s *Store) PlaceOrder(ctx context.Context, in domain.PlaceOrderInput) (domain.Order, error) {
	var out domain.Order
	if len(in.Lines) == 0 {
		return out, fmt.Errorf("no lines")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()
	day := now.Format("20060102")
	dayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	var seq int
	err = tx.QueryRow(ctx, `
		INSERT INTO order_daily_counter (day_key, last_seq)
		VALUES ($1::date, 1)
		ON CONFLICT (day_key) DO UPDATE SET last_seq = order_daily_counter.last_seq + 1
		RETURNING last_seq`, dayDate,
	).Scan(&seq)
	if err != nil {
		return out, err
	}
	orderNumber := fmt.Sprintf("ORD-%s%05d", day, seq)

	err = tx.QueryRow(ctx, `
		INSERT INTO "order" (order_number, status, user_id, customer_name, customer_phone, customer_address, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
		orderNumber, domain.OrderPending, in.UserID, in.CustomerName, in.CustomerPhone, in.CustomerAddress, in.Note,
	).Scan(&out.ID, &out.OrderNumber, &out.Status, &out.UserID, &out.CustomerName, &out.CustomerPhone, &out.CustomerAddress, &out.Note, &out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		return out, err
	}

	for _, line := range in.Lines {
		if line.Qty <= 0 {
			return out, fmt.Errorf("invalid qty")
		}
		var p domain.Product
		err = tx.QueryRow(ctx, `
			SELECT id, sku, name, sell_price, stock FROM product WHERE id = $1 FOR UPDATE`,
			line.ProductID,
		).Scan(&p.ID, &p.SKU, &p.Name, &p.SellPrice, &p.Stock)
		if errors.Is(err, pgx.ErrNoRows) {
			return out, ErrNotFound
		}
		if err != nil {
			return out, err
		}
		if p.Stock < line.Qty {
			return out, ErrInsufficient
		}
		newStock := p.Stock - line.Qty
		if _, err := tx.Exec(ctx, `UPDATE product SET stock = $2, updated_at = NOW() WHERE id = $1`, p.ID, newStock); err != nil {
			return out, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty)
			VALUES ($1, $2, $3, $4)`, out.ID, domain.LedgerPurchase, p.ID, -line.Qty); err != nil {
			return out, err
		}
		var item domain.OrderItem
		err = tx.QueryRow(ctx, `
			INSERT INTO order_item (order_id, product_id, qty, unit_price, product_name, product_sku)
			VALUES ($1,$2,$3,$4,$5,$6)
			RETURNING id, order_id, product_id, qty, unit_price, product_name, product_sku`,
			out.ID, p.ID, line.Qty, p.SellPrice, p.Name, p.SKU,
		).Scan(&item.ID, &item.OrderID, &item.ProductID, &item.Qty, &item.UnitPrice, &item.ProductName, &item.ProductSKU)
		if err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}

	if err := tx.Commit(ctx); err != nil {
		return out, err
	}
	return out, nil
}

func (s *Store) OrderByNumber(ctx context.Context, number string) (domain.Order, error) {
	var o domain.Order
	err := s.pool.QueryRow(ctx, `
		SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
		FROM "order" WHERE order_number = $1`, number,
	).Scan(&o.ID, &o.OrderNumber, &o.Status, &o.UserID, &o.CustomerName, &o.CustomerPhone, &o.CustomerAddress, &o.Note, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	if err != nil {
		return o, err
	}
	items, err := s.orderItems(ctx, o.ID)
	o.Items = items
	return o, err
}

func (s *Store) orderItems(ctx context.Context, orderID int64) ([]domain.OrderItem, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, order_id, product_id, qty, unit_price, product_name, product_sku
		FROM order_item WHERE order_id = $1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.OrderItem
	for rows.Next() {
		var it domain.OrderItem
		if err := rows.Scan(&it.ID, &it.OrderID, &it.ProductID, &it.Qty, &it.UnitPrice, &it.ProductName, &it.ProductSKU); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (s *Store) ListOrders(ctx context.Context) ([]domain.Order, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
		FROM "order" ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Order
	for rows.Next() {
		var o domain.Order
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.Status, &o.UserID, &o.CustomerName, &o.CustomerPhone, &o.CustomerAddress, &o.Note, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (s *Store) CompleteOrder(ctx context.Context, id int64) (domain.Order, error) {
	var o domain.Order
	err := s.pool.QueryRow(ctx, `
		UPDATE "order" SET status = $2, updated_at = NOW()
		WHERE id = $1 AND status = $3
		RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
		id, domain.OrderComplete, domain.OrderPending,
	).Scan(&o.ID, &o.OrderNumber, &o.Status, &o.UserID, &o.CustomerName, &o.CustomerPhone, &o.CustomerAddress, &o.Note, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrInvalidStatus
	}
	return o, err
}

func (s *Store) CancelOrder(ctx context.Context, id int64) (domain.Order, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Order{}, err
	}
	defer tx.Rollback(ctx)

	var o domain.Order
	err = tx.QueryRow(ctx, `
		SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
		FROM "order" WHERE id = $1 FOR UPDATE`, id,
	).Scan(&o.ID, &o.OrderNumber, &o.Status, &o.UserID, &o.CustomerName, &o.CustomerPhone, &o.CustomerAddress, &o.Note, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	if err != nil {
		return o, err
	}
	if o.Status != domain.OrderPending {
		return o, ErrInvalidStatus
	}

	rows, err := tx.Query(ctx, `SELECT product_id, qty FROM order_item WHERE order_id = $1`, id)
	if err != nil {
		return o, err
	}
	type line struct {
		ProductID int64
		Qty       int
	}
	var lines []line
	for rows.Next() {
		var l line
		if err := rows.Scan(&l.ProductID, &l.Qty); err != nil {
			rows.Close()
			return o, err
		}
		lines = append(lines, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return o, err
	}

	for _, l := range lines {
		if _, err := tx.Exec(ctx, `
			UPDATE product SET stock = stock + $2, updated_at = NOW() WHERE id = $1`, l.ProductID, l.Qty); err != nil {
			return o, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty)
			VALUES ($1, $2, $3, $4)`, id, domain.LedgerRestore, l.ProductID, l.Qty); err != nil {
			return o, err
		}
	}

	err = tx.QueryRow(ctx, `
		UPDATE "order" SET status = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
		id, domain.OrderCanceled,
	).Scan(&o.ID, &o.OrderNumber, &o.Status, &o.UserID, &o.CustomerName, &o.CustomerPhone, &o.CustomerAddress, &o.Note, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return o, err
	}
	if err := tx.Commit(ctx); err != nil {
		return o, err
	}
	items, _ := s.orderItems(ctx, o.ID)
	o.Items = items
	return o, nil
}
