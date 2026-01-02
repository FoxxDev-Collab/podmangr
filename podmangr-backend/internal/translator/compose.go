package translator

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// ComposeFile represents a Docker Compose file structure
type ComposeFile struct {
	Version  string                 `yaml:"version,omitempty"`
	Services map[string]Service     `yaml:"services"`
	Networks map[string]Network     `yaml:"networks,omitempty"`
	Volumes  map[string]Volume      `yaml:"volumes,omitempty"`
	Secrets  map[string]interface{} `yaml:"secrets,omitempty"`
	Configs  map[string]interface{} `yaml:"configs,omitempty"`
}

// Service represents a Docker Compose service
type Service struct {
	Image         string            `yaml:"image,omitempty"`
	Build         interface{}       `yaml:"build,omitempty"`
	ContainerName string            `yaml:"container_name,omitempty"`
	Hostname      string            `yaml:"hostname,omitempty"`
	Command       interface{}       `yaml:"command,omitempty"`
	Entrypoint    interface{}       `yaml:"entrypoint,omitempty"`
	Environment   interface{}       `yaml:"environment,omitempty"`
	EnvFile       interface{}       `yaml:"env_file,omitempty"`
	Ports         []string          `yaml:"ports,omitempty"`
	Expose        []string          `yaml:"expose,omitempty"`
	Volumes       []string          `yaml:"volumes,omitempty"`
	Networks      interface{}       `yaml:"networks,omitempty"`
	DependsOn     interface{}       `yaml:"depends_on,omitempty"`
	Restart       string            `yaml:"restart,omitempty"`
	Labels        interface{}       `yaml:"labels,omitempty"`
	User          string            `yaml:"user,omitempty"`
	WorkingDir    string            `yaml:"working_dir,omitempty"`
	CapAdd        []string          `yaml:"cap_add,omitempty"`
	CapDrop       []string          `yaml:"cap_drop,omitempty"`
	Privileged    bool              `yaml:"privileged,omitempty"`
	SecurityOpt   []string          `yaml:"security_opt,omitempty"`
	Sysctls       interface{}       `yaml:"sysctls,omitempty"`
	Ulimits       interface{}       `yaml:"ulimits,omitempty"`
	Tmpfs         interface{}       `yaml:"tmpfs,omitempty"`
	StdinOpen     bool              `yaml:"stdin_open,omitempty"`
	Tty           bool              `yaml:"tty,omitempty"`
	Deploy        interface{}       `yaml:"deploy,omitempty"`
	HealthCheck   interface{}       `yaml:"healthcheck,omitempty"`
	Logging       interface{}       `yaml:"logging,omitempty"`
	ExtraHosts    []string          `yaml:"extra_hosts,omitempty"`
	DNS           interface{}       `yaml:"dns,omitempty"`
	DNSSearch     interface{}       `yaml:"dns_search,omitempty"`
	Devices       []string          `yaml:"devices,omitempty"`
	PidMode       string            `yaml:"pid,omitempty"`
	NetworkMode   string            `yaml:"network_mode,omitempty"`
	IpcMode       string            `yaml:"ipc,omitempty"`
	GroupAdd      []string          `yaml:"group_add,omitempty"`
	StopSignal    string            `yaml:"stop_signal,omitempty"`
	StopTimeout   interface{}       `yaml:"stop_grace_period,omitempty"`
	Runtime       string            `yaml:"runtime,omitempty"`
}

// Network represents a Docker Compose network
type Network struct {
	Driver     string                 `yaml:"driver,omitempty"`
	DriverOpts map[string]string      `yaml:"driver_opts,omitempty"`
	External   interface{}            `yaml:"external,omitempty"`
	Internal   bool                   `yaml:"internal,omitempty"`
	Ipam       interface{}            `yaml:"ipam,omitempty"`
	Labels     interface{}            `yaml:"labels,omitempty"`
	Name       string                 `yaml:"name,omitempty"`
	EnableIPv6 bool                   `yaml:"enable_ipv6,omitempty"`
}

