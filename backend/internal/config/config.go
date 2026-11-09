package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPPort         string
	DatabaseURL      string
	JWTSecret        string
	JWTExpiry        time.Duration
	CORSOrigin       string
	CloudinaryCloud  string
	CloudinaryKey    string
	CloudinarySecret string
	SMTPHost         string
	SMTPPort         string
	SMTPUser         string
	SMTPPass         string
	SMTPFrom         string
	OwnerEmail       string
	PublicAPIURL     string
	FrontendURL      string
}

func Load() Config {
	expiryHours := 72
	if v := os.Getenv("JWT_EXPIRY_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			expiryHours = n
		}
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return Config{
		HTTPPort:         port,
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		JWTSecret:        envOr("JWT_SECRET", "dev-change-me"),
		JWTExpiry:        time.Duration(expiryHours) * time.Hour,
		CORSOrigin:       envOr("CORS_ORIGIN", "*"),
		CloudinaryCloud:  os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryKey:    os.Getenv("CLOUDINARY_API_KEY"),
		CloudinarySecret: os.Getenv("CLOUDINARY_API_SECRET"),
		SMTPHost:         envOr("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:         envOr("SMTP_PORT", "587"),
		SMTPUser:         os.Getenv("SMTP_USER"),
		SMTPPass:         os.Getenv("SMTP_PASS"),
		SMTPFrom:         envOr("SMTP_FROM", os.Getenv("SMTP_USER")),
		OwnerEmail:       envOr("OWNER_EMAIL", os.Getenv("SMTP_USER")),
		PublicAPIURL:     os.Getenv("PUBLIC_API_URL"),
		FrontendURL:      os.Getenv("FRONTEND_URL"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
