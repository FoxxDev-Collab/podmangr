package system

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"podmangr-backend/internal/auth"
	"podmangr-backend/internal/database"
	"podmangr-backend/internal/models"
)

// Default network for database servers
const DefaultDatabaseNetwork = "podmangr-db"

// EngineConfigs contains configuration for each database engine
var EngineConfigs = map[models.DatabaseEngine]models.EngineConfig{
	models.EnginePostgreSQL: {
		Engine:       models.EnginePostgreSQL,
		Name:         "PostgreSQL",
		DefaultImage: "docker.io/postgres",
		DefaultPort:  5432,
		Versions:     []string{"17", "16", "15", "14", "13"},
	},
	models.EngineMariaDB: {
		Engine:       models.EngineMariaDB,
		Name:         "MariaDB",
		DefaultImage: "docker.io/mariadb",
		DefaultPort:  3306,
		Versions:     []string{"11", "10.11", "10.6", "10.5"},
	},
	models.EngineMySQL: {
		Engine:       models.EngineMySQL,
		Name:         "MySQL",
		DefaultImage: "docker.io/mysql",
		DefaultPort:  3306,
		Versions:     []string{"9.0", "8.4", "8.0"},
	},
}

// DatabaseService manages database servers and databases
type DatabaseService struct {
	podman      *PodmanService
	serverRepo  *database.DatabaseServerRepo
	dbRepo      *database.DatabaseRepo
	secretsRepo *database.SecretsRepo
	encryption  *auth.EncryptionService
}

// NewDatabaseService creates a new database service
func NewDatabaseService() (*DatabaseService, error) {
	encryption, err := auth.GetEncryptionService()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize encryption: %w", err)
	}

	return &DatabaseService{
		podman:      NewPodmanService(),
		serverRepo:  database.NewDatabaseServerRepo(),
		dbRepo:      database.NewDatabaseRepo(),
		secretsRepo: database.NewSecretsRepo(),
		encryption:  encryption,
	}, nil
}

// GetEngineConfigs returns all available engine configurations
func (s *DatabaseService) GetEngineConfigs() []models.EngineConfig {
	configs := make([]models.EngineConfig, 0, len(EngineConfigs))
	for _, cfg := range EngineConfigs {
		configs = append(configs, cfg)
	}
	return configs
}

