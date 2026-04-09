package fulfillment

import (
	"bytes"
	"fmt"
	"strings"
)

func BuildDeliveryNotesPDF(items []FulfillmentItem) ([]byte, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("no fulfillment items selected")
	}

	var objects []string
	objects = append(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

	var pageObjectIDs []int

	for _, item := range items {
		lines := deliveryNoteLines(item)
		content := renderPDFPage(lines)
		contentObj := fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content)
		objects = append(objects, contentObj)
		contentObjID := len(objects)

		pageObj := fmt.Sprintf("<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents %d 0 R >>", contentObjID)
		objects = append(objects, pageObj)
		pageObjectIDs = append(pageObjectIDs, len(objects))
	}

	var kids strings.Builder
	for _, id := range pageObjectIDs {
		kids.WriteString(fmt.Sprintf("%d 0 R ", id))
	}

	pagesObjID := len(objects) + 1
	catalogObjID := len(objects) + 2

	objects = append(objects, fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", kids.String(), len(pageObjectIDs)))
	objects = append(objects, fmt.Sprintf("<< /Type /Catalog /Pages %d 0 R >>", pagesObjID))

	// Fill in the real parent object id for each page object.
	for _, id := range pageObjectIDs {
		objects[id-1] = strings.Replace(objects[id-1], "/Parent 0 0 R", fmt.Sprintf("/Parent %d 0 R", pagesObjID), 1)
	}

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")

	offsets := make([]int, len(objects)+1)
	for i, obj := range objects {
		offsets[i+1] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, obj))
	}

	xrefOffset := buf.Len()
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", len(objects)+1))
	buf.WriteString("0000000000 65535 f \n")
	for i := 1; i <= len(objects); i++ {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF", len(objects)+1, catalogObjID, xrefOffset))

	return buf.Bytes(), nil
}

func deliveryNoteLines(item FulfillmentItem) []string {
	address := formatAddress(item)
	lines := []string{
		"Delivery Note",
		"Saversure Fulfillment",
		"",
		fmt.Sprintf("Reward: %s", stringOrDash(item.RewardName)),
		fmt.Sprintf("Reservation ID: %s", item.ID),
		fmt.Sprintf("Customer: %s", coalesce(item.RecipientName, item.UserName)),
		fmt.Sprintf("Phone: %s", coalesce(item.RecipientPhone, item.UserPhone)),
		fmt.Sprintf("Delivery: %s", stringOrDash(item.DeliveryType)),
		fmt.Sprintf("Status: %s", item.FulfillmentStatus),
		fmt.Sprintf("Tracking: %s", stringOrDash(item.TrackingNumber)),
		"",
		"Ship To:",
	}

	if address == "" {
		lines = append(lines, "-")
	} else {
		lines = append(lines, wrapLine(address, 72)...)
	}

	if item.CouponCode != nil && *item.CouponCode != "" {
		lines = append(lines, "", fmt.Sprintf("Coupon Code: %s", *item.CouponCode))
	}

	lines = append(lines, "", fmt.Sprintf("Confirmed At: %s", stringOrDash(item.ConfirmedAt)))
	return lines
}

func renderPDFPage(lines []string) string {
	var b strings.Builder
	y := 790

	for index, raw := range lines {
		fontSize := 11
		if index == 0 {
			fontSize = 20
		} else if index == 1 {
			fontSize = 12
		}
		line := escapePDFText(raw)
		b.WriteString(fmt.Sprintf("BT /F1 %d Tf 50 %d Td (%s) Tj ET\n", fontSize, y, line))
		if index == 0 {
			y -= 24
		} else {
			y -= 16
		}
	}

	return b.String()
}

func escapePDFText(input string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"(", "\\(",
		")", "\\)",
		"\r", " ",
		"\n", " ",
	)
	return replacer.Replace(input)
}

func formatAddress(item FulfillmentItem) string {
	return strings.TrimSpace(strings.Join(filterEmpty(
		valueOf(item.AddressLine1),
		valueOf(item.AddressLine2),
		valueOf(item.SubDistrict),
		valueOf(item.District),
		valueOf(item.Province),
		valueOf(item.PostalCode),
	), " "))
}

func wrapLine(input string, width int) []string {
	if len(input) <= width {
		return []string{input}
	}

	words := strings.Fields(input)
	if len(words) == 0 {
		return []string{input}
	}

	var lines []string
	current := words[0]
	for _, word := range words[1:] {
		if len(current)+1+len(word) > width {
			lines = append(lines, current)
			current = word
			continue
		}
		current += " " + word
	}
	lines = append(lines, current)
	return lines
}

func filterEmpty(items ...string) []string {
	var out []string
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			out = append(out, item)
		}
	}
	return out
}

func coalesce(primary, fallback *string) string {
	if primary != nil && *primary != "" {
		return *primary
	}
	if fallback != nil && *fallback != "" {
		return *fallback
	}
	return "-"
}

func stringOrDash(value *string) string {
	if value == nil || *value == "" {
		return "-"
	}
	return *value
}

func valueOf(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
