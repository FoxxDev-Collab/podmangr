package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"

	"golang.org/x/crypto/argon2"
)

var (
	// ErrInvalidCiphertext indicates the ciphertext is malformed
	ErrInvalidCiphertext = errors.New("invalid ciphertext")

	// Global encryption service instance
	encryptionService     *EncryptionService
	encryptionServiceOnce sync.Once
)

// EncryptionService handles AES-256-GCM encryption for database credentials
type EncryptionService struct {
	key []byte
}

// GetEncryptionService returns the singleton encryption service instance
// It initializes the service on first call using PODMANGR_ENCRYPTION_KEY env var
// or generates a new key if not set
func GetEncryptionService() (*EncryptionService, error) {
	var initErr error
	encryptionServiceOnce.Do(func() {
		encryptionService, initErr = NewEncryptionService()
	})
	if initErr != nil {
		return nil, initErr
	}
	return encryptionService, nil
}

// NewEncryptionService creates a new encryption service
// Key is derived from PODMANGR_ENCRYPTION_KEY environment variable
// If not set, generates and persists a random key to .podmangr_key file
func NewEncryptionService() (*EncryptionService, error) {
	keyStr := os.Getenv("PODMANGR_ENCRYPTION_KEY")

	var key []byte
	if keyStr == "" {
		// Try to load key from file first
		keyFile := getKeyFilePath()
		existingKey, err := os.ReadFile(keyFile)
		if err == nil && len(existingKey) == 32 {
			// Use existing key from file
			key = existingKey
			fmt.Println("INFO: Loaded encryption key from", keyFile)
		} else {
			// Generate a new key and save it
			key = make([]byte, 32)
			if _, err := rand.Read(key); err != nil {
				return nil, fmt.Errorf("failed to generate encryption key: %w", err)
			}
			// Save the key to file for persistence
			if err := os.WriteFile(keyFile, key, 0600); err != nil {
				fmt.Printf("WARNING: Could not save encryption key to %s: %v\n", keyFile, err)
				fmt.Println("WARNING: Encrypted data may be lost on restart!")
			} else {
				fmt.Println("INFO: Generated and saved new encryption key to", keyFile)
			}
		}
	} else {
		// Derive a 32-byte key from the provided string using Argon2
		// Using a fixed salt is acceptable here since we're not storing hashes
		// but deriving an encryption key from a master secret
		salt := []byte("podmangr-encryption-salt-v1")
		key = argon2.IDKey([]byte(keyStr), salt, 1, 64*1024, 4, 32)
	}

	return &EncryptionService{key: key}, nil
}

// getKeyFilePath returns the path to the encryption key file
func getKeyFilePath() string {
	// Try to use the same directory as the database
	// Fall back to current directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".podmangr_key"
	}
	return homeDir + "/.podmangr_key"
}

// Encrypt encrypts plaintext using AES-256-GCM
// Returns base64-encoded ciphertext
func (e *EncryptionService) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Create a nonce (number used once)
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt and prepend nonce to ciphertext
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext using AES-256-GCM
// Returns the original plaintext
func (e *EncryptionService) Decrypt(encryptedText string) (string, error) {
	if encryptedText == "" {
		return "", nil
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedText)
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", ErrInvalidCiphertext
	}

	// Extract nonce and actual ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// GeneratePassword creates a cryptographically secure random password
// Length should be at least 16 for security
func GeneratePassword(length int) (string, error) {
	if length < 8 {
		length = 16
	}

	// Character set for passwords (alphanumeric + some special chars)
	// Avoiding characters that might cause issues in connection strings: @, /, :, ?
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%^&*()-_=+"

	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}

	return string(b), nil
}

// GenerateUsername creates a database-safe username
// Uses lowercase letters and numbers only
func GenerateUsername(prefix string, length int) (string, error) {
	if length < 4 {
		length = 8
	}

	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"

	suffix := make([]byte, length)
	if _, err := rand.Read(suffix); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	for i := range suffix {
		suffix[i] = charset[int(suffix[i])%len(charset)]
	}

	if prefix == "" {
		prefix = "db"
	}

	return prefix + "_" + string(suffix), nil
}

// HashForStorage creates a one-way hash of a value (useful for key verification)
func HashForStorage(value string) string {
	hash := sha256.Sum256([]byte(value))
	return base64.StdEncoding.EncodeToString(hash[:])
}