// EnsureNetwork ensures the database network exists, creating it if necessary
func (s *DatabaseService) EnsureNetwork(ctx context.Context, networkName string) error {
	networks, err := s.podman.ListNetworks(ctx)
	if err != nil {
		return fmt.Errorf("failed to list networks: %w", err)
	}

	// Check if network already exists
	for _, n := range networks {
		if n.Name == networkName {
			return nil
		}
	}

	// Create the network
	err = s.podman.CreateNetwork(ctx, &models.CreateNetworkRequest{
		Name:   networkName,
		Driver: "bridge",
		Labels: map[string]string{
			"podmangr.managed": "true",
			"podmangr.purpose": "database",
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create network %s: %w", networkName, err)
	}

	return nil
}

// CreateServer creates a new database server container
func (s *DatabaseService) CreateServer(ctx context.Context, req *models.CreateDatabaseServerRequest, userID *int64) (*models.DatabaseServer, string, error) {
	// Validate engine
	engineCfg, ok := EngineConfigs[req.Engine]
	if !ok {
		return nil, "", fmt.Errorf("unsupported database engine: %s", req.Engine)
	}

	// Use defaults if not specified
	version := req.Version
	if version == "" && len(engineCfg.Versions) > 0 {
		version = engineCfg.Versions[0]
	}

	network := req.Network
	if network == "" {
		network = DefaultDatabaseNetwork
	}

	// Generate root password if not provided
	rootPassword := req.RootPassword
	if rootPassword == "" {
		var err error
		rootPassword, err = auth.GeneratePassword(24)
		if err != nil {
			return nil, "", fmt.Errorf("failed to generate password: %w", err)
		}
	}

	// Encrypt the root password for storage
	encryptedPassword, err := s.encryption.Encrypt(rootPassword)
	if err != nil {
		return nil, "", fmt.Errorf("failed to encrypt password: %w", err)
	}

	// Ensure network exists
	if err := s.EnsureNetwork(ctx, network); err != nil {
		return nil, "", err
	}

	// Create volume for data persistence
	volumeName := fmt.Sprintf("podmangr-db-%s-data", req.Name)
	err = s.podman.CreateVolume(ctx, &models.CreateVolumeRequest{
		Name: volumeName,
		Labels: map[string]string{
			"podmangr.managed":   "true",
			"podmangr.db-server": req.Name,
		},
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create volume: %w", err)
	}

	// Build container configuration
	image := fmt.Sprintf("%s:%s", engineCfg.DefaultImage, version)
	containerName := fmt.Sprintf("podmangr-db-%s", req.Name)

	// Environment variables differ by engine
	env := make(map[string]string)
	var dataPath string
	switch req.Engine {
	case models.EnginePostgreSQL:
		env["POSTGRES_PASSWORD"] = rootPassword
		dataPath = "/var/lib/postgresql/data"
	case models.EngineMariaDB, models.EngineMySQL:
		env["MYSQL_ROOT_PASSWORD"] = rootPassword
		dataPath = "/var/lib/mysql"
	}

	// Create the container
	containerID, err := s.podman.CreateContainer(ctx, &models.CreateContainerRequest{
		Name:        containerName,
		Image:       image,
		NetworkMode: network,
		Environment: env,
		Volumes: []models.VolumeMount{
			{
				Source: volumeName,
				Target: dataPath,
				Type:   "volume",
			},
		},
		Labels: map[string]string{
			"podmangr.managed":   "true",
			"podmangr.db-server": "true",
			"podmangr.db-engine": string(req.Engine),
			"podmangr.db-name":   req.Name,
		},
		RestartPolicy: "unless-stopped",
	})
	if err != nil {
		// Clean up volume on failure
		_ = s.podman.RemoveVolume(ctx, volumeName, true)
		return nil, "", fmt.Errorf("failed to create container: %w", err)
	}

	// Create database record
	server := &models.DatabaseServer{
		ContainerID:           containerID,
		Name:                  req.Name,
		Engine:                req.Engine,
		Version:               version,
		Image:                 image,
		Network:               network,
		Status:                models.DatabaseServerStatusStopped,
		RootPasswordEncrypted: encryptedPassword,
		VolumeName:            volumeName,
		InternalPort:          engineCfg.DefaultPort,
		CreatedBy:             userID,
	}

	if err := s.serverRepo.Create(server); err != nil {
		// Clean up container and volume on failure
		_ = s.podman.RemoveContainer(ctx, containerID, true)
		_ = s.podman.RemoveVolume(ctx, volumeName, true)
		return nil, "", fmt.Errorf("failed to save server record: %w", err)
	}

	// Start the container
	if err := s.podman.StartContainer(ctx, containerID); err != nil {
		// Update status to error but keep the record
		_ = s.serverRepo.UpdateStatus(server.ID, models.DatabaseServerStatusError)
		return server, rootPassword, fmt.Errorf("server created but failed to start: %w", err)
	}

	// Update status to running
	_ = s.serverRepo.UpdateStatus(server.ID, models.DatabaseServerStatusRunning)
	server.Status = models.DatabaseServerStatusRunning

	// Save root password to secrets store for easy retrieval
	s.saveServerSecret(server, rootPassword, userID)

	return server, rootPassword, nil
}

// saveServerSecret saves the database server root password to the secrets store
func (s *DatabaseService) saveServerSecret(server *models.DatabaseServer, rootPassword string, userID *int64) {
	// Encrypt the password for secrets store
	encrypted, err := s.encryption.Encrypt(rootPassword)
	if err != nil {
		return // Non-fatal: password is already in database_servers table
	}

	containerName := fmt.Sprintf("podmangr-db-%s", server.Name)
	category := "database"
	description := fmt.Sprintf("Root password for %s database server", server.Name)
	metadata := fmt.Sprintf(`{"engine":"%s","version":"%s","port":%d,"network":"%s"}`,
		server.Engine, server.Version, server.InternalPort, server.Network)

	secret := &models.Secret{
		ContainerID:    &server.ContainerID,
		ContainerName:  &containerName,
		Name:           fmt.Sprintf("%s - Root Password", server.Name),
		ValueEncrypted: encrypted,
		SecretType:     models.SecretTypePassword,
		Category:       &category,
		Description:    &description,
		Metadata:       &metadata,
		CreatedBy:      userID,
	}

	_ = s.secretsRepo.Create(secret)
}

// GetServer retrieves a database server by ID
func (s *DatabaseService) GetServer(ctx context.Context, id string) (*models.DatabaseServer, error) {
	server, err := s.serverRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Sync status from Podman
	s.syncServerStatus(ctx, server)

	return server, nil
}

// ListServers returns all database servers
func (s *DatabaseService) ListServers(ctx context.Context) ([]models.DatabaseServerListItem, error) {
	servers, err := s.serverRepo.List()
	if err != nil {
		return nil, err
	}

	// Sync status for each server
	for i := range servers {
		s.syncServerListItemStatus(ctx, &servers[i])
	}

	return servers, nil
}

// syncServerStatus synchronizes the server status with the actual container status
func (s *DatabaseService) syncServerStatus(ctx context.Context, server *models.DatabaseServer) {
	containers, err := s.podman.ListContainers(ctx)
	if err != nil {
		return
	}

	for _, c := range containers {
		if c.ContainerID == server.ContainerID || strings.HasPrefix(c.ContainerID, server.ContainerID) {
			var newStatus models.DatabaseServerStatus
			switch c.Status {
			case models.ContainerStatusRunning:
				newStatus = models.DatabaseServerStatusRunning
			case models.ContainerStatusExited, models.ContainerStatusCreated:
				newStatus = models.DatabaseServerStatusStopped
			default:
				newStatus = models.DatabaseServerStatusUnknown
			}

			if newStatus != server.Status {
				server.Status = newStatus
				_ = s.serverRepo.UpdateStatus(server.ID, newStatus)
			}
			return
		}
	}

	// Container not found - mark as error
	if server.Status != models.DatabaseServerStatusError {
		server.Status = models.DatabaseServerStatusError
		_ = s.serverRepo.UpdateStatus(server.ID, models.DatabaseServerStatusError)
	}
}

// syncServerListItemStatus synchronizes status for list items
func (s *DatabaseService) syncServerListItemStatus(ctx context.Context, server *models.DatabaseServerListItem) {
	containers, err := s.podman.ListContainers(ctx)
	if err != nil {
		return
	}

	for _, c := range containers {
		if c.ContainerID == server.ContainerID || strings.HasPrefix(c.ContainerID, server.ContainerID) {
			var newStatus models.DatabaseServerStatus
			switch c.Status {
			case models.ContainerStatusRunning:
				newStatus = models.DatabaseServerStatusRunning
			case models.ContainerStatusExited, models.ContainerStatusCreated:
				newStatus = models.DatabaseServerStatusStopped
			default:
				newStatus = models.DatabaseServerStatusUnknown
			}

			if newStatus != server.Status {
				server.Status = newStatus
				_ = s.serverRepo.UpdateStatus(server.ID, newStatus)
			}
			return
		}
	}
}

// StartServer starts a database server container
func (s *DatabaseService) StartServer(ctx context.Context, id string) error {
	server, err := s.serverRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}

	_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusStarting)

	if err := s.podman.StartContainer(ctx, server.ContainerID); err != nil {
		_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusError)
		return fmt.Errorf("failed to start server: %w", err)
	}

	_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusRunning)
	return nil
}

