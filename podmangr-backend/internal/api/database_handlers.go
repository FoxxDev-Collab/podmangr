package api

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"podmangr-backend/internal/models"
	"podmangr-backend/internal/system"
)

var dbService *system.DatabaseService

// InitDatabaseService initializes the database service
func InitDatabaseService() error {
	var err error
	dbService, err = system.NewDatabaseService()
	return err
}

// listDatabaseEnginesHandler returns available database engine configurations
// GET /api/database-servers/engines
func listDatabaseEnginesHandler(c echo.Context) error {
	configs := dbService.GetEngineConfigs()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"engines": configs,
	})
}

// listDatabaseServersHandler returns all database servers
// GET /api/database-servers
func listDatabaseServersHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	servers, err := dbService.ListServers(ctx)
	if err != nil {
		c.Logger().Error("Failed to list database servers: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list database servers: " + err.Error(),
		})
	}

	if servers == nil {
		servers = []models.DatabaseServerListItem{}
	}

	return c.JSON(http.StatusOK, servers)
}

// createDatabaseServerHandler creates a new database server
// POST /api/database-servers
func createDatabaseServerHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 120*time.Second) // Longer timeout for image pull
	defer cancel()

	var req models.CreateDatabaseServerRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server name is required",
		})
	}
	if req.Engine == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Database engine is required",
		})
	}

	// Get user ID for audit
	var userID *int64
	if user, ok := c.Get("user").(*models.User); ok && user != nil {
		userID = &user.ID
	}

	server, rootPassword, err := dbService.CreateServer(ctx, &req, userID)
	if err != nil {
		c.Logger().Error("Failed to create database server: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create database server: " + err.Error(),
		})
	}

	// Return server with the root password (only shown once)
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"server":        server,
		"root_password": rootPassword,
		"message":       "Database server created successfully. Save the root password - it will not be shown again.",
	})
}

// getDatabaseServerHandler returns a specific database server
// GET /api/database-servers/:id
func getDatabaseServerHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	server, err := dbService.GetServer(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Server not found",
			})
		}
		c.Logger().Error("Failed to get database server: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to get database server: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, server)
}

// startDatabaseServerHandler starts a database server
// POST /api/database-servers/:id/start
func startDatabaseServerHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	if err := dbService.StartServer(ctx, id); err != nil {
		c.Logger().Error("Failed to start database server: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to start database server: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Database server started successfully",
	})
}

// stopDatabaseServerHandler stops a database server
// POST /api/database-servers/:id/stop
func stopDatabaseServerHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 60*time.Second)
	defer cancel()

	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	if err := dbService.StopServer(ctx, id); err != nil {
		c.Logger().Error("Failed to stop database server: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to stop database server: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Database server stopped successfully",
	})
}

// deleteDatabaseServerHandler deletes a database server
// DELETE /api/database-servers/:id
func deleteDatabaseServerHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 60*time.Second)
	defer cancel()

	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	if err := dbService.DeleteServer(ctx, id); err != nil {
		c.Logger().Error("Failed to delete database server: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete database server: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Database server deleted successfully",
	})
}

// listDatabasesHandler returns all databases in a server
// GET /api/database-servers/:id/databases
func listDatabasesHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	serverID := c.Param("id")
	if serverID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	databases, err := dbService.ListDatabases(ctx, serverID)
	if err != nil {
		c.Logger().Error("Failed to list databases: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list databases: " + err.Error(),
		})
	}

	if databases == nil {
		databases = []models.DatabaseListItem{}
	}

	return c.JSON(http.StatusOK, databases)
}

// createDatabaseHandler creates a new database in a server
// POST /api/database-servers/:id/databases
func createDatabaseHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	serverID := c.Param("id")
	if serverID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID is required",
		})
	}

	var req models.CreateDatabaseRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Database name is required",
		})
	}

	// Get user ID for audit
	var userID *int64
	if user, ok := c.Get("user").(*models.User); ok && user != nil {
		userID = &user.ID
	}

	db, password, err := dbService.CreateDatabase(ctx, serverID, &req, userID)
	if err != nil {
		c.Logger().Error("Failed to create database: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create database: " + err.Error(),
		})
	}

	// Return database with the password (only shown once)
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"database": db,
		"password": password,
		"message":  "Database created successfully. Save the password - it will not be shown again.",
	})
}

// deleteDatabaseHandler deletes a database from a server
// DELETE /api/database-servers/:id/databases/:dbId
func deleteDatabaseHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	dbID := c.Param("dbId")
	if dbID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Database ID is required",
		})
	}

	if err := dbService.DeleteDatabase(ctx, dbID); err != nil {
		c.Logger().Error("Failed to delete database: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete database: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Database deleted successfully",
	})
}

// getDatabaseConnectionHandler returns connection details for a database
// GET /api/database-servers/:id/databases/:dbId/connection
func getDatabaseConnectionHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	dbID := c.Param("dbId")
	if dbID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Database ID is required",
		})
	}

	conn, err := dbService.GetConnectionString(ctx, dbID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Database not found",
			})
		}
		c.Logger().Error("Failed to get connection string: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to get connection string: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, conn)
}
