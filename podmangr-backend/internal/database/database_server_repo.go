package database

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"podmangr-backend/internal/models"
)

// DatabaseServerRepo handles database server operations
type DatabaseServerRepo struct {
	db *sql.DB
}

// NewDatabaseServerRepo creates a new database server repository
func NewDatabaseServerRepo() *DatabaseServerRepo {
	return &DatabaseServerRepo{db: DB}
}

// Create adds a new database server to the database
func (r *DatabaseServerRepo) Create(s *models.DatabaseServer) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()

	_, err := r.db.Exec(`
		INSERT INTO database_servers (
			id, container_id, name, engine, version, image, network,
			status, root_password_encrypted, volume_name, internal_port,
			created_at, updated_at, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		s.ID, s.ContainerID, s.Name, s.Engine, s.Version, s.Image, s.Network,
		s.Status, s.RootPasswordEncrypted, s.VolumeName, s.InternalPort,
		s.CreatedAt, s.UpdatedAt, s.CreatedBy,
	)
	return err
}

// GetByID retrieves a database server by its ID
func (r *DatabaseServerRepo) GetByID(id string) (*models.DatabaseServer, error) {
	s := &models.DatabaseServer{}
	var volumeName sql.NullString
	err := r.db.QueryRow(`
		SELECT id, container_id, name, engine, version, image, network,
			status, root_password_encrypted, volume_name, internal_port,
			created_at, updated_at, created_by
		FROM database_servers WHERE id = ?
	`, id).Scan(
		&s.ID, &s.ContainerID, &s.Name, &s.Engine, &s.Version, &s.Image, &s.Network,
		&s.Status, &s.RootPasswordEncrypted, &volumeName, &s.InternalPort,
		&s.CreatedAt, &s.UpdatedAt, &s.CreatedBy,
	)
	if err != nil {
		return nil, err
	}
	if volumeName.Valid {
		s.VolumeName = volumeName.String
	}
	return s, nil
}

// GetByName retrieves a database server by its name
func (r *DatabaseServerRepo) GetByName(name string) (*models.DatabaseServer, error) {
	s := &models.DatabaseServer{}
	var volumeName sql.NullString
	err := r.db.QueryRow(`
		SELECT id, container_id, name, engine, version, image, network,
			status, root_password_encrypted, volume_name, internal_port,
			created_at, updated_at, created_by
		FROM database_servers WHERE name = ?
	`, name).Scan(
		&s.ID, &s.ContainerID, &s.Name, &s.Engine, &s.Version, &s.Image, &s.Network,
		&s.Status, &s.RootPasswordEncrypted, &volumeName, &s.InternalPort,
		&s.CreatedAt, &s.UpdatedAt, &s.CreatedBy,
	)
	if err != nil {
		return nil, err
	}
	if volumeName.Valid {
		s.VolumeName = volumeName.String
	}
	return s, nil
}

// GetByContainerID retrieves a database server by its Podman container ID
func (r *DatabaseServerRepo) GetByContainerID(containerID string) (*models.DatabaseServer, error) {
	s := &models.DatabaseServer{}
	var volumeName sql.NullString
	err := r.db.QueryRow(`
		SELECT id, container_id, name, engine, version, image, network,
			status, root_password_encrypted, volume_name, internal_port,
			created_at, updated_at, created_by
		FROM database_servers WHERE container_id = ?
	`, containerID).Scan(
		&s.ID, &s.ContainerID, &s.Name, &s.Engine, &s.Version, &s.Image, &s.Network,
		&s.Status, &s.RootPasswordEncrypted, &volumeName, &s.InternalPort,
		&s.CreatedAt, &s.UpdatedAt, &s.CreatedBy,
	)
	if err != nil {
		return nil, err
	}
	if volumeName.Valid {
		s.VolumeName = volumeName.String
	}
	return s, nil
}

// List retrieves all database servers with database counts
func (r *DatabaseServerRepo) List() ([]models.DatabaseServerListItem, error) {
	rows, err := r.db.Query(`
		SELECT s.id, s.container_id, s.name, s.engine, s.version, s.network,
			s.status, s.internal_port, s.created_at,
			COUNT(d.id) as database_count
		FROM database_servers s
		LEFT JOIN databases d ON s.id = d.server_id
		GROUP BY s.id
		ORDER BY s.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []models.DatabaseServerListItem
	for rows.Next() {
		var s models.DatabaseServerListItem
		if err := rows.Scan(
			&s.ID, &s.ContainerID, &s.Name, &s.Engine, &s.Version, &s.Network,
			&s.Status, &s.InternalPort, &s.CreatedAt, &s.DatabaseCount,
		); err != nil {
			return nil, err
		}
		servers = append(servers, s)
	}

	return servers, nil
}

// Update updates a database server
func (r *DatabaseServerRepo) Update(s *models.DatabaseServer) error {
	s.UpdatedAt = time.Now()
	_, err := r.db.Exec(`
		UPDATE database_servers SET
			container_id = ?, name = ?, engine = ?, version = ?, image = ?,
			network = ?, status = ?, root_password_encrypted = ?,
			volume_name = ?, internal_port = ?, updated_at = ?
		WHERE id = ?
	`,
		s.ContainerID, s.Name, s.Engine, s.Version, s.Image,
		s.Network, s.Status, s.RootPasswordEncrypted,
		s.VolumeName, s.InternalPort, s.UpdatedAt, s.ID,
	)
	return err
}

