package codegen

import (
	"math/big"
	"strconv"
	"strings"
)

// ExportRecord represents one row for batch export (CSV for printer)
type ExportRecord struct {
	SerialNumber int64  `json:"serial_number"`
	Code         string `json:"code"`   // full HMAC-signed code
	Ref1         string `json:"ref1"`   // customer-facing (manual entry)
	Ref2         string `json:"ref2"`   // QC-facing (visible on sticker)
	URL          string `json:"url"`    // full scan URL
	LotNumber    string `json:"lot_number"`
}

// GenerateRef1 creates ref1 from running number.
// - numeric: เลขรันนิ่งธรรมดา (เดาสุ่มได้)
// - alphanumeric: เข้ารหัสเป็นตัวอักษร+ตัวเลข ป้องกันการเดาสุ่ม
func GenerateRef1(runningNumber int64, cfg ExportConfig) string {
	if cfg.Ref1Format == "alphanumeric" {
		return GenerateRef1Alphanumeric(runningNumber, cfg.Ref1Length)
	}
	s := strconv.FormatInt(runningNumber, 10)
	return padToLength(s, cfg.Ref1Length, '0')
}

// GenerateRef2 creates a 13-digit ref2 from a running number: 12 digits + 1 checksum.
// The running number is tenant-level, starting at 200000000000.
func GenerateRef2(runningNumber int64) string {
	data := padToLength(strconv.FormatInt(runningNumber, 10), 12, '0')
	return data + calculateChecksum(data)
}

// ParseRef2 extracts the running number from a 13-digit ref2 string.
func ParseRef2(ref2 string) (runningNumber int64, ok bool) {
	if len(ref2) != 13 {
		return 0, false
	}
	n, err := strconv.ParseInt(ref2[:12], 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

// ValidateRef2Checksum returns true if ref2 (13 digits) has valid checksum.
func ValidateRef2Checksum(ref2 string) bool {
	if len(ref2) != 13 {
		return false
	}
	data := ref2[:12]
	expected := ref2[12:]
	return calculateChecksum(data) == expected
}

// RunningNumberFromRef1 returns running number for ref1 lookup.
func RunningNumberFromRef1(ref1 string) (int64, bool) {
	ref1 = strings.TrimSpace(ref1)
	if n, err := strconv.ParseInt(ref1, 10, 64); err == nil {
		return n, true
	}
	return RunningNumberFromRef1Alphanumeric(ref1)
}

const base36Chars = "0123456789abcdefghijklmnopqrstuvwxyz"

func pow36(n int) uint64 {
	r := uint64(1)
	for i := 0; i < n; i++ {
		r *= 36
	}
	return r
}

// LCG constants for ref1 obfuscation within base36^length space.
// mult must be coprime with 36^n (not divisible by 2 or 3).
var (
	bigMult = new(big.Int).SetUint64(6364136223846793007)
	bigAdd  = new(big.Int).SetUint64(1442695040888963407)
)

func bigMod(length int) *big.Int {
	m := big.NewInt(36)
	return new(big.Int).Exp(m, big.NewInt(int64(length)), nil)
}

func GenerateRef1Alphanumeric(runningNumber int64, length int) string {
	mod := bigMod(length)
	n := new(big.Int).SetInt64(runningNumber)
	n.Mod(n, mod)
	obf := new(big.Int).Mul(n, bigMult)
	obf.Add(obf, bigAdd)
	obf.Mod(obf, mod)
	s := strings.ToUpper(base36Encode(obf.Uint64()))
	return padToLength(s, length, rune(base36Chars[0]))
}

func RunningNumberFromRef1Alphanumeric(ref1 string) (int64, bool) {
	ref1 = strings.ToLower(strings.TrimSpace(ref1))
	origLen := len(ref1)
	if origLen < 2 {
		return 0, false
	}
	ref1 = strings.TrimLeft(ref1, string(base36Chars[0]))
	if ref1 == "" {
		return 0, false
	}
	obf, ok := base36Decode(ref1)
	if !ok {
		return 0, false
	}
	mod := bigMod(origLen)
	bigObf := new(big.Int).SetUint64(obf)
	bigObf.Sub(bigObf, bigAdd)
	bigObf.Mod(bigObf, mod)
	inv := new(big.Int).ModInverse(bigMult, mod)
	if inv == nil {
		return 0, false
	}
	n := new(big.Int).Mul(bigObf, inv)
	n.Mod(n, mod)
	return n.Int64(), true
}

func base36Encode(n uint64) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{base36Chars[n%36]}, b...)
		n /= 36
	}
	return string(b)
}

func base36Decode(s string) (uint64, bool) {
	var n uint64
	for _, c := range s {
		idx := strings.IndexRune(base36Chars, c)
		if idx < 0 {
			return 0, false
		}
		n = n*36 + uint64(idx)
	}
	return n, true
}

func padToLength(s string, length int, pad rune) string {
	if len(s) >= length {
		return s[:length]
	}
	for len(s) < length {
		s = string(pad) + s
	}
	return s
}

func calculateChecksum(data string) string {
	var sum int
	for _, c := range data {
		sum += int(c)
	}
	digits := "0123456789"
	return string(digits[sum%10])
}
