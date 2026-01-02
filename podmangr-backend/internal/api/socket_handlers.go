package api

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"podmangr-backend/internal/system"
)

// listSocketsHandler returns all available Podman sockets
func listSocketsHandler(c echo.Context) error {
	registry := system.GetSocketRegistry()
	sockets := registry.ListSockets()

	currentID := registry.GetCurrentSocketID()
	currentService := registry.GetCurrentService()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"sockets": sockets,
		"current": map[string]interface{}{
			"id":           currentID,
			"mode":         currentService.GetMode(),
			"target_user":  currentService.GetTargetUser(),
			"running_as_root": currentService.IsRunningAsRoot(),
		},
	})
}

// switchSocketHandler changes the active Podman socket
func switchSocketHandler(c echo.Context) error {
	var req struct {
		SocketID string `json:"socket_id"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.SocketID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "socket_id is required",
		})
	}

	registry := system.GetSocketRegistry()

	if err := registry.SwitchSocket(req.SocketID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": err.Error(),
		})
	}

	// Update the global podmanService to use the new socket
	podmanService = registry.GetCurrentService()

	currentService := registry.GetCurrentService()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Socket switched successfully",
		"current": map[string]interface{}{
			"id":           req.SocketID,
			"mode":         currentService.GetMode(),
			"target_user":  currentService.GetTargetUser(),
			"running_as_root": currentService.IsRunningAsRoot(),
		},
	})
}

// refreshSocketsHandler re-discovers available sockets
func refreshSocketsHandler(c echo.Context) error {
	registry := system.GetSocketRegistry()
	registry.RefreshSockets()

	// Update the global podmanService
	podmanService = registry.GetCurrentService()

	sockets := registry.ListSockets()
	currentID := registry.GetCurrentSocketID()
	currentService := registry.GetCurrentService()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Sockets refreshed",
		"sockets": sockets,
		"current": map[string]interface{}{
			"id":           currentID,
			"mode":         currentService.GetMode(),
			"target_user":  currentService.GetTargetUser(),
			"running_as_root": currentService.IsRunningAsRoot(),
		},
	})
}