// UpdateStatus updates just the status of a database server
func (r *DatabaseServerRepo) UpdateStatus(id string, status models.DatabaseServerStatus) error {
	_, err := r.db.Exec(`
		UPDATE database_servers SET status = ?, updated_at = ? WHERE id = ?
	`, status, time.Now(), id)
	return err
}

// UpdateContainerID updates the container ID (after recreation)
func (r *DatabaseServerRepo) UpdateContainerID(id, containerID string) error {
	_, err := r.db.Exec(`
		UPDATE database_servers SET container_id = ?, updated_at = ? WHERE id = ?
	`, containerID, time.Now(), id)
	return err
}

// Delete removes a database server (databases are cascade deleted)
func (r *DatabaseServerRepo) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM database_servers WHERE id = ?", id)
	return err
}

// CountDatabases returns the number of databases in a server
func (r *DatabaseServerRepo) CountDatabases(serverID string) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM databases WHERE server_id = ?
	`, serverID).Scan(&count)
	return count, err
}

// ----------------------------------------
// DatabaseRepo handles logical database operations
// ----------------------------------------

// DatabaseRepo handles database operations within servers
type DatabaseRepo struct {
	db *sql.DB
}

// NewDatabaseRepo creates a new database repository
func NewDatabaseRepo() *DatabaseRepo {
	return &DatabaseRepo{db: DB}
}

// Create adds a new database to a server
func (r *DatabaseRepo) Create(d *models.Database) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	d.CreatedAt = time.Now()
	d.UpdatedAt = time.Now()

	_, err := r.db.Exec(`
		INSERT INTO databases (
			id, server_id, name, username, password_encrypted,
			created_at, updated_at, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`,
		d.ID, d.ServerID, d.Name, d.Username, d.PasswordEncrypted,
		d.CreatedAt, d.UpdatedAt, d.CreatedBy,
	)
	return err
}

// GetByID retrieves a database by its ID
func (r *DatabaseRepo) GetByID(id string) (*models.Database, error) {
	d := &models.Database{}
	err := r.db.QueryRow(`
		SELECT d.id, d.server_id, d.name, d.username, d.password_encrypted,
			d.created_at, d.updated_at, d.created_by,
			s.name as server_name, s.engine
		FROM databases d
		JOIN database_servers s ON d.server_id = s.id
		WHERE d.id = ?
	`, id).Scan(
		&d.ID, &d.ServerID, &d.Name, &d.Username, &d.PasswordEncrypted,
		&d.CreatedAt, &d.UpdatedAt, &d.CreatedBy,
		&d.ServerName, &d.Engine,
	)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// GetByServerIDAndName retrieves a database by server and name
func (r *DatabaseRepo) GetByServerIDAndName(serverID, name string) (*models.Database, error) {
	d := &models.Database{}
	err := r.db.QueryRow(`
		SELECT d.id, d.server_id, d.name, d.username, d.password_encrypted,
			d.created_at, d.updated_at, d.created_by,
			s.name as server_name, s.engine
		FROM databases d
		JOIN database_servers s ON d.server_id = s.id
		WHERE d.server_id = ? AND d.name = ?
	`, serverID, name).Scan(
		&d.ID, &d.ServerID, &d.Name, &d.Username, &d.PasswordEncrypted,
		&d.CreatedAt, &d.UpdatedAt, &d.CreatedBy,
		&d.ServerName, &d.Engine,
	)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// ListByServerID retrieves all databases in a server
func (r *DatabaseRepo) ListByServerID(serverID string) ([]models.DatabaseListItem, error) {
	rows, err := r.db.Query(`
		SELECT d.id, d.server_id, d.name, d.username, d.created_at,
			s.name as server_name, s.engine
		FROM databases d
		JOIN database_servers s ON d.server_id = s.id
		WHERE d.server_id = ?
		ORDER BY d.name
	`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var databases []models.DatabaseListItem
	for rows.Next() {
		var d models.DatabaseListItem
		if err := rows.Scan(
			&d.ID, &d.ServerID, &d.Name, &d.Username, &d.CreatedAt,
			&d.ServerName, &d.Engine,
		); err != nil {
			return nil, err
		}
		databases = append(databases, d)
	}

	return databases, nil
}

// ListAll retrieves all databases across all servers
func (r *DatabaseRepo) ListAll() ([]models.DatabaseListItem, error) {
	rows, err := r.db.Query(`
		SELECT d.id, d.server_id, d.name, d.username, d.created_at,
			s.name as server_name, s.engine
		FROM databases d
		JOIN database_servers s ON d.server_id = s.id
		ORDER BY s.name, d.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var databases []models.DatabaseListItem
	for rows.Next() {
		var d models.DatabaseListItem
		if err := rows.Scan(
			&d.ID, &d.ServerID, &d.Name, &d.Username, &d.CreatedAt,
			&d.ServerName, &d.Engine,
		); err != nil {
			return nil, err
		}
		databases = append(databases, d)
	}

	return databases, nil
}

// Delete removes a database
func (r *DatabaseRepo) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM databases WHERE id = ?", id)
	return err
}

// DeleteByServerID removes all databases in a server
func (r *DatabaseRepo) DeleteByServerID(serverID string) error {
	_, err := r.db.Exec("DELETE FROM databases WHERE server_id = ?", serverID)
	return err
}

// Exists checks if a database with the given name exists in a server
func (r *DatabaseRepo) Exists(serverID, name string) (bool, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM databases WHERE server_id = ? AND name = ?
	`, serverID, name).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