// StopServer stops a database server container
func (s *DatabaseService) StopServer(ctx context.Context, id string) error {
	server, err := s.serverRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}

	_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusStopping)

	if err := s.podman.StopContainer(ctx, server.ContainerID, 30); err != nil {
		_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusError)
		return fmt.Errorf("failed to stop server: %w", err)
	}

	_ = s.serverRepo.UpdateStatus(id, models.DatabaseServerStatusStopped)
	return nil
}

// DeleteServer removes a database server and all its resources
func (s *DatabaseService) DeleteServer(ctx context.Context, id string) error {
	server, err := s.serverRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}

	// Stop if running
	_ = s.podman.StopContainer(ctx, server.ContainerID, 10)

	// Remove container
	if err := s.podman.RemoveContainer(ctx, server.ContainerID, true); err != nil {
		// Log but continue - container might already be gone
	}

	// Remove volume
	if server.VolumeName != "" {
		if err := s.podman.RemoveVolume(ctx, server.VolumeName, true); err != nil {
			// Log but continue
		}
	}

	// Delete from database (cascades to databases table)
	return s.serverRepo.Delete(id)
}

// CreateDatabase creates a logical database within a server
func (s *DatabaseService) CreateDatabase(ctx context.Context, serverID string, req *models.CreateDatabaseRequest, userID *int64) (*models.Database, string, error) {
	// Get server
	server, err := s.serverRepo.GetByID(serverID)
	if err != nil {
		return nil, "", fmt.Errorf("server not found: %w", err)
	}

	// Verify server is running
	s.syncServerStatus(ctx, server)
	if server.Status != models.DatabaseServerStatusRunning {
		return nil, "", fmt.Errorf("server must be running to create databases (current status: %s)", server.Status)
	}

	// Check if database already exists
	exists, err := s.dbRepo.Exists(serverID, req.Name)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check database existence: %w", err)
	}
	if exists {
		return nil, "", fmt.Errorf("database '%s' already exists on this server", req.Name)
	}

	// Generate username if not provided
	username := req.Username
	if username == "" {
		username, err = auth.GenerateUsername(req.Name, 8)
		if err != nil {
			return nil, "", fmt.Errorf("failed to generate username: %w", err)
		}
	}

	// Generate password if not provided
	password := req.Password
	if password == "" {
		password, err = auth.GeneratePassword(24)
		if err != nil {
			return nil, "", fmt.Errorf("failed to generate password: %w", err)
		}
	}

	// Decrypt root password for SQL execution
	rootPassword, err := s.encryption.Decrypt(server.RootPasswordEncrypted)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decrypt server credentials: %w", err)
	}

	// Execute SQL to create database and user
	if err := s.createDatabaseSQL(ctx, server, req.Name, username, password, rootPassword); err != nil {
		return nil, "", fmt.Errorf("failed to create database: %w", err)
	}

	// Encrypt password for storage
	encryptedPassword, err := s.encryption.Encrypt(password)
	if err != nil {
		return nil, "", fmt.Errorf("failed to encrypt password: %w", err)
	}

	// Save to database
	db := &models.Database{
		ServerID:          serverID,
		Name:              req.Name,
		Username:          username,
		PasswordEncrypted: encryptedPassword,
		CreatedBy:         userID,
		ServerName:        server.Name,
		Engine:            server.Engine,
	}

	if err := s.dbRepo.Create(db); err != nil {
		// Try to clean up the database we just created
		_ = s.dropDatabaseSQL(ctx, server, req.Name, username, rootPassword)
		return nil, "", fmt.Errorf("failed to save database record: %w", err)
	}

	// Save credentials to secrets store for easy retrieval
	s.saveDatabaseSecret(server, db, password, userID)

	return db, password, nil
}

