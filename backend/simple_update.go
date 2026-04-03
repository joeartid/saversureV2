package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()

	// Connect to database
	dbURL := "postgres://saversure_app:julaherb789@192.168.0.60:5433/saversure?sslmode=disable"

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("DB Error: %v", err)
	}
	defer db.Close()

	fmt.Println("=== อัพเดทข้อมูล Fulfillment (Simple Version) ===\n")

	userID := "6337553b-69cc-44ce-a42e-f263ddd47b46"

	// อัพเดทแต่ละรายการ
	updates := []struct {
		ID             string
		RewardName     string
		Status         string
		TrackingNumber string
	}{
		{"e394abb3-4433-4d15-a199-496a54a85623", "ผ้าห่มนาโน พรีเมียม", "shipped", "TH123456789"},
		{"d09d94f2-1d02-42b5-b123-2f96fede87bb", "ผ้าห่มนาโน พรีเมียม", "preparing", "TH987654321"},
		{"31b891f0-75e5-44bf-90d6-ad727b8197ea", "เซรั่มมะรุม", "delivered", "TH555666777"},
	}

	for _, update := range updates {
		fmt.Printf("🔄 อัพเดท: %s\n", update.RewardName)

		// Simple update
		query := `UPDATE reward_reservations 
			SET fulfillment_status = $1, tracking_number = $2 
			WHERE id = $3 AND user_id = $4`

		_, err := db.Exec(ctx, query, update.Status, update.TrackingNumber, update.ID, userID)

		if err != nil {
			fmt.Printf("   ❌ ผิดพลาด: %v\n", err)
		} else {
			fmt.Printf("   ✅ อัพเดตสำเร็จ!\n")
		}
		fmt.Println()
	}

	// ตรวจสอบผลลัพธ์
	fmt.Println("=== ตรวจสอบผลลัพธ์ ===")

	checkQuery := `
		SELECT 
			rr.id,
			r.name as reward_name,
			rr.fulfillment_status,
			rr.tracking_number,
			rr.created_at
		FROM reward_reservations rr
		LEFT JOIN rewards r ON r.id = rr.reward_id
		WHERE rr.user_id = $1 AND rr.delivery_type = 'shipping'
		ORDER BY rr.created_at DESC
	`

	rows, err := db.Query(ctx, checkQuery, userID)
	if err != nil {
		log.Fatalf("ตรวจสอบผิดพลาด: %v", err)
	}
	defer rows.Close()

	fmt.Printf("\n📊 ข้อมูลล่าสุดของ ฉัตรธิดา:\n")
	for rows.Next() {
		var id, rewardName, fulfillmentStatus, trackingNumber string
		var createdAt time.Time

		err := rows.Scan(&id, &rewardName, &fulfillmentStatus, &trackingNumber, &createdAt)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		fmt.Printf("\n🎁 %s\n", rewardName)
		fmt.Printf("   📦 สถานะ: %s\n", getFulfillmentStatusText(fulfillmentStatus))
		fmt.Printf("   🔍 เลขพัสดุ: %s\n", trackingNumber)
	}

	fmt.Println("\n🎉 เสร็จสิ้น! กรุณารีเฟรชหน้า http://localhost:30403/history/redeems")
}

func getFulfillmentStatusText(status string) string {
	switch status {
	case "pending":
		return "รับเรื่องแล้ว"
	case "preparing":
		return "กำลังเตรียมจัดส่ง"
	case "shipped":
		return "กำลังจัดส่ง"
	case "delivered":
		return "จัดส่งสำเร็จ"
	default:
		return status
	}
}