// Volume represents a Docker Compose volume
type Volume struct {
	Driver     string            `yaml:"driver,omitempty"`
	DriverOpts map[string]string `yaml:"driver_opts,omitempty"`
	External   interface{}       `yaml:"external,omitempty"`
	Labels     interface{}       `yaml:"labels,omitempty"`
	Name       string            `yaml:"name,omitempty"`
}

// TranslationResult holds the translated output and any warnings
type TranslationResult struct {
	Output       string            `json:"output"`
	OutputFormat string            `json:"output_format"`
	Warnings     []string          `json:"warnings"`
	Errors       []string          `json:"errors"`
	Changes      []TransformChange `json:"changes"`
}

// TransformChange describes a transformation that was applied
type TransformChange struct {
	Type        string `json:"type"`        // "modified", "added", "removed", "warning"
	Location    string `json:"location"`    // e.g., "services.nginx.volumes[0]"
	Original    string `json:"original"`    // Original value
	Transformed string `json:"transformed"` // New value
	Reason      string `json:"reason"`      // Explanation
}

// OutputFormat specifies the translation output format
type OutputFormat string

const (
	FormatPodmanCompose OutputFormat = "podman-compose"
	FormatQuadlet       OutputFormat = "quadlet"
	FormatKube          OutputFormat = "kube"
)

// Translator handles Docker Compose to Podman translations
type Translator struct {
	rules []TransformRule
}

// TransformRule defines a transformation rule
type TransformRule struct {
	Name        string
	Description string
	Apply       func(compose *ComposeFile, changes *[]TransformChange) error
}

// NewTranslator creates a new translator with default rules
func NewTranslator() *Translator {
	t := &Translator{}
	t.initRules()
	return t
}

// initRules initializes the transformation rules
func (t *Translator) initRules() {
	t.rules = []TransformRule{
		{
			Name:        "docker-socket",
			Description: "Convert Docker socket paths to Podman",
			Apply:       ruleDockerSocket,
		},
		{
			Name:        "registry-prefix",
			Description: "Add full registry prefix to short image names",
			Apply:       ruleRegistryPrefix,
		},
		{
			Name:        "selinux-labels",
			Description: "Add SELinux labels to volume mounts",
			Apply:       ruleSELinuxLabels,
		},
		{
			Name:        "restart-policy",
			Description: "Normalize restart policies",
			Apply:       ruleRestartPolicy,
		},
		{
			Name:        "network-mode",
			Description: "Handle network mode differences",
			Apply:       ruleNetworkMode,
		},
	}
}

// Parse parses a Docker Compose YAML string
func (t *Translator) Parse(input string) (*ComposeFile, error) {
	var compose ComposeFile
	if err := yaml.Unmarshal([]byte(input), &compose); err != nil {
		return nil, fmt.Errorf("failed to parse compose file: %w", err)
	}
	return &compose, nil
}

// Translate converts a Docker Compose file to the specified output format
func (t *Translator) Translate(input string, format OutputFormat) (*TranslationResult, error) {
	result := &TranslationResult{
		OutputFormat: string(format),
		Warnings:     []string{},
		Errors:       []string{},
		Changes:      []TransformChange{},
	}

	// Parse the input
	compose, err := t.Parse(input)
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
		return result, err
	}

	// Apply transformation rules
	for _, rule := range t.rules {
		if err := rule.Apply(compose, &result.Changes); err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Rule '%s' warning: %v", rule.Name, err))
		}
	}

	// Generate output based on format
	switch format {
	case FormatPodmanCompose:
		output, err := t.toPodmanCompose(compose)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			return result, err
		}
		result.Output = output

	case FormatQuadlet:
		output, err := t.toQuadlet(compose)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			return result, err
		}
		result.Output = output

	case FormatKube:
		output, err := t.toKube(compose)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			return result, err
		}
		result.Output = output

	default:
		return nil, fmt.Errorf("unsupported output format: %s", format)
	}

	return result, nil
}

