package domain

import (
	"strings"
	"testing"
)

func TestParseElectronicsCSV_SkipsNonElectronics(t *testing.T) {
	csv := `sku,barcode,name,category,brand,variant,description,buy_price (idr),sell price (idr),margin %,stock,Berat (gr),Panjang (cm),Lebar (cm),Tinggi (cm),Kondisi,Status Upload,URL Gambar Utama
ELK-TWS-001,899,Earphone,Elektronik,SoundMax,Hitam,desc,"145,000","249,000",41.8%,45,180,10,8,4,Baru,Aktif,
FSH-KMJ-004,899,Kemeja,Fashion Pria,Arunika,Navy,desc,"85,000","159,000",46.5%,60,300,28,22,2,Baru,Aktif,
`
	products, err := ParseElectronicsCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	if len(products) != 1 {
		t.Fatalf("want 1 electronics product, got %d", len(products))
	}
	if products[0].SKU != "ELK-TWS-001" {
		t.Fatalf("sku=%s", products[0].SKU)
	}
	if products[0].SellPrice != 249000 {
		t.Fatalf("sell=%v", products[0].SellPrice)
	}
}
