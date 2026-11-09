package mail

import (
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/siw-nickz/mobile-cod-estore/backend/internal/domain"
)

type Sender struct {
	Host       string
	Port       string
	User       string
	Pass       string
	FromEmail  string
	OwnerEmail string
}

func NewSender(host, port, user, pass, fromEmail, ownerEmail string) *Sender {
	if port == "" {
		port = "587"
	}
	if fromEmail == "" {
		fromEmail = user
	}
	return &Sender{
		Host:       host,
		Port:       port,
		User:       user,
		Pass:       pass,
		FromEmail:  fromEmail,
		OwnerEmail: ownerEmail,
	}
}

// NotifyNewOrder emails the owner via SMTP (e.g. Gmail). Failures are logged only.
func (s *Sender) NotifyNewOrder(order domain.Order) {
	if s.Host == "" || s.User == "" || s.Pass == "" || s.OwnerEmail == "" {
		log.Printf("mail skipped: SMTP_* or OWNER_EMAIL empty (order %s)", order.OrderNumber)
		return
	}
	pass := strings.ReplaceAll(s.Pass, " ", "")
	addr := net.JoinHostPort(s.Host, s.Port)
	subject := fmt.Sprintf("New COD order %s", order.OrderNumber)
	body := formatOrder(order)
	msg := strings.Join([]string{
		"From: " + s.FromEmail,
		"To: " + s.OwnerEmail,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	auth := smtp.PlainAuth("", s.User, pass, s.Host)
	err := sendMailTimeout(addr, auth, s.FromEmail, []string{s.OwnerEmail}, []byte(msg), 15*time.Second)
	if err != nil {
		log.Printf("mail send error (ignored): %v", err)
	}
}

func sendMailTimeout(addr string, auth smtp.Auth, from string, to []string, msg []byte, timeout time.Duration) error {
	done := make(chan error, 1)
	go func() {
		done <- smtp.SendMail(addr, auth, from, to, msg)
	}()
	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("smtp timeout after %s", timeout)
	}
}

func formatOrder(o domain.Order) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Order: %s\nStatus: %s\nName: %s\nPhone: %s\nAddress: %s\nNote: %s\n\nItems:\n",
		o.OrderNumber, o.Status, o.CustomerName, o.CustomerPhone, o.CustomerAddress, o.Note)
	for _, it := range o.Items {
		fmt.Fprintf(&b, "- %s (%s) x%d @ %.2f\n", it.ProductName, it.ProductSKU, it.Qty, it.UnitPrice)
	}
	return b.String()
}