// toPodmanCompose generates Podman-compatible compose YAML
func (t *Translator) toPodmanCompose(compose *ComposeFile) (string, error) {
	output, err := yaml.Marshal(compose)
	if err != nil {
		return "", err
	}
	return string(output), nil
}

// toQuadlet generates Quadlet systemd unit files
func (t *Translator) toQuadlet(compose *ComposeFile) (string, error) {
	var result strings.Builder

	// Sort service names for consistent output
	serviceNames := make([]string, 0, len(compose.Services))
	for name := range compose.Services {
		serviceNames = append(serviceNames, name)
	}
	sort.Strings(serviceNames)

	for i, name := range serviceNames {
		service := compose.Services[name]
		if i > 0 {
			result.WriteString("\n---\n\n")
		}

		result.WriteString(fmt.Sprintf("# %s.container\n", name))
		result.WriteString("[Container]\n")

		if service.Image != "" {
			result.WriteString(fmt.Sprintf("Image=%s\n", service.Image))
		}

		if service.ContainerName != "" {
			result.WriteString(fmt.Sprintf("ContainerName=%s\n", service.ContainerName))
		} else {
			result.WriteString(fmt.Sprintf("ContainerName=%s\n", name))
		}

		// Environment variables
		envs := parseEnvironment(service.Environment)
		for k, v := range envs {
			result.WriteString(fmt.Sprintf("Environment=%s=%s\n", k, v))
		}

		// Ports
		for _, port := range service.Ports {
			result.WriteString(fmt.Sprintf("PublishPort=%s\n", port))
		}

		// Volumes
		for _, vol := range service.Volumes {
			result.WriteString(fmt.Sprintf("Volume=%s\n", vol))
		}

		// Networks
		networks := parseNetworks(service.Networks)
		for _, net := range networks {
			result.WriteString(fmt.Sprintf("Network=%s\n", net))
		}

		// Labels
		labels := parseLabels(service.Labels)
		for k, v := range labels {
			result.WriteString(fmt.Sprintf("Label=%s=%s\n", k, v))
		}

		// Capabilities
		for _, cap := range service.CapAdd {
			result.WriteString(fmt.Sprintf("AddCapability=%s\n", cap))
		}
		for _, cap := range service.CapDrop {
			result.WriteString(fmt.Sprintf("DropCapability=%s\n", cap))
		}

		// Privileged
		if service.Privileged {
			result.WriteString("SecurityLabelDisable=true\n")
		}

		// User
		if service.User != "" {
			result.WriteString(fmt.Sprintf("User=%s\n", service.User))
		}

		// Working directory
		if service.WorkingDir != "" {
			result.WriteString(fmt.Sprintf("WorkingDir=%s\n", service.WorkingDir))
		}

		// Devices
		for _, dev := range service.Devices {
			result.WriteString(fmt.Sprintf("AddDevice=%s\n", dev))
		}

		// Extra hosts
		for _, host := range service.ExtraHosts {
			result.WriteString(fmt.Sprintf("HostName=%s\n", host))
		}

		result.WriteString("\n[Service]\n")
		// Restart policy
		if service.Restart != "" {
			switch service.Restart {
			case "always", "unless-stopped":
				result.WriteString("Restart=always\n")
			case "on-failure":
				result.WriteString("Restart=on-failure\n")
			case "no":
				result.WriteString("Restart=no\n")
			}
		}

		result.WriteString("\n[Install]\n")
		result.WriteString("WantedBy=default.target\n")
	}

	return result.String(), nil
}

