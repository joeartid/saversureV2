package hmac

import (
	"strings"
	"testing"
)

func TestSignVerify(t *testing.T) {
	signer := NewSigner("test-secret-key-123")

	data := "JH-12345"
	sig := signer.Sign(data)
	if sig == "" {
		t.Fatal("Sign returned empty string")
	}
	if !signer.Verify(data, sig) {
		t.Error("Verify failed for valid signature")
	}
	if signer.Verify(data, "invalid-sig") {
		t.Error("Verify passed for invalid signature")
	}
	if signer.Verify("wrong-data", sig) {
		t.Error("Verify passed for wrong data")
	}
}

func TestSignDeterministic(t *testing.T) {
	signer := NewSigner("test-secret")
	sig1 := signer.Sign("data")
	sig2 := signer.Sign("data")
	if sig1 != sig2 {
		t.Error("Sign is not deterministic")
	}
}

func TestSignDifferentSecrets(t *testing.T) {
	s1 := NewSigner("secret-a")
	s2 := NewSigner("secret-b")
	sig1 := s1.Sign("data")
	sig2 := s2.Sign("data")
	if sig1 == sig2 {
		t.Error("Different secrets produced same signature")
	}
}

func TestSignDifferentData(t *testing.T) {
	signer := NewSigner("test-secret")
	sig1 := signer.Sign("data-1")
	sig2 := signer.Sign("data-2")
	if sig1 == sig2 {
		t.Error("Different data produced same signature")
	}
}

func TestGenerateCode(t *testing.T) {
	signer := NewSigner("test-secret")
	code := signer.GenerateCode("JH", 12345)

	if !strings.HasPrefix(code, "JH-12345-") {
		t.Errorf("GenerateCode = %q, want prefix JH-12345-", code)
	}

	parts := strings.Split(code, "-")
	if len(parts) != 3 {
		t.Fatalf("Expected 3 parts, got %d: %q", len(parts), code)
	}
	if len(parts[2]) != 8 {
		t.Errorf("HMAC suffix length = %d, want 8", len(parts[2]))
	}
}

func TestGenerateCodeDifferentSerials(t *testing.T) {
	signer := NewSigner("test-secret")
	code1 := signer.GenerateCode("JH", 1)
	code2 := signer.GenerateCode("JH", 2)
	if code1 == code2 {
		t.Error("Different serials produced same code")
	}
}

func TestCompactCode(t *testing.T) {
	signer := NewSigner("test-secret")
	code := signer.GenerateCompactCode("JH", 12345, 6)

	if !strings.HasPrefix(code, "JH") {
		t.Errorf("CompactCode = %q, want prefix JH", code)
	}

	prefix, serial, valid := signer.ValidateCompactCode(code, []string{"JH"}, 6)
	if !valid {
		t.Fatal("ValidateCompactCode failed for valid code")
	}
	if prefix != "JH" {
		t.Errorf("prefix = %q, want JH", prefix)
	}
	if serial != 12345 {
		t.Errorf("serial = %d, want 12345", serial)
	}
}

func TestCompactCodeTampered(t *testing.T) {
	signer := NewSigner("test-secret")
	code := signer.GenerateCompactCode("JH", 12345, 6)

	tampered := code[:len(code)-1] + "X"
	_, _, valid := signer.ValidateCompactCode(tampered, []string{"JH"}, 6)
	if valid {
		t.Error("ValidateCompactCode passed for tampered code")
	}
}

func TestCompactCodeMultiplePrefixes(t *testing.T) {
	signer := NewSigner("test-secret")
	codeA := signer.GenerateCompactCode("JH", 100, 6)
	codeB := signer.GenerateCompactCode("BR", 200, 6)

	prefixes := []string{"JH", "BR", "C3"}

	p, s, v := signer.ValidateCompactCode(codeA, prefixes, 6)
	if !v || p != "JH" || s != 100 {
		t.Errorf("CodeA: prefix=%q, serial=%d, valid=%v", p, s, v)
	}

	p, s, v = signer.ValidateCompactCode(codeB, prefixes, 6)
	if !v || p != "BR" || s != 200 {
		t.Errorf("CodeB: prefix=%q, serial=%d, valid=%v", p, s, v)
	}
}

func TestCompactCodeWrongPrefix(t *testing.T) {
	signer := NewSigner("test-secret")
	code := signer.GenerateCompactCode("JH", 100, 6)

	_, _, valid := signer.ValidateCompactCode(code, []string{"BR", "C3"}, 6)
	if valid {
		t.Error("ValidateCompactCode passed for wrong prefix")
	}
}

func TestCompactCodeDifferentHMACLengths(t *testing.T) {
	signer := NewSigner("test-secret")

	for _, hmacLen := range []int{4, 6, 8, 10} {
		code := signer.GenerateCompactCode("JH", 5000, hmacLen)
		_, serial, valid := signer.ValidateCompactCode(code, []string{"JH"}, hmacLen)
		if !valid {
			t.Errorf("hmacLen=%d: validation failed", hmacLen)
		}
		if serial != 5000 {
			t.Errorf("hmacLen=%d: serial=%d, want 5000", hmacLen, serial)
		}
	}
}

func TestBase62Roundtrip(t *testing.T) {
	tests := []uint64{0, 1, 61, 62, 100, 999, 123456789, 9999999999}
	for _, n := range tests {
		encoded := Base62Encode(n)
		decoded, ok := Base62Decode(encoded)
		if !ok {
			t.Errorf("Base62Decode(%q) failed for input %d", encoded, n)
			continue
		}
		if decoded != n {
			t.Errorf("Base62 roundtrip: %d → %q → %d", n, encoded, decoded)
		}
	}
}

func TestBase62DecodeInvalid(t *testing.T) {
	_, ok := Base62Decode("invalid@char")
	if ok {
		t.Error("Base62Decode should fail for invalid chars")
	}
}

func TestCompactCodeLargeSerials(t *testing.T) {
	signer := NewSigner("production-secret")

	serials := []int64{1, 1000, 50000, 999999, 10000000}
	for _, s := range serials {
		code := signer.GenerateCompactCode("JH", s, 6)
		_, decoded, valid := signer.ValidateCompactCode(code, []string{"JH"}, 6)
		if !valid {
			t.Errorf("serial=%d: validation failed for code %q", s, code)
		}
		if decoded != s {
			t.Errorf("serial=%d: decoded=%d", s, decoded)
		}
	}
}
