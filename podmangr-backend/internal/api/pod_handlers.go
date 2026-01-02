package api

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// listPodsHandler returns all pods
func listPodsHandler(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	pods, err := podmanService.ListPods(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, pods)
}

// createPodHandler creates a new pod
func createPodHandler(c echo.Context) error {
	var req struct {
		Name         string            `json:"name"`
		PortMappings []string          `json:"port_mappings"`
		Labels       map[string]string `json:"labels"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod name is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	podID, err := podmanService.CreatePod(ctx, req.Name, req.PortMappings, req.Labels)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"id":      podID,
		"message": "Pod created successfully",
	})
}

// startPodHandler starts a pod
func startPodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.StartPod(ctx, podID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod started successfully",
	})
}

// stopPodHandler stops a pod
func stopPodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.StopPod(ctx, podID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod stopped successfully",
	})
}

// restartPodHandler restarts a pod
func restartPodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.RestartPod(ctx, podID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod restarted successfully",
	})
}

// removePodHandler removes a pod
func removePodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	force := c.QueryParam("force") == "true"

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.RemovePod(ctx, podID, force); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod removed successfully",
	})
}

// inspectPodHandler returns detailed pod information
func inspectPodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	inspect, err := podmanService.InspectPod(ctx, podID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, inspect)
}

// pausePodHandler pauses all containers in a pod
func pausePodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.PausePod(ctx, podID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod paused successfully",
	})
}

// unpausePodHandler unpauses all containers in a pod
func unpausePodHandler(c echo.Context) error {
	podID := c.Param("id")
	if podID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Pod ID is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	if err := podmanService.UnpausePod(ctx, podID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Pod unpaused successfully",
	})
}