// toKube generates Kubernetes YAML
func (t *Translator) toKube(compose *ComposeFile) (string, error) {
	var result strings.Builder

	// Sort service names for consistent output
	serviceNames := make([]string, 0, len(compose.Services))
	for name := range compose.Services {
		serviceNames = append(serviceNames, name)
	}
	sort.Strings(serviceNames)

	result.WriteString("apiVersion: v1\n")
	result.WriteString("kind: Pod\n")
	result.WriteString("metadata:\n")
	result.WriteString("  name: compose-pod\n")
	result.WriteString("spec:\n")
	result.WriteString("  containers:\n")

	for _, name := range serviceNames {
		service := compose.Services[name]

		result.WriteString(fmt.Sprintf("    - name: %s\n", name))
		if service.Image != "" {
			result.WriteString(fmt.Sprintf("      image: %s\n", service.Image))
		}

		// Command
		if service.Command != nil {
			switch cmd := service.Command.(type) {
			case string:
				result.WriteString(fmt.Sprintf("      command: [\"/bin/sh\", \"-c\", %q]\n", cmd))
			case []interface{}:
				result.WriteString("      command:\n")
				for _, c := range cmd {
					result.WriteString(fmt.Sprintf("        - %q\n", c))
				}
			}
		}

		// Environment
		envs := parseEnvironment(service.Environment)
		if len(envs) > 0 {
			result.WriteString("      env:\n")
			for k, v := range envs {
				result.WriteString(fmt.Sprintf("        - name: %s\n", k))
				result.WriteString(fmt.Sprintf("          value: %q\n", v))
			}
		}

		// Ports
		if len(service.Ports) > 0 {
			result.WriteString("      ports:\n")
			for _, port := range service.Ports {
				// Parse port mapping
				parts := strings.Split(port, ":")
				if len(parts) >= 2 {
					containerPort := parts[len(parts)-1]
					// Remove /tcp or /udp suffix
					containerPort = strings.Split(containerPort, "/")[0]
					result.WriteString(fmt.Sprintf("        - containerPort: %s\n", containerPort))
				}
			}
		}

		// Volume mounts
		if len(service.Volumes) > 0 {
			result.WriteString("      volumeMounts:\n")
			for i, vol := range service.Volumes {
				parts := strings.Split(vol, ":")
				if len(parts) >= 2 {
					result.WriteString(fmt.Sprintf("        - name: volume-%d\n", i))
					result.WriteString(fmt.Sprintf("          mountPath: %s\n", parts[1]))
				}
			}
		}

		// Security context
		if service.Privileged {
			result.WriteString("      securityContext:\n")
			result.WriteString("        privileged: true\n")
		}
	}

	// Add volume definitions
	hasVolumes := false
	for _, name := range serviceNames {
		if len(compose.Services[name].Volumes) > 0 {
			hasVolumes = true
			break
		}
	}

	if hasVolumes {
		result.WriteString("  volumes:\n")
		volIndex := 0
		for _, name := range serviceNames {
			for _, vol := range compose.Services[name].Volumes {
				parts := strings.Split(vol, ":")
				if len(parts) >= 2 {
					result.WriteString(fmt.Sprintf("    - name: volume-%d\n", volIndex))
					result.WriteString("      hostPath:\n")
					result.WriteString(fmt.Sprintf("        path: %s\n", parts[0]))
					volIndex++
				}
			}
		}
	}

	return result.String(), nil
}

// Transformation Rules

func ruleDockerSocket(compose *ComposeFile, changes *[]TransformChange) error {
	for name, service := range compose.Services {
		for i, vol := range service.Volumes {
			if strings.Contains(vol, "/var/run/docker.sock") {
				newVol := strings.Replace(vol, "/var/run/docker.sock", "/run/podman/podman.sock", 1)
				*changes = append(*changes, TransformChange{
					Type:        "modified",
					Location:    fmt.Sprintf("services.%s.volumes[%d]", name, i),
					Original:    vol,
					Transformed: newVol,
					Reason:      "Docker socket path converted to Podman socket",
				})
				service.Volumes[i] = newVol
				compose.Services[name] = service
			}
		}
	}
	return nil
}

