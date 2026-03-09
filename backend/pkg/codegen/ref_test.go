package codegen

import (
	"testing"
)

func TestGenerateRef1Numeric(t *testing.T) {
	cfg := ExportConfig{Ref1Length: 10, Ref1Format: "numeric"}

	tests := []struct {
		input    int64
		expected string
	}{
		{1, "0000000001"},
		{42, "0000000042"},
		{1000000000, "1000000000"},
		{9999999999, "9999999999"},
	}

	for _, tc := range tests {
		result := GenerateRef1(tc.input, cfg)
		if result != tc.expected {
			t.Errorf("GenerateRef1(%d) = %q, want %q", tc.input, result, tc.expected)
		}
	}
}

func TestGenerateRef1NumericRoundtrip(t *testing.T) {
	cfg := ExportConfig{Ref1Length: 10, Ref1Format: "numeric"}

	testNumbers := []int64{1, 42, 1000, 999999, 1000000000}
	for _, n := range testNumbers {
		ref1 := GenerateRef1(n, cfg)
		decoded, ok := RunningNumberFromRef1(ref1)
		if !ok {
			t.Errorf("RunningNumberFromRef1(%q) failed for input %d", ref1, n)
			continue
		}
		if decoded != n {
			t.Errorf("Numeric roundtrip: %d → %q → %d", n, ref1, decoded)
		}
	}
}

func TestGenerateRef1AlphanumericUniqueness(t *testing.T) {
	cfg := ExportConfig{Ref1Length: 10, Ref1Format: "alphanumeric"}
	seen := make(map[string]int64)

	for i := int64(1); i <= 1000; i++ {
		ref1 := GenerateRef1(i, cfg)
		if len(ref1) != 10 {
			t.Errorf("GenerateRef1(%d) length = %d, want 10", i, len(ref1))
		}
		if prev, exists := seen[ref1]; exists {
			t.Fatalf("Collision: ref1 %q produced by both %d and %d", ref1, prev, i)
		}
		seen[ref1] = i
	}
}

func TestGenerateRef1AlphanumericFormat(t *testing.T) {
	cfg := ExportConfig{Ref1Length: 10, Ref1Format: "alphanumeric"}

	ref1 := GenerateRef1(1000000000, cfg)
	if len(ref1) != 10 {
		t.Errorf("Length = %d, want 10", len(ref1))
	}
	for _, c := range ref1 {
		if !((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) {
			t.Errorf("Unexpected char %q in ref1 %q", string(c), ref1)
		}
	}
}

func TestGenerateRef2Length(t *testing.T) {
	tests := []int64{200000000000, 200010023000, 123456789012, 1, 999999999999}
	for _, n := range tests {
		result := GenerateRef2(n)
		if len(result) != 13 {
			t.Errorf("GenerateRef2(%d) length = %d, want 13", n, len(result))
		}
	}
}

func TestGenerateRef2Deterministic(t *testing.T) {
	r1 := GenerateRef2(200010023000)
	r2 := GenerateRef2(200010023000)
	if r1 != r2 {
		t.Errorf("Not deterministic: %q != %q", r1, r2)
	}
}

func TestValidateRef2Checksum(t *testing.T) {
	validNumbers := []int64{200000000000, 200010023000, 123456789012, 1, 0}
	for _, n := range validNumbers {
		ref2 := GenerateRef2(n)
		if !ValidateRef2Checksum(ref2) {
			t.Errorf("ValidateRef2Checksum(%q) = false for input %d, want true", ref2, n)
		}
	}
}

func TestValidateRef2ChecksumInvalid(t *testing.T) {
	ref2 := GenerateRef2(200000000000)

	lastDigit := ref2[12]
	var tampered string
	if lastDigit == '0' {
		tampered = ref2[:12] + "1"
	} else {
		tampered = ref2[:12] + "0"
	}

	if ValidateRef2Checksum(tampered) {
		t.Errorf("ValidateRef2Checksum(%q) = true for tampered, want false", tampered)
	}

	if ValidateRef2Checksum("short") {
		t.Error("ValidateRef2Checksum should fail for short string")
	}

	if ValidateRef2Checksum("") {
		t.Error("ValidateRef2Checksum should fail for empty string")
	}
}

func TestParseRef2(t *testing.T) {
	ref2 := GenerateRef2(200010023000)
	n, ok := ParseRef2(ref2)
	if !ok {
		t.Fatal("ParseRef2 failed")
	}
	if n != 200010023000 {
		t.Errorf("ParseRef2(%q) = %d, want 200010023000", ref2, n)
	}

	_, ok = ParseRef2("short")
	if ok {
		t.Error("ParseRef2(\"short\") should fail")
	}
}

func TestCalculateChecksum(t *testing.T) {
	// Sum of ASCII values mod 10
	// "200010023000" → 50+48+48+48+49+48+48+50+51+48+48+48 = 584 → 584%10 = 4
	result := calculateChecksum("200010023000")
	if result != "4" {
		t.Errorf("calculateChecksum(\"200010023000\") = %q, want \"4\"", result)
	}

	// "200000000000" → 50+48*11 = 50+528 = 578 → 578%10 = 8
	result2 := calculateChecksum("200000000000")
	if result2 != "8" {
		t.Errorf("calculateChecksum(\"200000000000\") = %q, want \"8\"", result2)
	}
}

func TestRef2UniqueForDifferentNumbers(t *testing.T) {
	seen := make(map[string]int64)
	for i := int64(200000000000); i < 200000001000; i++ {
		ref2 := GenerateRef2(i)
		if prev, exists := seen[ref2]; exists {
			t.Fatalf("Ref2 collision: %q from both %d and %d", ref2, prev, i)
		}
		seen[ref2] = i
	}
}

func TestBase36EncodeDecode(t *testing.T) {
	tests := []uint64{0, 1, 35, 36, 100, 999, 123456789, 18446744073709551615}

	for _, n := range tests {
		encoded := base36Encode(n)
		decoded, ok := base36Decode(encoded)
		if !ok {
			t.Errorf("base36Decode(%q) failed for input %d", encoded, n)
			continue
		}
		if decoded != n {
			t.Errorf("base36 roundtrip: %d → %q → %d", n, encoded, decoded)
		}
	}
}

func TestPadToLength(t *testing.T) {
	tests := []struct {
		s        string
		length   int
		expected string
	}{
		{"abc", 5, "00abc"},
		{"hello", 3, "hel"},
		{"123", 3, "123"},
		{"", 4, "0000"},
	}

	for _, tc := range tests {
		result := padToLength(tc.s, tc.length, '0')
		if result != tc.expected {
			t.Errorf("padToLength(%q, %d) = %q, want %q", tc.s, tc.length, result, tc.expected)
		}
	}
}
