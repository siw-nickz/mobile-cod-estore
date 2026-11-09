package cloudinary

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"
)

type Client struct {
	Cloud  string
	Key    string
	Secret string
	HTTP   *http.Client
}

func New(cloud, key, secret string) *Client {
	return &Client{
		Cloud:  cloud,
		Key:    key,
		Secret: secret,
		HTTP:   &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c.Cloud != "" && c.Key != "" && c.Secret != ""
}

func (c *Client) Upload(filename string, r io.Reader) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("cloudinary not configured")
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	toSign := "timestamp=" + timestamp + c.Secret
	sum := sha1.Sum([]byte(toSign))
	signature := hex.EncodeToString(sum[:])

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("api_key", c.Key)
	_ = w.WriteField("timestamp", timestamp)
	_ = w.WriteField("signature", signature)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, r); err != nil {
		return "", err
	}
	_ = w.Close()

	url := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", c.Cloud)
	req, err := http.NewRequest(http.MethodPost, url, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("cloudinary %d: %s", resp.StatusCode, string(body))
	}
	var out struct {
		SecureURL string `json:"secure_url"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	if out.SecureURL == "" {
		return "", fmt.Errorf("cloudinary empty url")
	}
	return out.SecureURL, nil
}
