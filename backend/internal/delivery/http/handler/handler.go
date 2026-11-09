package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/cloudinary"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/delivery/http/middleware"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/domain"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/mail"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type API struct {
	Store           *repository.Store
	Tokens          *middleware.TokenService
	Mail            *mail.Sender
	Cloud           *cloudinary.Client
	BootstrapSecret string
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (a *API) Routes() http.Handler {
	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/v1", func(r chi.Router) {
		r.Use(a.Tokens.OptionalAuth)

		r.Post("/auth/register", a.register)
		r.Post("/auth/login", a.login)
		r.Post("/admin/auth/login", a.adminLogin)
		r.Post("/admin/bootstrap", a.bootstrapAdmin)

		r.Get("/home", a.home)
		r.Get("/categories", a.categories)
		r.Get("/brands", a.brands)
		r.Get("/products", a.listProducts)
		r.Get("/products/{id}", a.getProduct)
		r.Get("/contact", a.contact)
		r.Get("/banner", a.getBanner)

		r.Post("/orders", a.placeOrder)
		r.Get("/orders/{number}", a.getOrder)

		r.Group(func(r chi.Router) {
			r.Use(a.Tokens.RequireRole(middleware.RoleAdmin))
			r.Get("/admin/orders", a.adminListOrders)
			r.Post("/admin/orders/{id}/complete", a.adminComplete)
			r.Post("/admin/orders/{id}/cancel", a.adminCancel)
			r.Put("/admin/banner", a.adminUpdateBanner)
			r.Post("/admin/products", a.adminUpsertProduct)
			r.Put("/admin/products/{id}", a.adminUpdateProductByID)
			r.Post("/admin/products/import", a.adminImportCSV)
			r.Post("/admin/upload", a.adminUpload)
			r.Get("/admin/products", a.adminListProducts)
			r.Post("/admin/categories", a.adminCreateCategory)
			r.Post("/admin/brands", a.adminCreateBrand)
		})
	})
	return r
}

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Name == "" || body.Email == "" || len(body.Password) < 6 {
		writeErr(w, http.StatusBadRequest, "name, email, password (min 6) required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "hash failed")
		return
	}
	u, err := a.Store.CreateUser(r.Context(), body.Name, body.Email, string(hash))
	if errors.Is(err, repository.ErrConflict) {
		writeErr(w, http.StatusConflict, "email already registered")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	token, err := a.Tokens.Issue(u.ID, middleware.RoleShopper)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "token failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": u})
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	u, err := a.Store.UserByEmail(r.Context(), strings.TrimSpace(strings.ToLower(body.Email)))
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) != nil {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := a.Tokens.Issue(u.ID, middleware.RoleShopper)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "token failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

func (a *API) adminLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	ad, err := a.Store.AdminByEmail(r.Context(), strings.TrimSpace(strings.ToLower(body.Email)))
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(ad.PasswordHash), []byte(body.Password)) != nil {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := a.Tokens.Issue(ad.ID, middleware.RoleAdmin)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "token failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "admin": ad})
}