func ruleRegistryPrefix(compose *ComposeFile, changes *[]TransformChange) error {
	shortImageRegex := regexp.MustCompile(`^([a-z0-9_-]+)(:[a-z0-9._-]+)?$`)

	for name, service := range compose.Services {
		if service.Image != "" && shortImageRegex.MatchString(service.Image) {
			// Short name like "nginx" or "redis:7" - add docker.io/library/ prefix
			newImage := "docker.io/library/" + service.Image
			*changes = append(*changes, TransformChange{
				Type:        "modified",
				Location:    fmt.Sprintf("services.%s.image", name),
				Original:    service.Image,
				Transformed: newImage,
				Reason:      "Added full registry prefix for Podman compatibility",
			})
			service.Image = newImage
			compose.Services[name] = service
		}
	}
	return nil
}

func ruleSELinuxLabels(compose *ComposeFile, changes *[]TransformChange) error {
	for name, service := range compose.Services {
		for i, vol := range service.Volumes {
			parts := strings.Split(vol, ":")
			if len(parts) >= 2 {
				// Check if this is a bind mount (starts with / or .)
				if strings.HasPrefix(parts[0], "/") || strings.HasPrefix(parts[0], ".") {
					// Check if SELinux label is already present
					if !strings.Contains(vol, ":z") && !strings.Contains(vol, ":Z") {
						// Add :z for shared SELinux label
						newVol := vol + ":z"
						*changes = append(*changes, TransformChange{
							Type:        "modified",
							Location:    fmt.Sprintf("services.%s.volumes[%d]", name, i),
							Original:    vol,
							Transformed: newVol,
							Reason:      "Added SELinux :z label for bind mount (shared label)",
						})
						service.Volumes[i] = newVol
						compose.Services[name] = service
					}
				}
			}
		}
	}
	return nil
}

func ruleRestartPolicy(compose *ComposeFile, changes *[]TransformChange) error {
	for name, service := range compose.Services {
		if service.Restart == "unless-stopped" {
			*changes = append(*changes, TransformChange{
				Type:        "warning",
				Location:    fmt.Sprintf("services.%s.restart", name),
				Original:    service.Restart,
				Transformed: "always",
				Reason:      "Podman's systemd integration handles 'unless-stopped' as 'always'",
			})
		}
	}
	return nil
}

func ruleNetworkMode(compose *ComposeFile, changes *[]TransformChange) error {
	for name, service := range compose.Services {
		if service.NetworkMode == "host" {
			*changes = append(*changes, TransformChange{
				Type:        "warning",
				Location:    fmt.Sprintf("services.%s.network_mode", name),
				Original:    service.NetworkMode,
				Transformed: service.NetworkMode,
				Reason:      "Host network mode works differently in rootless Podman",
			})
		}
	}
	return nil
}

// Helper functions

func parseEnvironment(env interface{}) map[string]string {
	result := make(map[string]string)
	if env == nil {
		return result
	}

	switch e := env.(type) {
	case map[string]interface{}:
		for k, v := range e {
			result[k] = fmt.Sprintf("%v", v)
		}
	case []interface{}:
		for _, item := range e {
			if str, ok := item.(string); ok {
				parts := strings.SplitN(str, "=", 2)
				if len(parts) == 2 {
					result[parts[0]] = parts[1]
				} else if len(parts) == 1 {
					result[parts[0]] = ""
				}
			}
		}
	}
	return result
}

func parseNetworks(networks interface{}) []string {
	var result []string
	if networks == nil {
		return result
	}

	switch n := networks.(type) {
	case map[string]interface{}:
		for name := range n {
			result = append(result, name)
		}
	case []interface{}:
		for _, item := range n {
			if str, ok := item.(string); ok {
				result = append(result, str)
			}
		}
	}
	sort.Strings(result)
	return result
}

func parseLabels(labels interface{}) map[string]string {
	result := make(map[string]string)
	if labels == nil {
		return result
	}

	switch l := labels.(type) {
	case map[string]interface{}:
		for k, v := range l {
			result[k] = fmt.Sprintf("%v", v)
		}
	case []interface{}:
		for _, item := range l {
			if str, ok := item.(string); ok {
				parts := strings.SplitN(str, "=", 2)
				if len(parts) == 2 {
					result[parts[0]] = parts[1]
				}
			}
		}
	}
	return result
}
