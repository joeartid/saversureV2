package fulfillment

import (
	"strings"
	"testing"
)

func TestBuildDeliveryNotesPDFRequiresItems(t *testing.T) {
	t.Parallel()

	_, err := BuildDeliveryNotesPDF(nil)
	if err == nil {
		t.Fatal("expected error for empty item list")
	}
}

func TestBuildDeliveryNotesPDFIncludesReservationData(t *testing.T) {
	t.Parallel()

	rewardName := "Starter Box"
	recipientName := "Alice"
	recipientPhone := "0812345678"
	addressLine1 := "123 Example Road"
	province := "Bangkok"
	postalCode := "10110"
	couponCode := `ABC\(123\)`
	confirmedAt := "2026-03-23T10:00:00Z"
	trackingNumber := "TRACK123"
	deliveryType := "shipping"

	pdfBytes, err := BuildDeliveryNotesPDF([]FulfillmentItem{
		{
			ID:                "reservation-001",
			RewardName:        &rewardName,
			RecipientName:     &recipientName,
			RecipientPhone:    &recipientPhone,
			AddressLine1:      &addressLine1,
			Province:          &province,
			PostalCode:        &postalCode,
			CouponCode:        &couponCode,
			ConfirmedAt:       &confirmedAt,
			TrackingNumber:    &trackingNumber,
			DeliveryType:      &deliveryType,
			FulfillmentStatus: "pending",
		},
	})
	if err != nil {
		t.Fatalf("BuildDeliveryNotesPDF returned error: %v", err)
	}

	pdfContent := string(pdfBytes)
	if !strings.HasPrefix(pdfContent, "%PDF-1.4") {
		t.Fatalf("expected PDF header, got %q", pdfContent[:8])
	}
	for _, want := range []string{
		"Delivery Note",
		"Starter Box",
		"reservation-001",
		"Alice",
		"TRACK123",
		"ABC\\\\\\(123\\\\\\)",
	} {
		if !strings.Contains(pdfContent, want) {
			t.Fatalf("expected PDF content to contain %q", want)
		}
	}
}
