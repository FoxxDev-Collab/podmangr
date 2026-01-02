package api

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"podmangr-backend/internal/translator"
)

// translateRequest is the request body for translation
type translateRequest struct {
	Input  string `json:"input"`
	Format string `json:"format"` // "podman-compose", "quadlet", "kube"
}

// translateHandler translates Docker Compose to Podman formats
func translateHandler(c echo.Context) error {
	var req translateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Input == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Input is required",
		})
	}

	if req.Format == "" {
		req.Format = "podman-compose"
	}

	// Validate format
	var format translator.OutputFormat
	switch req.Format {
	case "podman-compose":
		format = translator.FormatPodmanCompose
	case "quadlet":
		format = translator.FormatQuadlet
	case "kube":
		format = translator.FormatKube
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid format. Supported: podman-compose, quadlet, kube",
		})
	}

	// Create translator and translate
	t := translator.NewTranslator()
	result, err := t.Translate(req.Input, format)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":    err.Error(),
			"warnings": result.Warnings,
			"errors":   result.Errors,
		})
	}

	return c.JSON(http.StatusOK, result)
}

// validateComposeHandler validates a Docker Compose file without translating
func validateComposeHandler(c echo.Context) error {
	var req struct {
		Input string `json:"input"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Input == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Input is required",
		})
	}

	t := translator.NewTranslator()
	compose, err := t.Parse(req.Input)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   err.Error(),
		})
	}

	// Count services, networks, volumes
	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":    true,
		"services": len(compose.Services),
		"networks": len(compose.Networks),
		"volumes":  len(compose.Volumes),
	})
}

// getTransformRulesHandler returns available transformation rules
func getTransformRulesHandler(c echo.Context) error {
	rules := []map[string]string{
		{
			"name":        "docker-socket",
			"description": "Convert Docker socket paths (/var/run/docker.sock) to Podman (/run/podman/podman.sock)",
		},
		{
			"name":        "registry-prefix",
			"description": "Add full registry prefix (docker.io/library/) to short image names",
		},
		{
			"name":        "selinux-labels",
			"description": "Add SELinux labels (:z or :Z) to bind mount volumes",
		},
		{
			"name":        "restart-policy",
			"description": "Normalize restart policies for Podman/systemd compatibility",
		},
		{
			"name":        "network-mode",
			"description": "Handle network mode differences between Docker and Podman",
		},
	}

	formats := []map[string]string{
		{
			"id":          "podman-compose",
			"name":        "Podman Compose",
			"description": "Podman-compatible docker-compose.yml format",
		},
		{
			"id":          "quadlet",
			"name":        "Quadlet",
			"description": "Systemd Quadlet .container files for native systemd integration",
		},
		{
			"id":          "kube",
			"name":        "Kubernetes YAML",
			"description": "Kubernetes Pod manifest for podman kube play",
		},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"rules":   rules,
		"formats": formats,
	})
}