// saveDatabaseSecret saves the database credentials to the secrets store
func (s *DatabaseService) saveDatabaseSecret(server *models.DatabaseServer, db *models.Database, password string, userID *int64) {
	// Encrypt the password for secrets store
	encrypted, err := s.encryption.Encrypt(password)
	if err != nil {
		return // Non-fatal: password is already in databases table
	}

	containerName := fmt.Sprintf("podmangr-db-%s", server.Name)
	category := "database"
	description := fmt.Sprintf("Credentials for database '%s' on %s", db.Name, server.Name)

	// Build connection string based on engine
	var connStr string
	switch server.Engine {
	case models.EnginePostgreSQL:
		connStr = fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
			db.Username, password, containerName, server.InternalPort, db.Name)
	case models.EngineMariaDB, models.EngineMySQL:
		connStr = fmt.Sprintf("mysql://%s:%s@%s:%d/%s",
			db.Username, password, containerName, server.InternalPort, db.Name)
	}

	metadata := fmt.Sprintf(`{"engine":"%s","server":"%s","database":"%s","username":"%s","host":"%s","port":%d,"connection_string":"%s"}`,
		server.Engine, server.Name, db.Name, db.Username, containerName, server.InternalPort, connStr)

	secret := &models.Secret{
		ContainerID:    &server.ContainerID,
		ContainerName:  &containerName,
		Name:           fmt.Sprintf("%s/%s - Credentials", server.Name, db.Name),
		ValueEncrypted: encrypted,
		SecretType:     models.SecretTypeConnectionString,
		Category:       &category,
		Description:    &description,
		Metadata:       &metadata,
		CreatedBy:      userID,
	}

	_ = s.secretsRepo.Create(secret)
}

