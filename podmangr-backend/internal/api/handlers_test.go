package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestHealthCheck(t *testing.T) {
	// Setup
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	// Test
	err := healthCheck(c)
	if err != nil {
		t.Fatalf("healthCheck returned error: %v", err)
	}

	// Verify
	if rec.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%s'", response["status"])
	}
}

func TestStubAuditService(t *testing.T) {
	// Test that the stub audit service doesn't panic
	audit := &stubAuditService{}

	// Should not panic
	audit.Log(1, "testuser", "test.action", "test-target", map[string]string{"key": "value"})
	audit.Log(1, "testuser", "test.action", "test-target", nil)

	// Verify it's a no-op
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	audit.LogFromContext(c, "test.action", "test-target", nil)
}
