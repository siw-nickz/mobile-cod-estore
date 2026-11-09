package domain

import "time"

const (
	OrderPending  = "pending"
	OrderComplete = "complete"
	OrderCanceled = "canceled"

	LedgerPurchase    = "purchase"
	LedgerAdminAdd    = "admin-add"
	LedgerAdminReduce = "admin-reduce"
	LedgerRestore     = "restore"
)

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Brand struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Product struct {
	ID           int64   `json:"id"`
	SKU          string  `json:"sku"`
	Barcode      string  `json:"barcode,omitempty"`
	Name         string  `json:"name"`
	CategoryID   *int64  `json:"category_id,omitempty"`
	CategoryName string  `json:"category_name,omitempty"`
	BrandID      *int64  `json:"brand_id,omitempty"`
	BrandName    string  `json:"brand_name,omitempty"`
	Variant      string  `json:"variant,omitempty"`
	Description  string  `json:"description,omitempty"`
	BuyPrice     float64 `json:"buy_price"`
	SellPrice    float64 `json:"sell_price"`
	MarginPct    float64 `json:"margin_pct,omitempty"`
	Stock        int     `json:"stock"`
	WeightG      int     `json:"weight_g,omitempty"`
	LengthCM     float64 `json:"length_cm,omitempty"`
	WidthCM      float64 `json:"width_cm,omitempty"`
	HeightCM     float64 `json:"height_cm,omitempty"`
	Condition    string  `json:"condition,omitempty"`
	UploadStatus string  `json:"upload_status,omitempty"`
	ImageURL     string  `json:"image_url,omitempty"`
	Hidden       bool    `json:"hidden"`
	StockStatus  string  `json:"stock_status,omitempty"`
}

func (p Product) WithStockStatus() Product {
	if p.Stock <= 0 {
		p.StockStatus = "out_of_stock"
	} else if p.Stock <= 5 {
		p.StockStatus = "low"
	} else {
		p.StockStatus = "in_stock"
	}
	return p
}

type Banner struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	ImageURL string `json:"image_url"`
	LinkURL  string `json:"link_url"`
}

type User struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone,omitempty"`
	Address      string `json:"address,omitempty"`
	PasswordHash string `json:"-"`
}

type Admin struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
}

type OrderItem struct {
	ID          int64   `json:"id"`
	OrderID     int64   `json:"order_id"`
	ProductID   int64   `json:"product_id"`
	Qty         int     `json:"qty"`
	UnitPrice   float64 `json:"unit_price"`
	ProductName string  `json:"product_name"`
	ProductSKU  string  `json:"product_sku"`
}

type Order struct {
	ID              int64       `json:"id"`
	OrderNumber     string      `json:"order_number"`
	Status          string      `json:"status"`
	UserID          *int64      `json:"user_id,omitempty"`
	CustomerName    string      `json:"customer_name"`
	CustomerPhone   string      `json:"customer_phone"`
	CustomerAddress string      `json:"customer_address"`
	Note            string      `json:"note"`
	Items           []OrderItem `json:"items,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type PlaceOrderLine struct {
	ProductID int64 `json:"product_id"`
	Qty       int   `json:"qty"`
}

type PlaceOrderInput struct {
	CustomerName    string           `json:"customer_name"`
	CustomerPhone   string           `json:"customer_phone"`
	CustomerAddress string           `json:"customer_address"`
	Note            string           `json:"note"`
	Lines           []PlaceOrderLine `json:"lines"`
	UserID          *int64           `json:"-"`
}

type StoreSettings struct {
	ContactAddress string `json:"contact_address"`
	ContactPhone   string `json:"contact_phone"`
	WhatsAppURL    string `json:"whatsapp_url"`
	MapEmbedURL    string `json:"map_embed_url"`
}

type ProductListFilter struct {
	CategoryID *int64
	BrandID    *int64
	MinPrice   *float64
	MaxPrice   *float64
	Query      string
	Sort       string
	IncludeHidden bool
}
