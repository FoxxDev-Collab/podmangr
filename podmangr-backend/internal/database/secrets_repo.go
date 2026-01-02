package database

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"podmangr-backend/internal/models"
)

// SecretsRepo handles database operations for secrets
type SecretsRepo struct {
	db *sql.DB
}

// NewSecretsRepo creates a new secrets repository
func NewSecretsRepo() *SecretsRepo {
	return &SecretsRepo{db: DB}
}

// Create creates a new secret
func (r *SecretsRepo) Create(s *models.Secret) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()

	_, err := r.db.Exec(`
		INSERT INTO secrets (id, container_id, container_name, name, value_encrypted, secret_type, category, description, metadata, created_at, updated_at, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.ContainerID, s.ContainerName, s.Name, s.ValueEncrypted, s.SecretType, s.Category, s.Description, s.Metadata, s.CreatedAt, s.UpdatedAt, s.CreatedBy)

	return err
}

// GetByID retrieves a secret by ID
func (r *SecretsRepo) GetByID(id string) (*models.Secret, error) {
	s := &models.Secret{}
	err := r.db.QueryRow(`
		SELECT id, container_id, container_name, name, value_encrypted, secret_type, category, description, metadata, created_at, updated_at, created_by
		FROM secrets WHERE id = ?
	`, id).Scan(&s.ID, &s.ContainerID, &s.ContainerName, &s.Name, &s.ValueEncrypted, &s.SecretType, &s.Category, &s.Description, &s.Metadata, &s.CreatedAt, &s.UpdatedAt, &s.CreatedBy)

	if err != nil {
		return nil, err
	}
	return s, nil
}

// List returns all secrets (without values)
func (r *SecretsRepo) List() ([]models.SecretListItem, error) {
	rows, err := r.db.Query(`
		SELECT id, container_id, container_name, name, secret_type, category, description, created_at
		FROM secrets
		ORDER BY container_name, category, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.SecretListItem
	for rows.Next() {
		var s models.SecretListItem
		if err := rows.Scan(&s.ID, &s.ContainerID, &s.ContainerName, &s.Name, &s.SecretType, &s.Category, &s.Description, &s.CreatedAt); err != nil {
			return nil, err
		}
		secrets = append(secrets, s)
	}

	return secrets, rows.Err()
}

// ListByContainerID returns secrets for a specific container
func (r *SecretsRepo) ListByContainerID(containerID string) ([]models.SecretListItem, error) {
	rows, err := r.db.Query(`
		SELECT id, container_id, container_name, name, secret_type, category, description, created_at
		FROM secrets
		WHERE container_id = ?
		ORDER BY category, name
	`, containerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.SecretListItem
	for rows.Next() {
		var s models.SecretListItem
		if err := rows.Scan(&s.ID, &s.ContainerID, &s.ContainerName, &s.Name, &s.SecretType, &s.Category, &s.Description, &s.CreatedAt); err != nil {
			return nil, err
		}
		secrets = append(secrets, s)
	}

	return secrets, rows.Err()
}

// ListByContainerName returns secrets for a specific container by name
func (r *SecretsRepo) ListByContainerName(containerName string) ([]models.SecretListItem, error) {
	rows, err := r.db.Query(`
		SELECT id, container_id, container_name, name, secret_type, category, description, created_at
		FROM secrets
		WHERE container_name = ?
		ORDER BY category, name
	`, containerName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.SecretListItem
	for rows.Next() {
		var s models.SecretListItem
		if err := rows.Scan(&s.ID, &s.ContainerID, &s.ContainerName, &s.Name, &s.SecretType, &s.Category, &s.Description, &s.CreatedAt); err != nil {
			return nil, err
		}
		secrets = append(secrets, s)
	}

	return secrets, rows.Err()
}

// ListByCategory returns secrets in a specific category
func (r *SecretsRepo) ListByCategory(category string) ([]models.SecretListItem, error) {
	rows, err := r.db.Query(`
		SELECT id, container_id, container_name, name, secret_type, category, description, created_at
		FROM secrets
		WHERE category = ?
		ORDER BY container_name, name
	`, category)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.SecretListItem
	for rows.Next() {
		var s models.SecretListItem
		if err := rows.Scan(&s.ID, &s.ContainerID, &s.ContainerName, &s.Name, &s.SecretType, &s.Category, &s.Description, &s.CreatedAt); err != nil {
			return nil, err
		}
		secrets = append(secrets, s)
	}

	return secrets, rows.Err()
}

// Update updates a secret
func (r *SecretsRepo) Update(s *models.Secret) error {
	s.UpdatedAt = time.Now()
	_, err := r.db.Exec(`
		UPDATE secrets
		SET name = ?, value_encrypted = ?, secret_type = ?, category = ?, description = ?, metadata = ?, updated_at = ?
		WHERE id = ?
	`, s.Name, s.ValueEncrypted, s.SecretType, s.Category, s.Description, s.Metadata, s.UpdatedAt, s.ID)
	return err
}

// Delete deletes a secret by ID
func (r *SecretsRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM secrets WHERE id = ?`, id)
	return err
}

// DeleteByContainerID deletes all secrets for a container
func (r *SecretsRepo) DeleteByContainerID(containerID string) error {
	_, err := r.db.Exec(`DELETE FROM secrets WHERE container_id = ?`, containerID)
	return err
}

// Exists checks if a secret with the given name exists for a container
func (r *SecretsRepo) Exists(containerID, name string) (bool, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM secrets WHERE container_id = ? AND name = ?
	`, containerID, name).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