// createDatabaseSQL executes SQL to create a database and user
func (s *DatabaseService) createDatabaseSQL(ctx context.Context, server *models.DatabaseServer, dbName, username, password, rootPassword string) error {
	switch server.Engine {
	case models.EnginePostgreSQL:
		return s.createPostgreSQLDatabase(ctx, server.ContainerID, dbName, username, password)
	case models.EngineMariaDB, models.EngineMySQL:
		return s.createMySQLDatabase(ctx, server.ContainerID, dbName, username, password, rootPassword)
	default:
		return fmt.Errorf("unsupported engine: %s", server.Engine)
	}
}

// createPostgreSQLDatabase creates a database in PostgreSQL
func (s *DatabaseService) createPostgreSQLDatabase(ctx context.Context, containerID, dbName, username, password string) error {
	// PostgreSQL identifiers with special characters need double-quote escaping
	// Create user
	_, err := s.podman.Exec(ctx, containerID, []string{
		"psql", "-U", "postgres", "-c",
		fmt.Sprintf(`CREATE USER "%s" WITH PASSWORD '%s';`, username, password),
	}, false)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Create database
	_, err = s.podman.Exec(ctx, containerID, []string{
		"psql", "-U", "postgres", "-c",
		fmt.Sprintf(`CREATE DATABASE "%s" OWNER "%s";`, dbName, username),
	}, false)
	if err != nil {
		// Clean up user on failure
		_, _ = s.podman.Exec(ctx, containerID, []string{
			"psql", "-U", "postgres", "-c",
			fmt.Sprintf(`DROP USER IF EXISTS "%s";`, username),
		}, false)
		return fmt.Errorf("failed to create database: %w", err)
	}

	// Grant all privileges
	_, err = s.podman.Exec(ctx, containerID, []string{
		"psql", "-U", "postgres", "-c",
		fmt.Sprintf(`GRANT ALL PRIVILEGES ON DATABASE "%s" TO "%s";`, dbName, username),
	}, false)
	if err != nil {
		return fmt.Errorf("failed to grant privileges: %w", err)
	}

	return nil
}

