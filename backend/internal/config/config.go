package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	App       AppConfig
	DB        DBConfig
	Redis     RedisConfig
	NATS      NATSConfig
	JWT       JWTConfig
	MinIO     MinIOConfig
	SMS       SMSConfig
	HMAC      HMACConfig
	RateLimit RateLimitConfig
	LINE      LINEConfig
	Google    GoogleConfig
}

type LINEConfig struct {
	ChannelID     string
	ChannelSecret string
	CallbackURL   string
}

type GoogleConfig struct {
	ClientID string
}

type SMSConfig struct {
	Host     string
	Username string
	Password string
	OTCOtcID string
}

type AppConfig struct {
	Env  string
	Host string
	Port int
}

type DBConfig struct {
	Host     string
	Port     int
	Name     string
	User     string
	Password string
	SSLMode  string
	MaxConns int
	MinConns int
}

func (c DBConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode,
	)
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

func (c RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type NATSConfig struct {
	URL string
}

type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	PublicURL string
}

type HMACConfig struct {
	Secret string
}

type RateLimitConfig struct {
	Scan     int
	Redeem   int
	Transfer int
}

func Load() (*Config, error) {
	cfg := &Config{
		App: AppConfig{
			Env:  getEnv("APP_ENV", "development"),
			Host: getEnv("APP_HOST", "0.0.0.0"),
			Port: getEnvInt("APP_PORT", 30400),
		},
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			Name:     getEnv("DB_NAME", "saversure"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
			MaxConns: getEnvInt("DB_MAX_CONNS", 20),
			MinConns: getEnvInt("DB_MIN_CONNS", 5),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		NATS: NATSConfig{
			URL: getEnv("NATS_URL", "nats://localhost:4222"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", ""),
			AccessTTL:  getEnvDuration("JWT_ACCESS_TTL", 8*time.Hour),
			RefreshTTL: getEnvDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
		},
		MinIO: MinIOConfig{
			Endpoint:  getEnv("MINIO_ENDPOINT", "localhost:59300"),
			AccessKey: getEnv("MINIO_ACCESS_KEY", ""),
			SecretKey: getEnv("MINIO_SECRET_KEY", ""),
			Bucket:    getEnv("MINIO_BUCKET", "saversure-dev"),
			UseSSL:    getEnvBool("MINIO_USE_SSL", false),
			PublicURL: getEnv("MINIO_PUBLIC_URL", "http://localhost:59300"),
		},
		SMS: SMSConfig{
			Host:     getEnv("SMS_HOST", ""),
			Username: getEnv("SMS_USERNAME", ""),
			Password: getEnv("SMS_PASSWORD", ""),
			OTCOtcID: getEnv("SMS_OTP_OTC_ID", ""),
		},
		HMAC: HMACConfig{
			Secret: getEnv("HMAC_SECRET", ""),
		},
		RateLimit: RateLimitConfig{
			Scan:     getEnvInt("RATE_LIMIT_SCAN", 10),
			Redeem:   getEnvInt("RATE_LIMIT_REDEEM", 5),
			Transfer: getEnvInt("RATE_LIMIT_TRANSFER", 3),
		},
		LINE: LINEConfig{
			ChannelID:     getEnv("LINE_CHANNEL_ID", ""),
			ChannelSecret: getEnv("LINE_CHANNEL_SECRET", ""),
			CallbackURL:   getEnv("LINE_CALLBACK_URL", "http://localhost:30403/auth/line/callback"),
		},
		Google: GoogleConfig{
			ClientID: getEnv("GOOGLE_CLIENT_ID", ""),
		},
	}

	if cfg.DB.Password == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required")
	}
	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func (c *Config) ListenAddr() string {
	return fmt.Sprintf("%s:%d", c.App.Host, c.App.Port)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
