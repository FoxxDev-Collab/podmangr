package api

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"podmangr-backend/internal/auth"
	"podmangr-backend/internal/database"
	"podmangr-backend/internal/models"
)

var secretsRepo *database.SecretsRepo
var secretsEncryption *auth.EncryptionService

// InitSecretsService initializes the secrets service
func InitSecretsService() error {
	secretsRepo = database.NewSecretsRepo()
	var err error
	secretsEncryption, err = auth.GetEncryptionService()
	return err
}

// listSecretsHandler returns all secrets (without values)
// GET /api/secrets
func listSecretsHandler(c echo.Context) error {
	// Optional filters
	containerID := c.QueryParam("container_id")
	containerName := c.QueryParam("container_name")
	category := c.QueryParam("category")

	var secrets []models.SecretListItem
	var err error

	if containerID != "" {
		secrets, err = secretsRepo.ListByContainerID(containerID)
	} else if containerName != "" {
		secrets, err = secretsRepo.ListByContainerName(containerName)
	} else if category != "" {
		secrets, err = secretsRepo.ListByCategory(category)
	} else {
		secrets, err = secretsRepo.List()
	}

	if err != nil {
		c.Logger().Error("Failed to list secrets: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list secrets",
		})
	}

	if secrets == nil {
		secrets = []models.SecretListItem{}
	}

	return c.JSON(http.StatusOK, secrets)
}

// createSecretHandler creates a new secret
// POST /api/secrets
func createSecretHandler(c echo.Context) error {
	var req models.CreateSecretRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret name is required",
		})
	}
	if req.Value == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret value is required",
		})
	}

	// Set default type
	if req.SecretType == "" {
		req.SecretType = models.SecretTypePassword
	}

	// Encrypt the value
	encrypted, err := secretsEncryption.Encrypt(req.Value)
	if err != nil {
		c.Logger().Error("Failed to encrypt secret: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to encrypt secret",
		})
	}

	// Get user ID
	var userID *int64
	if user, ok := c.Get("user").(*models.User); ok && user != nil {
		userID = &user.ID
	}

	secret := &models.Secret{
		ContainerID:    req.ContainerID,
		ContainerName:  req.ContainerName,
		Name:           req.Name,
		ValueEncrypted: encrypted,
		SecretType:     req.SecretType,
		Category:       req.Category,
		Description:    req.Description,
		Metadata:       req.Metadata,
		CreatedBy:      userID,
	}

	if err := secretsRepo.Create(secret); err != nil {
		c.Logger().Error("Failed to create secret: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create secret",
		})
	}

	return c.JSON(http.StatusCreated, models.SecretListItem{
		ID:            secret.ID,
		ContainerID:   secret.ContainerID,
		ContainerName: secret.ContainerName,
		Name:          secret.Name,
		SecretType:    secret.SecretType,
		Category:      secret.Category,
		Description:   secret.Description,
		CreatedAt:     secret.CreatedAt,
	})
}

// getSecretHandler returns a secret by ID (without value by default)
// GET /api/secrets/:id
func getSecretHandler(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret ID is required",
		})
	}

	secret, err := secretsRepo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Secret not found",
		})
	}

	return c.JSON(http.StatusOK, models.SecretListItem{
		ID:            secret.ID,
		ContainerID:   secret.ContainerID,
		ContainerName: secret.ContainerName,
		Name:          secret.Name,
		SecretType:    secret.SecretType,
		Category:      secret.Category,
		Description:   secret.Description,
		CreatedAt:     secret.CreatedAt,
	})
}

// revealSecretHandler returns a secret with its decrypted value
// GET /api/secrets/:id/reveal
func revealSecretHandler(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret ID is required",
		})
	}

	secret, err := secretsRepo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Secret not found",
		})
	}

	// Decrypt the value
	value, err := secretsEncryption.Decrypt(secret.ValueEncrypted)
	if err != nil {
		c.Logger().Error("Failed to decrypt secret: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to decrypt secret",
		})
	}

	return c.JSON(http.StatusOK, models.SecretWithValue{
		Secret: *secret,
		Value:  value,
	})
}

// updateSecretHandler updates a secret
// PUT /api/secrets/:id
func updateSecretHandler(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret ID is required",
		})
	}

	secret, err := secretsRepo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Secret not found",
		})
	}

	var req models.UpdateSecretRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	// Update fields if provided
	if req.Name != nil {
		secret.Name = *req.Name
	}
	if req.Value != nil {
		encrypted, err := secretsEncryption.Encrypt(*req.Value)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to encrypt secret",
			})
		}
		secret.ValueEncrypted = encrypted
	}
	if req.SecretType != nil {
		secret.SecretType = *req.SecretType
	}
	if req.Category != nil {
		secret.Category = req.Category
	}
	if req.Description != nil {
		secret.Description = req.Description
	}
	if req.Metadata != nil {
		secret.Metadata = req.Metadata
	}

	if err := secretsRepo.Update(secret); err != nil {
		c.Logger().Error("Failed to update secret: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update secret",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Secret updated successfully",
	})
}

// deleteSecretHandler deletes a secret
// DELETE /api/secrets/:id
func deleteSecretHandler(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Secret ID is required",
		})
	}

	if err := secretsRepo.Delete(id); err != nil {
		c.Logger().Error("Failed to delete secret: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete secret",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Secret deleted successfully",
	})
}
