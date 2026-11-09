package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/cloudinary"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/config"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/delivery/http/handler"
	authmw "github.com/siw-nickz/mobile-cod-estore/backend/internal/delivery/http/middleware"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/mail"
	"github.com/siw-nickz/mobile-cod-estore/backend/internal/repository"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	ctx := context.Background()

	pool, err := repository.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if err := repository.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	api := &handler.API{
		Store:            repository.NewStore(pool),
		Tokens:           authmw.NewTokenService(cfg.JWTSecret, cfg.JWTExpiry),
		Mail: mail.NewSender(
			cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPFrom, cfg.OwnerEmail,
		),
		Cloud:           cloudinary.New(cfg.CloudinaryCloud, cfg.CloudinaryKey, cfg.CloudinarySecret),
		BootstrapSecret: cfg.JWTSecret,
	}

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	origins := []string{cfg.CORSOrigin}
	if cfg.CORSOrigin == "*" {
		origins = []string{"*"}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: cfg.CORSOrigin != "*",
		MaxAge:           300,
	}))
	r.Mount("/", api.Routes())

	srv := &http.Server{Addr: ":" + cfg.HTTPPort, Handler: r}
	go func() {
		log.Printf("listening on :%s", cfg.HTTPPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