func (a *API) bootstrapAdmin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Secret   string `json:"secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Secret == "" || body.Secret != a.BootstrapSecret {
		writeErr(w, http.StatusUnauthorized, "invalid bootstrap secret")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "hash failed")
		return
	}
	ad, err := a.Store.CreateAdmin(r.Context(), body.Name, strings.ToLower(strings.TrimSpace(body.Email)), string(hash))
	if errors.Is(err, repository.ErrConflict) {
		writeErr(w, http.StatusConflict, "admin exists")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"admin": ad})
}

func (a *API) home(w http.ResponseWriter, r *http.Request) {
	banner, err := a.Store.GetBanner(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	cats, err := a.Store.ListCategories(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	products, err := a.Store.ListProducts(r.Context(), domain.ProductListFilter{Sort: "newest"})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	featured := products
	if len(featured) > 8 {
		featured = featured[:8]
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"banner":     banner,
		"categories": cats,
		"featured":   featured,
	})
}

func (a *API) categories(w http.ResponseWriter, r *http.Request) {
	cats, err := a.Store.ListCategories(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cats)
}

func (a *API) brands(w http.ResponseWriter, r *http.Request) {
	brands, err := a.Store.ListBrands(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, brands)
}

func (a *API) listProducts(w http.ResponseWriter, r *http.Request) {
	f := domain.ProductListFilter{
		Query: r.URL.Query().Get("q"),
		Sort:  r.URL.Query().Get("sort"),
	}
	if v := r.URL.Query().Get("category_id"); v != "" {
		id, _ := strconv.ParseInt(v, 10, 64)
		f.CategoryID = &id
	}
	if v := r.URL.Query().Get("brand_id"); v != "" {
		id, _ := strconv.ParseInt(v, 10, 64)
		f.BrandID = &id
	}
	if v := r.URL.Query().Get("min_price"); v != "" {
		p, _ := strconv.ParseFloat(v, 64)
		f.MinPrice = &p
	}
	if v := r.URL.Query().Get("max_price"); v != "" {
		p, _ := strconv.ParseFloat(v, 64)
		f.MaxPrice = &p
	}
	products, err := a.Store.ListProducts(r.Context(), f)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func (a *API) getProduct(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	p, err := a.Store.ProductByID(r.Context(), id, false)
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "product not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *API) contact(w http.ResponseWriter, r *http.Request) {
	st, err := a.Store.GetSettings(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (a *API) getBanner(w http.ResponseWriter, r *http.Request) {
	b, err := a.Store.GetBanner(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *API) placeOrder(w http.ResponseWriter, r *http.Request) {
	var in domain.PlaceOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.CustomerName = strings.TrimSpace(in.CustomerName)
	in.CustomerPhone = strings.TrimSpace(in.CustomerPhone)
	in.CustomerAddress = strings.TrimSpace(in.CustomerAddress)
	if in.CustomerName == "" || in.CustomerPhone == "" || in.CustomerAddress == "" || len(in.Lines) == 0 {
		writeErr(w, http.StatusBadRequest, "name, phone, address, and lines required")
		return
	}
	if uid, ok := middleware.UserID(r.Context()); ok {
		role, _ := r.Context().Value(middleware.CtxRole).(string)
		if role == middleware.RoleShopper {
			in.UserID = &uid
		}
	}
	order, err := a.Store.PlaceOrder(r.Context(), in)
	if errors.Is(err, repository.ErrInsufficient) {
		writeErr(w, http.StatusConflict, "not enough stock for one or more items")
		return
	}
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "product not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	go a.Mail.NotifyNewOrder(order)
	writeJSON(w, http.StatusCreated, order)
}

func (a *API) getOrder(w http.ResponseWriter, r *http.Request) {
	o, err := a.Store.OrderByNumber(r.Context(), chi.URLParam(r, "number"))
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "order not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (a *API) adminListOrders(w http.ResponseWriter, r *http.Request) {
	orders, err := a.Store.ListOrders(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, orders)
}

func (a *API) adminComplete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	o, err := a.Store.CompleteOrder(r.Context(), id)
	if errors.Is(err, repository.ErrInvalidStatus) {
		writeErr(w, http.StatusConflict, "order not pending")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (a *API) adminCancel(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	o, err := a.Store.CancelOrder(r.Context(), id)
	if errors.Is(err, repository.ErrInvalidStatus) {
		writeErr(w, http.StatusConflict, "order not pending")
		return
	}
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "order not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (a *API) adminUpdateBanner(w http.ResponseWriter, r *http.Request) {
	var b domain.Banner
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	out, err := a.Store.UpdateBanner(r.Context(), b)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminUpsertProduct(w http.ResponseWriter, r *http.Request) {
	var p domain.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if p.CategoryName != "" {
		c, err := a.Store.EnsureCategory(r.Context(), p.CategoryName)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.CategoryID = &c.ID
	}
	if p.BrandName != "" {
		b, err := a.Store.EnsureBrand(r.Context(), p.BrandName)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.BrandID = &b.ID
	}
	out, err := a.Store.UpsertProduct(r.Context(), p, true)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminUpdateProductByID(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	existing, err := a.Store.ProductByID(r.Context(), id, true)
	if errors.Is(err, repository.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "product not found")
		return
	}
	var p domain.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	p.SKU = existing.SKU
	if p.CategoryName != "" {
		c, err := a.Store.EnsureCategory(r.Context(), p.CategoryName)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.CategoryID = &c.ID
	}
	if p.BrandName != "" {
		b, err := a.Store.EnsureBrand(r.Context(), p.BrandName)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.BrandID = &b.ID
	}
	out, err := a.Store.UpsertProduct(r.Context(), p, false)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminListProducts(w http.ResponseWriter, r *http.Request) {
	products, err := a.Store.ListProducts(r.Context(), domain.ProductListFilter{IncludeHidden: true, Sort: "newest"})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func (a *API) adminImportCSV(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()
	products, err := domain.ParseElectronicsCSV(file)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var imported []domain.Product
	for _, p := range products {
		if p.CategoryName != "" {
			c, err := a.Store.EnsureCategory(r.Context(), p.CategoryName)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			p.CategoryID = &c.ID
		}
		if p.BrandName != "" {
			b, err := a.Store.EnsureBrand(r.Context(), p.BrandName)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			p.BrandID = &b.ID
		}
		out, err := a.Store.UpsertProduct(r.Context(), p, true)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		imported = append(imported, out)
	}
	writeJSON(w, http.StatusOK, map[string]any{"imported": len(imported), "products": imported})
}

func (a *API) adminUpload(w http.ResponseWriter, r *http.Request) {
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()
	url, err := a.Cloud.Upload(hdr.Filename, file)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (a *API) adminCreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	c, err := a.Store.EnsureCategory(r.Context(), strings.TrimSpace(body.Name))
	if err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *API) adminCreateBrand(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	b, err := a.Store.EnsureBrand(r.Context(), strings.TrimSpace(body.Name))
	if err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	writeJSON(w, http.StatusOK, b)
}
