package models

import "time"

// SecretType represents the type of secret
type SecretType string

const (
	SecretTypePassword         SecretType = "password"
	SecretTypeAPIKey           SecretType = "api_key"
	SecretTypeConnectionString SecretType = "connection_string"
	SecretTypeEnvVar           SecretType = "env_var"
	SecretTypeCertificate      SecretType = "certificate"
	SecretTypeOther            SecretType = "other"
)

// Secret represents an encrypted secret stored in the system
type Secret struct {
	ID             string     `json:"id"`
	ContainerID    *string    `json:"container_id,omitempty"`    // Optional container reference
	ContainerName  *string    `json:"container_name,omitempty"`  // For display purposes
	Name           string     `json:"name"`                      // Human-readable name
	ValueEncrypted string     `json:"-"`                         // Never expose encrypted value
	SecretType     SecretType `json:"secret_type"`
	Category       *string    `json:"category,omitempty"`        // Grouping category
	Description    *string    `json:"description,omitempty"`
	Metadata       *string    `json:"metadata,omitempty"`        // JSON metadata
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	CreatedBy      *int64     `json:"created_by,omitempty"`
}

// SecretListItem is a lightweight view for listing secrets (no value)
type SecretListItem struct {
	ID            string     `json:"id"`
	ContainerID   *string    `json:"container_id,omitempty"`
	ContainerName *string    `json:"container_name,omitempty"`
	Name          string     `json:"name"`
	SecretType    SecretType `json:"secret_type"`
	Category      *string    `json:"category,omitempty"`
	Description   *string    `json:"description,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// SecretWithValue includes the decrypted value (only returned on specific request)
type SecretWithValue struct {
	Secret
	Value string `json:"value"` // Decrypted value
}

// CreateSecretRequest represents the request to create a secret
type CreateSecretRequest struct {
	ContainerID   *string    `json:"container_id,omitempty"`
	ContainerName *string    `json:"container_name,omitempty"`
	Name          string     `json:"name" validate:"required,min=1,max=255"`
	Value         string     `json:"value" validate:"required"`
	SecretType    SecretType `json:"secret_type,omitempty"`
	Category      *string    `json:"category,omitempty"`
	Description   *string    `json:"description,omitempty"`
	Metadata      *string    `json:"metadata,omitempty"`
}

// UpdateSecretRequest represents the request to update a secret
type UpdateSecretRequest struct {
	Name        *string    `json:"name,omitempty"`
	Value       *string    `json:"value,omitempty"`
	SecretType  *SecretType `json:"secret_type,omitempty"`
	Category    *string    `json:"category,omitempty"`
	Description *string    `json:"description,omitempty"`
	Metadata    *string    `json:"metadata,omitempty"`
}
