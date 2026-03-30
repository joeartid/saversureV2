package main

import (
	"context"
	"fmt"
	"saversure/internal/ledger"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	db, err := pgxpool.New(context.Background(), "postgres://postgres:postgres@localhost:30402/saversure?sslmode=disable")
	if err != nil {
		fmt.Printf("DB Error: %v\n", err)
		return
	}
	defer db.Close()

	svc := ledger.NewService(db)
	err = svc.AwardPoints(context.Background(), "00000000-0000-0000-0000-000000000001", "6337553b-69cc-44ce-a42e-f263ddd47b46", "point", 100, "test_add_100", "เพิ่มแต้มสำหรับทดสอบ", nil)
	if err != nil {
		fmt.Printf("Add Points Error: %v\n", err)
	} else {
		fmt.Println("SUCCESS_ADD_POINTS")
	}
}
