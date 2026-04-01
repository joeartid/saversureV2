package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash, _ := bcrypt.GenerateFromPassword([]byte("Admin@1234"), bcrypt.DefaultCost)
	conn, err := pgx.Connect(context.Background(), "postgres://saversure_app:julaherb789@localhost:15433/saversure?sslmode=disable")
	if err != nil {
		fmt.Println("connect error:", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())
	_, err = conn.Exec(context.Background(), "UPDATE users SET password_hash = $1 WHERE email = 'admin@saversure.com'", string(hash))
	if err != nil {
		fmt.Println("update error:", err)
		os.Exit(1)
	}
	fmt.Println("Password updated to Admin@1234")
}
