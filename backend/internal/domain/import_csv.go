package domain

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// ParseElectronicsCSV reads the sample sheet shape and keeps electronics rows only.
func ParseElectronicsCSV(r io.Reader) ([]Product, error) {
	cr := csv.NewReader(r)
	cr.TrimLeadingSpace = true
	rows, err := cr.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("empty csv")
	}
	header := normalizeHeader(rows[0])
	idx := map[string]int{}
	for i, h := range header {
		idx[h] = i
	}
	var out []Product
	for _, row := range rows[1:] {
		if len(row) == 0 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(row[0])), "TOTAL") {
			continue
		}
		get := func(key string) string {
			i, ok := idx[key]
			if !ok || i >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[i])
		}
		cat := get("category")
		if !isElectronicsCategory(cat) {
			continue
		}
		p := Product{
			SKU:          get("sku"),
			Barcode:      get("barcode"),
			Name:         get("name"),
			Variant:      get("variant"),
			Description:  get("description"),
			BuyPrice:     parseMoney(get("buy_price (idr)")),
			SellPrice:    parseMoney(firstNonEmpty(get("sell price (idr)"), get("sell_price (idr)"))),
			MarginPct:    parsePct(get("margin %")),
			Stock:        parseInt(get("stock")),
			WeightG:      parseInt(get("berat (gr)")),
			LengthCM:     parseFloat(get("panjang (cm)")),
			WidthCM:      parseFloat(get("lebar (cm)")),
			HeightCM:     parseFloat(get("tinggi (cm)")),
			Condition:    get("kondisi"),
			UploadStatus: get("status upload"),
			ImageURL:     get("url gambar utama"),
			Hidden:       strings.EqualFold(get("status upload"), "Arsip") || strings.EqualFold(get("status upload"), "Draft"),
		}
		// stash category/brand names in CategoryName/BrandName for importer to resolve
		p.CategoryName = cat
		p.BrandName = get("brand")
		if p.SKU == "" || p.Name == "" {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

func isElectronicsCategory(cat string) bool {
	c := strings.ToLower(strings.TrimSpace(cat))
	return c == "elektronik" || c == "electronics" || strings.Contains(c, "elektronik")
}

func normalizeHeader(h []string) []string {
	out := make([]string, len(h))
	for i, v := range h {
		out[i] = strings.ToLower(strings.TrimSpace(v))
	}
	return out
}

func parseMoney(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "\"", "")
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}

func parsePct(s string) float64 {
	s = strings.TrimSuffix(strings.TrimSpace(s), "%")
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func parseInt(s string) int {
	s = strings.ReplaceAll(s, ",", "")
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