// createMySQLDatabase creates a database in MySQL/MariaDB
func (s *DatabaseService) createMySQLDatabase(ctx context.Context, containerID, dbName, username, password, rootPassword string) error {
	// Create database
	_, err := s.podman.Exec(ctx, containerID, []string{
		"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
		fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`;", dbName),
	}, false)
	if err != nil {
		return fmt.Errorf("failed to create database: %w", err)
	}

	// Create user
	_, err = s.podman.Exec(ctx, containerID, []string{
		"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
		fmt.Sprintf("CREATE USER '%s'@'%%' IDENTIFIED BY '%s';", username, password),
	}, false)
	if err != nil {
		// Clean up database on failure
		_, _ = s.podman.Exec(ctx, containerID, []string{
			"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
			fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;", dbName),
		}, false)
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Grant privileges
	_, err = s.podman.Exec(ctx, containerID, []string{
		"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
		fmt.Sprintf("GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'%%';", dbName, username),
	}, false)
	if err != nil {
		return fmt.Errorf("failed to grant privileges: %w", err)
	}

	// Flush privileges
	_, err = s.podman.Exec(ctx, containerID, []string{
		"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
		"FLUSH PRIVILEGES;",
	}, false)
	if err != nil {
		return fmt.Errorf("failed to flush privileges: %w", err)
	}

	return nil
}

// dropDatabaseSQL drops a database and user
func (s *DatabaseService) dropDatabaseSQL(ctx context.Context, server *models.DatabaseServer, dbName, username, rootPassword string) error {
	switch server.Engine {
	case models.EnginePostgreSQL:
		// Drop database first (use double quotes for identifiers with special chars)
		_, _ = s.podman.Exec(ctx, server.ContainerID, []string{
			"psql", "-U", "postgres", "-c",
			fmt.Sprintf(`DROP DATABASE IF EXISTS "%s";`, dbName),
		}, false)
		// Then drop user
		_, _ = s.podman.Exec(ctx, server.ContainerID, []string{
			"psql", "-U", "postgres", "-c",
			fmt.Sprintf(`DROP USER IF EXISTS "%s";`, username),
		}, false)
	case models.EngineMariaDB, models.EngineMySQL:
		// Drop user first
		_, _ = s.podman.Exec(ctx, server.ContainerID, []string{
			"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
			fmt.Sprintf("DROP USER IF EXISTS '%s'@'%%';", username),
		}, false)
		// Then drop database
		_, _ = s.podman.Exec(ctx, server.ContainerID, []string{
			"mysql", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "-e",
			fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;", dbName),
		}, false)
	}
	return nil
}

// GetDatabase retrieves a database by ID
func (s *DatabaseService) GetDatabase(ctx context.Context, id string) (*models.Database, error) {
	return s.dbRepo.GetByID(id)
}

// ListDatabases returns all databases in a server
func (s *DatabaseService) ListDatabases(ctx context.Context, serverID string) ([]models.DatabaseListItem, error) {
	return s.dbRepo.ListByServerID(serverID)
}

// DeleteDatabase removes a database from a server
func (s *DatabaseService) DeleteDatabase(ctx context.Context, id string) error {
	// Get database info
	db, err := s.dbRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("database not found: %w", err)
	}

	// Get server info
	server, err := s.serverRepo.GetByID(db.ServerID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}

	// Sync status
	s.syncServerStatus(ctx, server)

	// If server is running, drop the database
	if server.Status == models.DatabaseServerStatusRunning {
		rootPassword, err := s.encryption.Decrypt(server.RootPasswordEncrypted)
		if err == nil {
			_ = s.dropDatabaseSQL(ctx, server, db.Name, db.Username, rootPassword)
		}
	}

	// Delete from our database
	return s.dbRepo.Delete(id)
}

// GetConnectionString generates a connection string for a database
func (s *DatabaseService) GetConnectionString(ctx context.Context, id string) (*models.ConnectionStringResponse, error) {
	// Get database
	db, err := s.dbRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("database not found: %w", err)
	}

	// Get server
	server, err := s.serverRepo.GetByID(db.ServerID)
	if err != nil {
		return nil, fmt.Errorf("server not found: %w", err)
	}

	// Decrypt password
	password, err := s.encryption.Decrypt(db.PasswordEncrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	// Build connection string
	// Host is the container name (works within the same Podman network)
	containerName := fmt.Sprintf("podmangr-db-%s", server.Name)
	port := server.InternalPort

	var connStr string
	switch server.Engine {
	case models.EnginePostgreSQL:
		connStr = fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
			db.Username, password, containerName, port, db.Name)
	case models.EngineMariaDB, models.EngineMySQL:
		connStr = fmt.Sprintf("mysql://%s:%s@%s:%d/%s",
			db.Username, password, containerName, port, db.Name)
	}

	return &models.ConnectionStringResponse{
		ConnectionString: connStr,
		Host:             containerName,
		Port:             port,
		Database:         db.Name,
		Username:         db.Username,
		Password:         password,
	}, nil
}

// WaitForServerReady waits for a database server to be ready to accept connections
func (s *DatabaseService) WaitForServerReady(ctx context.Context, serverID string, timeout time.Duration) error {
	server, err := s.serverRepo.GetByID(serverID)
	if err != nil {
		return err
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		// Try to execute a simple command to check if the database is ready
		var checkCmd []string
		switch server.Engine {
		case models.EnginePostgreSQL:
			checkCmd = []string{"pg_isready", "-U", "postgres"}
		case models.EngineMariaDB, models.EngineMySQL:
			rootPassword, _ := s.encryption.Decrypt(server.RootPasswordEncrypted)
			checkCmd = []string{"mysqladmin", "-u", "root", fmt.Sprintf("-p%s", rootPassword), "ping"}
		}

		_, err := s.podman.Exec(ctx, server.ContainerID, checkCmd, false)
		if err == nil {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
			// Continue polling
		}
	}

	return fmt.Errorf("timeout waiting for server to be ready")
}

// GetServerRootPassword retrieves the decrypted root password for a server
// This should only be used internally or for admin access
func (s *DatabaseService) GetServerRootPassword(ctx context.Context, serverID string) (string, error) {
	server, err := s.serverRepo.GetByID(serverID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("server not found")
		}
		return "", err
	}

	return s.encryption.Decrypt(server.RootPasswordEncrypted)
}
