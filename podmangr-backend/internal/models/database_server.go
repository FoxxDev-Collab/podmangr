package models

import "time"

// DatabaseEngine represents the type of database engine
type DatabaseEngine string

const (
	EnginePostgreSQL DatabaseEngine = "postgresql"
	EngineMariaDB    DatabaseEngine = "mariadb"
	EngineMySQL      DatabaseEngine = "mysql"
)

// DatabaseServerStatus represents the state of a database server container
type DatabaseServerStatus string

const (
	DatabaseServerStatusRunning  DatabaseServerStatus = "running"
	DatabaseServerStatusStopped  DatabaseServerStatus = "stopped"
	DatabaseServerStatusStarting DatabaseServerStatus = "starting"
	DatabaseServerStatusStopping DatabaseServerStatus = "stopping"
	DatabaseServerStatusError    DatabaseServerStatus = "error"
	DatabaseServerStatusUnknown  DatabaseServerStatus = "unknown"
)

// DatabaseServer represents a database engine container (Tier 1)
// A database server runs a single database engine (PostgreSQL, MariaDB, or MySQL)
// and can host multiple logical databases within it.
type DatabaseServer struct {
	ID                    string               `json:"id"`                      // Podmangr internal UUID
	ContainerID           string               `json:"container_id"`            // Podman container ID
	Name                  string               `json:"name"`                    // User-friendly server name
	Engine                DatabaseEngine       `json:"engine"`                  // postgresql, mariadb, mysql
	Version               string               `json:"version"`                 // Database version (e.g., "17", "11")
	Image                 string               `json:"image"`                   // Full container image reference
	Network               string               `json:"network"`                 // Podman network name
	Status                DatabaseServerStatus `json:"status"`                  // Current container status
	RootPasswordEncrypted string               `json:"-"`                       // Encrypted root password (never exposed via API)
	VolumeName            string               `json:"volume_name,omitempty"`   // Podman volume for data persistence
	InternalPort          int                  `json:"internal_port"`           // Database port inside container
	CreatedAt             time.Time            `json:"created_at"`
	UpdatedAt             time.Time            `json:"updated_at"`
	CreatedBy             *int64               `json:"created_by,omitempty"`    // User ID who created

	// Computed fields (not stored in database)
	DatabaseCount int `json:"database_count,omitempty"` // Number of databases in this server
}

// DatabaseServerListItem is a lightweight view for listing database servers
type DatabaseServerListItem struct {
	ID            string               `json:"id"`
	ContainerID   string               `json:"container_id"`
	Name          string               `json:"name"`
	Engine        DatabaseEngine       `json:"engine"`
	Version       string               `json:"version"`
	Network       string               `json:"network"`
	Status        DatabaseServerStatus `json:"status"`
	InternalPort  int                  `json:"internal_port"`
	CreatedAt     time.Time            `json:"created_at"`
	DatabaseCount int                  `json:"database_count"`
}

// Database represents a logical database within a server (Tier 2)
// Each database has its own credentials and can be used by different applications.
type Database struct {
	ID                string    `json:"id"`                   // Podmangr internal UUID
	ServerID          string    `json:"server_id"`            // Reference to parent database server
	Name              string    `json:"name"`                 // Database name
	Username          string    `json:"username"`             // Database user
	PasswordEncrypted string    `json:"-"`                    // Encrypted password (never exposed via API)
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	CreatedBy         *int64    `json:"created_by,omitempty"` // User ID who created

	// Computed fields (populated from joins)
	ServerName string         `json:"server_name,omitempty"` // Parent server name
	Engine     DatabaseEngine `json:"engine,omitempty"`      // Engine type from parent server
}

// DatabaseListItem is a lightweight view for listing databases
type DatabaseListItem struct {
	ID         string         `json:"id"`
	ServerID   string         `json:"server_id"`
	Name       string         `json:"name"`
	Username   string         `json:"username"`
	CreatedAt  time.Time      `json:"created_at"`
	ServerName string         `json:"server_name,omitempty"`
	Engine     DatabaseEngine `json:"engine,omitempty"`
}

// CreateDatabaseServerRequest represents the request body for creating a database server
type CreateDatabaseServerRequest struct {
	Name         string         `json:"name" validate:"required,min=1,max=64"`
	Engine       DatabaseEngine `json:"engine" validate:"required"`
	Version      string         `json:"version,omitempty"`       // Uses default if not specified
	Network      string         `json:"network,omitempty"`       // Uses podmangr-db if not specified
	RootPassword string         `json:"root_password,omitempty"` // Auto-generated if not specified
}

// CreateDatabaseRequest represents the request body for creating a database within a server
type CreateDatabaseRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=64"`
	Username string `json:"username,omitempty"` // Auto-generated if not specified
	Password string `json:"password,omitempty"` // Auto-generated if not specified
}

// ConnectionStringResponse contains connection details for a database
type ConnectionStringResponse struct {
	ConnectionString string `json:"connection_string"` // Full connection URI
	Host             string `json:"host"`              // Container hostname
	Port             int    `json:"port"`              // Database port
	Database         string `json:"database"`          // Database name
	Username         string `json:"username"`          // Database user
	Password         string `json:"password"`          // Database password (decrypted)
}

// EngineConfig contains configuration for a database engine type
type EngineConfig struct {
	Engine       DatabaseEngine `json:"engine"`
	Name         string         `json:"name"`          // Display name
	DefaultImage string         `json:"default_image"` // Docker Hub image
	DefaultPort  int            `json:"default_port"`  // Default database port
	Versions     []string       `json:"versions"`      // Available versions
}

// DatabaseServerWithDatabases includes the server and its databases
type DatabaseServerWithDatabases struct {
	DatabaseServer
	Databases []DatabaseListItem `json:"databases"`
}
