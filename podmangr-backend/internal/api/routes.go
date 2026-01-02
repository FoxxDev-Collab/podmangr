package api

import (
	"github.com/labstack/echo/v4"

	"podmangr-backend/internal/auth"
	"podmangr-backend/internal/models"
)

// RegisterRoutes sets up all API routes
func RegisterRoutes(api *echo.Group, authSvc *auth.Service) {
	// Initialize services
	InitAuthService()
	InitUserRepo()
	InitContainerRepos()
	InitStackRepo()

	// Initialize database service (for two-tier database management)
	if err := InitDatabaseService(); err != nil {
		// Log warning but don't fail - database management is optional
		// The handlers will return errors if service is unavailable
		println("Warning: Failed to initialize database service:", err.Error())
	}

	// Store authSvc for use in handlers
	authService = authSvc

	// Health check (public)
	api.GET("/health", healthCheck)

	// Auth routes (public - no auth required for login)
	authGroup := api.Group("/auth")
	authGroup.POST("/login", loginHandler, auth.LoginRateLimiter.Middleware())
	authGroup.POST("/logout", logoutHandler)
	authGroup.POST("/refresh", refreshTokenHandler)
	authGroup.GET("/me", getCurrentUser)

	// Protected auth routes
	authProtected := authGroup.Group("")
	authProtected.Use(auth.RequireAuth(authSvc))
	authProtected.GET("/sessions", getUserSessions)
	authProtected.DELETE("/sessions/:id", revokeSession)

	// User preferences routes (authenticated)
	userGroup := api.Group("/user")
	userGroup.Use(auth.RequireAuth(authSvc))
	userGroup.GET("/preferences", getUserPreferencesHandler)
	userGroup.PUT("/preferences", updateUserPreferencesHandler)
	userGroup.PATCH("/preferences", patchUserPreferencesHandler)

	// User management routes (requires wheel group or root for PAM users, admin for local users)
	users := api.Group("/users")
	users.Use(auth.RequireAuth(authSvc))
	users.Use(auth.RequireWheelOrRoot(authSvc))
	users.GET("", listUsersHandler)
	users.POST("", createUserHandler)
	users.GET("/:id", getUserHandler)
	users.PUT("/:id", updateUserHandler)
	users.DELETE("/:id", deleteUserHandler)


	// System routes (authenticated, admin for critical operations)
	system := api.Group("/system")
	system.Use(auth.RequireAuth(authSvc))
	system.GET("/resources", getResourcesHandler)
	system.GET("/info", getSystemInfoHandler)
	system.POST("/reboot", rebootSystemHandler, auth.RequireRole(models.RoleAdmin))

	// Process routes (authenticated, kill requires operator+)
	processes := api.Group("/processes")
	processes.Use(auth.RequireAuth(authSvc))
	processes.GET("", listProcesses)
	processes.DELETE("/:pid", killProcess, auth.RequireOperatorOrAdmin())

	// Service routes (authenticated, actions require operator+)
	services := api.Group("/services")
	services.Use(auth.RequireAuth(authSvc))
	services.GET("", listServices)
	services.GET("/:name", getService)
	services.POST("/:name/:action", serviceAction, auth.RequireOperatorOrAdmin())

	// Update routes (authenticated, apply requires admin)
	updates := api.Group("/updates")
	updates.Use(auth.RequireAuth(authSvc))
	updates.GET("/available", getAvailableUpdates)
	updates.POST("/apply", applyUpdates, auth.RequireRole(models.RoleAdmin))
	updates.GET("/history", getUpdateHistory)


	// Storage routes (authenticated, read-only for viewing, wheel/root for management)
	storage := api.Group("/storage")
	storage.Use(auth.RequireAuth(authSvc))
	storage.GET("/disks", getDisks)
	storage.GET("/mounts", getMounts)
	storage.GET("/lvm", getLVM)
	// Storage management (requires wheel/root)
	storage.GET("/partitions/:device", getPartitionTableHandler, auth.RequireWheelOrRoot(authSvc))
	storage.POST("/partitions", createPartitionHandler, auth.RequireWheelOrRoot(authSvc))
	storage.DELETE("/partitions", deletePartitionHandler, auth.RequireWheelOrRoot(authSvc))
	storage.POST("/format", formatPartitionHandler, auth.RequireWheelOrRoot(authSvc))
	storage.POST("/mount", mountHandler, auth.RequireWheelOrRoot(authSvc))
	storage.POST("/unmount", unmountHandler, auth.RequireWheelOrRoot(authSvc))


	// Terminal WebSocket route (authentication handled inside handler due to WebSocket limitations)
	api.GET("/terminal/ws", HandleTerminalWebSocket)

	// Network management routes
	network := api.Group("/network")
	network.Use(auth.RequireAuth(authSvc))

	// Interface routes (read: all users, write: admin only)
	network.GET("/interfaces", listInterfacesHandler)
	network.GET("/interfaces/:name", getInterfaceHandler)
	network.GET("/interfaces/:name/stats", getInterfaceStatsHandler)
	network.POST("/interfaces/:name/state", setInterfaceStateHandler, auth.RequireRole(models.RoleAdmin))

	// Firewall routes (read: all users, write: admin only)
	network.GET("/firewall/status", getFirewallStatusHandler)
	network.GET("/firewall/zones", listFirewallZonesHandler)
	network.GET("/firewall/zones/:zone", getFirewallZoneHandler)
	network.GET("/firewall/services", getAvailableServicesHandler)
	network.POST("/firewall/zones", createFirewallZoneHandler, auth.RequireRole(models.RoleAdmin))
	network.DELETE("/firewall/zones/:zone", deleteFirewallZoneHandler, auth.RequireRole(models.RoleAdmin))
	network.POST("/firewall/zones/:zone/services", addFirewallServiceHandler, auth.RequireRole(models.RoleAdmin))
	network.DELETE("/firewall/zones/:zone/services/:service", removeFirewallServiceHandler, auth.RequireRole(models.RoleAdmin))
	network.POST("/firewall/zones/:zone/ports", addFirewallPortHandler, auth.RequireRole(models.RoleAdmin))
	network.DELETE("/firewall/zones/:zone/ports/:port", removeFirewallPortHandler, auth.RequireRole(models.RoleAdmin))
	network.POST("/firewall/zones/:zone/rules", addFirewallRichRuleHandler, auth.RequireRole(models.RoleAdmin))
	network.DELETE("/firewall/zones/:zone/rules", removeFirewallRichRuleHandler, auth.RequireRole(models.RoleAdmin))
	network.POST("/firewall/reload", reloadFirewallHandler, auth.RequireRole(models.RoleAdmin))
	network.POST("/firewall/default-zone", setDefaultZoneHandler, auth.RequireRole(models.RoleAdmin))

	// Route management (read: all users, write: admin only)
	network.GET("/routes", listRoutesHandler)
	network.POST("/routes", addRouteHandler, auth.RequireRole(models.RoleAdmin))
	network.DELETE("/routes/:destination", deleteRouteHandler, auth.RequireRole(models.RoleAdmin))

	// DNS configuration (read-only)
	network.GET("/dns", getDNSConfigHandler)

	// Active connections (read-only)
	network.GET("/connections", listConnectionsHandler)

	// Docker Hub image search (public endpoint with auth)
	api.GET("/dockerhub/search", searchDockerHubHandler, auth.RequireAuth(authSvc))

	// Port information endpoint (requires auth)
	api.GET("/ports/used", listUsedPortsHandler, auth.RequireAuth(authSvc))

	// Container management routes (Phase 2B)
	containers := api.Group("/containers")
	containers.Use(auth.RequireAuth(authSvc))

	// Podman availability check
	containers.GET("/check", checkPodmanHandler)

	// Podman installation WebSocket (admin only)
	containers.GET("/install", installPodmanHandler)

	// Container operations (read: all, write: operator+, create/delete: admin)
	containers.GET("", listContainersHandler)
	containers.GET("/:id", getContainerHandler)
	containers.POST("", createContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.POST("/adopt", adoptContainerHandler, auth.RequireRole(models.RoleAdmin)) // Adopt existing containers
	containers.POST("/validate", validateContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.GET("/deploy", deployContainerHandler, auth.RequireRole(models.RoleAdmin)) // WebSocket
	containers.PUT("/:id", updateContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.DELETE("/:id", removeContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.POST("/:id/start", startContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.POST("/:id/stop", stopContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.POST("/:id/restart", restartContainerHandler, auth.RequireRole(models.RoleAdmin))
	containers.GET("/:id/inspect", inspectContainerHandler)         // Detailed container info
	containers.GET("/:id/logs", getContainerLogsRESTHandler)       // REST: fetch logs
	containers.GET("/:id/logs/stream", getContainerLogsHandler)    // WebSocket: stream logs
	containers.GET("/:id/exec", execContainerHandler)              // WebSocket: terminal shell
	containers.GET("/:id/stats", getContainerStatsHandler)
	containers.GET("/:id/metrics", getContainerMetricsHandler)

	// Container update & backup routes
	containers.GET("/:id/config", getContainerConfigHandler)                                        // Get full container config
	containers.GET("/:id/backups", listContainerBackupsHandler)                                     // List backups
	containers.GET("/:id/check-update", checkContainerUpdateHandler)                                // Check for image updates
	containers.GET("/:id/update", updateContainerImageHandler, auth.RequireRole(models.RoleAdmin))  // WebSocket: update container
	containers.DELETE("/backups/:backup_id", deleteContainerBackupHandler, auth.RequireRole(models.RoleAdmin)) // Delete backup
	containers.POST("/backups/:backup_id/restore", restoreContainerBackupHandler, auth.RequireRole(models.RoleAdmin)) // Restore backup

	// Global backup management (admin only)
	api.GET("/backups", listAllBackupsHandler, auth.RequireAuth(authSvc))                           // List all backups
	api.GET("/backups/settings", getBackupSettingsHandler, auth.RequireAuth(authSvc))               // Get backup settings
	api.PUT("/backups/settings", updateBackupSettingsHandler, auth.RequireAuth(authSvc), auth.RequireRole(models.RoleAdmin)) // Update backup settings

	// Container web UI proxy (proxies to container's web interface)
	containers.Any("/:id/proxy", proxyContainerWebUIHandler)
	containers.Any("/:id/proxy/*", proxyContainerWebUIHandler)

	// Image management (read: all, write: admin)
	images := api.Group("/images")
	images.Use(auth.RequireAuth(authSvc))
	images.GET("", listImagesHandler)
	images.GET("/inspect", inspectImageHandler)      // Check if image exists and get config
	images.GET("/inspect/ws", inspectImageWSHandler) // WebSocket: pull + inspect with progress
	images.POST("/pull", pullImageHandler, auth.RequireRole(models.RoleAdmin))
	images.DELETE("/:id", removeImageHandler, auth.RequireRole(models.RoleAdmin))

	// Volume management (read: all, write: admin)
	volumes := api.Group("/volumes")
	volumes.Use(auth.RequireAuth(authSvc))
	volumes.GET("", listVolumesHandler)
	volumes.POST("", createVolumeHandler, auth.RequireRole(models.RoleAdmin))
	volumes.DELETE("/:name", removeVolumeHandler, auth.RequireRole(models.RoleAdmin))

	// Podman storage configuration (admin only)
	api.GET("/storage-config", getStorageConfigHandler, auth.RequireAuth(authSvc), auth.RequireRole(models.RoleAdmin))
	api.PUT("/storage-config", updateStorageConfigHandler, auth.RequireAuth(authSvc), auth.RequireRole(models.RoleAdmin))

	// Bind mounts endpoint (aggregates bind mounts from all containers)
	api.GET("/bind-mounts", listBindMountsHandler, auth.RequireAuth(authSvc))

	// Podman network management (read: all, write: admin)
	podmanNetworks := api.Group("/podman-networks")
	podmanNetworks.Use(auth.RequireAuth(authSvc))
	podmanNetworks.GET("", listPodmanNetworksHandler)
	podmanNetworks.POST("", createPodmanNetworkHandler, auth.RequireRole(models.RoleAdmin))
	podmanNetworks.DELETE("/:name", removePodmanNetworkHandler, auth.RequireRole(models.RoleAdmin))

	// Pod management (read: all, write: admin)
	pods := api.Group("/pods")
	pods.Use(auth.RequireAuth(authSvc))
	pods.GET("", listPodsHandler)
	pods.POST("", createPodHandler, auth.RequireRole(models.RoleAdmin))
	pods.GET("/:id/inspect", inspectPodHandler)
	pods.POST("/:id/start", startPodHandler, auth.RequireRole(models.RoleAdmin))
	pods.POST("/:id/stop", stopPodHandler, auth.RequireRole(models.RoleAdmin))
	pods.POST("/:id/restart", restartPodHandler, auth.RequireRole(models.RoleAdmin))
	pods.POST("/:id/pause", pausePodHandler, auth.RequireRole(models.RoleAdmin))
	pods.POST("/:id/unpause", unpausePodHandler, auth.RequireRole(models.RoleAdmin))
	pods.DELETE("/:id", removePodHandler, auth.RequireRole(models.RoleAdmin))

	// Podman socket/context management (read: all, switch: admin)
	sockets := api.Group("/podman-sockets")
	sockets.Use(auth.RequireAuth(authSvc))
	sockets.GET("", listSocketsHandler)
	sockets.POST("/switch", switchSocketHandler, auth.RequireRole(models.RoleAdmin))
	sockets.POST("/refresh", refreshSocketsHandler, auth.RequireRole(models.RoleAdmin))

	// Template management (read: all, write: admin)
	templates := api.Group("/templates")
	templates.Use(auth.RequireAuth(authSvc))
	templates.GET("", listTemplatesHandler)
	templates.GET("/:id", getTemplateHandler)
	templates.GET("/:id/export", exportTemplateHandler)
	templates.POST("", createTemplateHandler, auth.RequireRole(models.RoleAdmin))
	templates.POST("/import", importTemplateHandler, auth.RequireRole(models.RoleAdmin))
	templates.PUT("/:id", updateTemplateHandler, auth.RequireRole(models.RoleAdmin))
	templates.POST("/:id/deploy", deployTemplateHandler, auth.RequireRole(models.RoleAdmin))
	templates.DELETE("/:id", deleteTemplateHandler, auth.RequireRole(models.RoleAdmin))

	// Stack management (compose-based deployments)
	stacks := api.Group("/stacks")
	stacks.Use(auth.RequireAuth(authSvc))
	stacks.GET("", listStacksHandler)
	stacks.GET("/:id", getStackHandler)
	stacks.GET("/:id/containers", getStackContainersHandler)
	stacks.POST("", createStackHandler, auth.RequireRole(models.RoleAdmin))
	stacks.PUT("/:id", updateStackHandler, auth.RequireRole(models.RoleAdmin))
	stacks.DELETE("/:id", deleteStackHandler, auth.RequireRole(models.RoleAdmin))
	stacks.GET("/:id/deploy", deployStackHandler, auth.RequireRole(models.RoleAdmin)) // WebSocket
	stacks.POST("/:id/start", startStackHandler, auth.RequireOperatorOrAdmin())
	stacks.POST("/:id/stop", stopStackHandler, auth.RequireOperatorOrAdmin())
	stacks.POST("/:id/restart", restartStackHandler, auth.RequireOperatorOrAdmin())
	stacks.GET("/:id/pull", pullStackHandler, auth.RequireRole(models.RoleAdmin)) // WebSocket

	// Desktop apps endpoint (containers with web UIs)
	api.GET("/desktop-apps", listDesktopAppsHandler, auth.RequireAuth(authSvc))

	// Translation engine (Docker Compose -> Podman formats)
	translate := api.Group("/translate")
	translate.Use(auth.RequireAuth(authSvc))
	translate.POST("", translateHandler)
	translate.POST("/validate", validateComposeHandler)
	translate.GET("/rules", getTransformRulesHandler)

	// Database Server Management (Two-Tier: Servers + Databases)
	dbServers := api.Group("/database-servers")
	dbServers.Use(auth.RequireAuth(authSvc))

	// Engine configurations (read: all users)
	dbServers.GET("/engines", listDatabaseEnginesHandler)

	// Server operations (read: all, write: admin)
	dbServers.GET("", listDatabaseServersHandler)
	dbServers.POST("", createDatabaseServerHandler, auth.RequireRole(models.RoleAdmin))
	dbServers.GET("/:id", getDatabaseServerHandler)
	dbServers.POST("/:id/start", startDatabaseServerHandler, auth.RequireRole(models.RoleAdmin))
	dbServers.POST("/:id/stop", stopDatabaseServerHandler, auth.RequireRole(models.RoleAdmin))
	dbServers.DELETE("/:id", deleteDatabaseServerHandler, auth.RequireRole(models.RoleAdmin))

	// Database operations within servers (read: all, write: admin)
	dbServers.GET("/:id/databases", listDatabasesHandler)
	dbServers.POST("/:id/databases", createDatabaseHandler, auth.RequireRole(models.RoleAdmin))
	dbServers.DELETE("/:id/databases/:dbId", deleteDatabaseHandler, auth.RequireRole(models.RoleAdmin))
	dbServers.GET("/:id/databases/:dbId/connection", getDatabaseConnectionHandler)

	// Secrets Store (encrypted credentials for containers)
	if err := InitSecretsService(); err != nil {
		println("Warning: Failed to initialize secrets service:", err.Error())
	}
	secrets := api.Group("/secrets")
	secrets.Use(auth.RequireAuth(authSvc))
	secrets.GET("", listSecretsHandler)
	secrets.POST("", createSecretHandler, auth.RequireRole(models.RoleAdmin))
	secrets.GET("/:id", getSecretHandler)
	secrets.GET("/:id/reveal", revealSecretHandler) // Returns decrypted value
	secrets.PUT("/:id", updateSecretHandler, auth.RequireRole(models.RoleAdmin))
	secrets.DELETE("/:id", deleteSecretHandler, auth.RequireRole(models.RoleAdmin))
}
