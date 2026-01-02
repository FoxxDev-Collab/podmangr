package auth

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "testPassword123!"

	// Test hashing
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	if hash == "" {
		t.Error("HashPassword returned empty hash")
	}

	// Hash should be different from original password
	if hash == password {
		t.Error("Hash should be different from password")
	}

	// Hash should be long enough (bcrypt produces ~60 char hashes)
	if len(hash) < 50 {
		t.Errorf("Hash seems too short: %d characters", len(hash))
	}
}

func TestVerifyPassword(t *testing.T) {
	password := "testPassword123!"

	// Hash the password
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	// Test correct password
	valid, err := VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword returned error: %v", err)
	}
	if !valid {
		t.Error("VerifyPassword should return true for correct password")
	}

	// Test incorrect password
	valid, _ = VerifyPassword("wrongPassword", hash)
	if valid {
		t.Error("VerifyPassword should return false for incorrect password")
	}

	// Test empty password
	valid, _ = VerifyPassword("", hash)
	if valid {
		t.Error("VerifyPassword should return false for empty password")
	}

	// Test empty hash - should return error
	_, err = VerifyPassword(password, "")
	if err == nil {
		t.Error("VerifyPassword should return error for empty hash")
	}
}

func TestHashUniqueness(t *testing.T) {
	password := "samePassword"

	// Hash the same password twice
	hash1, err := HashPassword(password)
	if err != nil {
		t.Fatalf("First HashPassword returned error: %v", err)
	}

	hash2, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Second HashPassword returned error: %v", err)
	}

	// Hashes should be different due to salt
	if hash1 == hash2 {
		t.Error("Hashes should be different due to salt")
	}

	// Both should still validate
	valid, _ := VerifyPassword(password, hash1)
	if !valid {
		t.Error("First hash should validate")
	}

	valid, _ = VerifyPassword(password, hash2)
	if !valid {
		t.Error("Second hash should validate")
	}
}

func TestSpecialCharacterPasswords(t *testing.T) {
	passwords := []string{
		"simple",
		"With Spaces",
		"With\tTab",
		"With\nNewline",
		"Spëcîäl©hàrs",
		"日本語パスワード",
		"<script>alert('xss')</script>",
		"'; DROP TABLE users;--",
	}

	for _, password := range passwords {
		t.Run(password, func(t *testing.T) {
			hash, err := HashPassword(password)
			if err != nil {
				t.Fatalf("HashPassword returned error for '%s': %v", password, err)
			}

			valid, err := VerifyPassword(password, hash)
			if err != nil {
				t.Fatalf("VerifyPassword returned error for '%s': %v", password, err)
			}
			if !valid {
				t.Errorf("VerifyPassword should return true for password: %s", password)
			}
		})
	}
}

func TestEmptyPassword(t *testing.T) {
	// Hashing empty password should work (user validation happens elsewhere)
	hash, err := HashPassword("")
	if err != nil {
		t.Fatalf("HashPassword returned error for empty password: %v", err)
	}

	valid, err := VerifyPassword("", hash)
	if err != nil {
		t.Fatalf("VerifyPassword returned error: %v", err)
	}
	if !valid {
		t.Error("VerifyPassword should return true for empty password")
	}
}

func TestLongPassword(t *testing.T) {
	// Argon2 handles long passwords well (no 72 byte limit like bcrypt)
	longPassword := "a"

	for i := 0; i < 100; i++ {
		longPassword += "abcdefghij"
	}

	// This should work with Argon2
	hash, err := HashPassword(longPassword)
	if err != nil {
		t.Fatalf("HashPassword returned error for long password: %v", err)
	}

	// Should validate
	valid, err := VerifyPassword(longPassword, hash)
	if err != nil {
		t.Fatalf("VerifyPassword returned error: %v", err)
	}
	if !valid {
		t.Error("VerifyPassword should validate long password")
	}
}
