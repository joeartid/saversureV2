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

	fmt.Println("=== อัพเดทข้อมูล Fulfillment สำหรับ ฉัตรธิดา จิตโสภาพันธุ์ ===\n")

	userID := "6337553b-69cc-44ce-a42e-f263ddd47b46"

	// ข้อมูลรายการที่จะอัพเดท
	updates := []struct {
		ID                string
		RewardName        string
		FulfillmentStatus string
		TrackingNumber    string
		Courier           string
	}{
		{
			ID:                "e394abb3-4433-4d15-a199-496a54a85623",
			RewardName:        "ผ้าห่มนาโน พรีเมียม รุ่นลิมิเต็ด",
			FulfillmentStatus: "shipped",
			TrackingNumber:    "TH123456789",
			Courier:           "Kerry Express",
		},
		{
			ID:                "d09d94f2-1d02-42b5-b123-2f96fede87bb",
			RewardName:        "ผ้าห่มนาโน พรีเมียม รุ่นลิมิเต็ด",
			FulfillmentStatus: "preparing",
			TrackingNumber:    "TH987654321",
			Courier:           "Flash",
		},
		{
			ID:                "31b891f0-75e5-44bf-90d6-ad727b8197ea",
			RewardName:        "เซรั่มมะรุมเปปไทด์ ขนาดทดลอง",
			FulfillmentStatus: "delivered",
			TrackingNumber:    "TH555666777",
			Courier:           "J&T Express",
		},
	}

	for _, update := range updates {
		fmt.Printf("🔄 อัพเดท: %s\n", update.RewardName)
		fmt.Printf("   📋 ID: %s\n", update.ID)
		fmt.Printf("   📦 สถานะ: %s\n", update.FulfillmentStatus)
		fmt.Printf("   🔍 เลขพัสดุ: %s\n", update.TrackingNumber)
		fmt.Printf("   🚚 ขนส่ง: %s\n", update.Courier)

		// อัพเดตข้อมูล
		query := `
			UPDATE reward_reservations 
			SET fulfillment_status = $1,
			    tracking_number = $2,
			    shipped_at = CASE 
			        WHEN $1 = 'shipped' THEN NOW()
			        WHEN $1 = 'delivered' THEN shipped_at
			        ELSE shipped_at
			    END,
			    delivered_at = CASE 
			        WHEN $1 = 'delivered' THEN NOW()
			        ELSE delivered_at
			    END
			WHERE id = $3 AND user_id = $4
		`

		_, err := db.Exec(ctx, query,
			update.FulfillmentStatus,
			update.TrackingNumber,
			update.ID,
			userID)

		if err != nil {
			fmt.Printf("   ❌ ผิดพลาด: %v\n\n", err)
			continue
		}

		fmt.Printf("   ✅ อัพเดตสำเร็จ!\n\n")
	}

	fmt.Println("=== ตรวจสอบผลลัพธ์ ===")

	// ตรวจสอบข้อมูลที่อัพเดต
	checkQuery := `
		SELECT 
			rr.id,
			r.name as reward_name,
			rr.fulfillment_status,
			rr.tracking_number,
			rr.shipped_at,
			rr.delivered_at,
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
		var shippedAt, deliveredAt *time.Time
		var createdAt time.Time

		err := rows.Scan(&id, &rewardName, &fulfillmentStatus, &trackingNumber, &shippedAt, &deliveredAt, &createdAt)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		fmt.Printf("\n🎁 %s\n", rewardName)
		fmt.Printf("   📦 สถานะ: %s\n", getFulfillmentStatusText(fulfillmentStatus))
		fmt.Printf("   🔍 เลขพัสดุ: %s\n", trackingNumber)
		if shippedAt != nil {
			fmt.Printf("   📅 จัดส่งเมื่อ: %s\n", shippedAt.Format("2006-01-02 15:04:05"))
		}
		if deliveredAt != nil {
			fmt.Printf("   📅 จัดส่งสำเร็จ: %s\n", deliveredAt.Format("2006-01-02 15:04:05"))
		}
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
