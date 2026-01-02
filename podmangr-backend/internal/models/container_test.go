package models

import (
	"testing"
)

func TestContainerStatusConstants(t *testing.T) {
	// Verify status constants are defined correctly
	statuses := []ContainerStatus{
		ContainerStatusCreated,
		ContainerStatusRunning,
		ContainerStatusPaused,
		ContainerStatusRestarting,
		ContainerStatusRemoving,
		ContainerStatusExited,
		ContainerStatusDead,
		ContainerStatusUnknown,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("Container status should not be empty")
		}
	}
}

func TestContainerStatusValues(t *testing.T) {
	tests := []struct {
		status   ContainerStatus
		expected string
	}{
		{ContainerStatusCreated, "created"},
		{ContainerStatusRunning, "running"},
		{ContainerStatusPaused, "paused"},
		{ContainerStatusRestarting, "restarting"},
		{ContainerStatusRemoving, "removing"},
		{ContainerStatusExited, "exited"},
		{ContainerStatusDead, "dead"},
		{ContainerStatusUnknown, "unknown"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.expected {
			t.Errorf("Expected status %s, got %s", tc.expected, tc.status)
		}
	}
}

func TestStackStatusConstants(t *testing.T) {
	// Verify status constants are defined correctly
	statuses := []StackStatus{
		StackStatusActive,
		StackStatusPartial,
		StackStatusStopped,
		StackStatusError,
		StackStatusDeploying,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("Stack status should not be empty")
		}
	}
}

func TestStackStatusValues(t *testing.T) {
	tests := []struct {
		status   StackStatus
		expected string
	}{
		{StackStatusActive, "active"},
		{StackStatusPartial, "partial"},
		{StackStatusStopped, "stopped"},
		{StackStatusError, "error"},
		{StackStatusDeploying, "deploying"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.expected {
			t.Errorf("Expected status %s, got %s", tc.expected, tc.status)
		}
	}
}

func TestPortMapping(t *testing.T) {
	port := PortMapping{
		HostIP:        "0.0.0.0",
		HostPort:      8080,
		ContainerPort: 80,
		Protocol:      "tcp",
	}

	if port.HostPort != 8080 {
		t.Errorf("Expected host port 8080, got %d", port.HostPort)
	}

	if port.ContainerPort != 80 {
		t.Errorf("Expected container port 80, got %d", port.ContainerPort)
	}

	if port.Protocol != "tcp" {
		t.Errorf("Expected protocol tcp, got %s", port.Protocol)
	}
}

func TestVolumeMount(t *testing.T) {
	mount := VolumeMount{
		Source:   "/host/path",
		Target:   "/container/path",
		ReadOnly: false,
		Type:     "bind",
	}

	if mount.Source != "/host/path" {
		t.Errorf("Expected source /host/path, got %s", mount.Source)
	}

	if mount.Target != "/container/path" {
		t.Errorf("Expected target /container/path, got %s", mount.Target)
	}

	if mount.Type != "bind" {
		t.Errorf("Expected type bind, got %s", mount.Type)
	}
}

func TestContainerStats(t *testing.T) {
	stats := ContainerStats{
		ContainerID: "abc123",
		CPUPercent:  25.5,
		MemoryUsed:  1073741824, // 1GB
		MemoryLimit: 4294967296, // 4GB
		MemoryPct:   25.0,
		NetworkRx:   1048576, // 1MB
		NetworkTx:   524288,  // 512KB
		BlockRead:   2097152, // 2MB
		BlockWrite:  1048576, // 1MB
		PIDs:        10,
	}

	if stats.CPUPercent != 25.5 {
		t.Errorf("Expected CPU percent 25.5, got %f", stats.CPUPercent)
	}

	if stats.MemoryPct != 25.0 {
		t.Errorf("Expected memory percent 25.0, got %f", stats.MemoryPct)
	}

	if stats.PIDs != 10 {
		t.Errorf("Expected 10 PIDs, got %d", stats.PIDs)
	}
}

func TestCreateContainerRequest(t *testing.T) {
	req := CreateContainerRequest{
		Name:          "test-container",
		Image:         "nginx:latest",
		Ports:         []PortMapping{{HostPort: 8080, ContainerPort: 80, Protocol: "tcp"}},
		Volumes:       []VolumeMount{{Source: "/data", Target: "/app/data"}},
		Environment:   map[string]string{"ENV_VAR": "value"},
		RestartPolicy: "unless-stopped",
		HasWebUI:      true,
		WebUIPort:     80,
		AutoStart:     true,
	}

	if req.Name != "test-container" {
		t.Errorf("Expected name test-container, got %s", req.Name)
	}

	if req.Image != "nginx:latest" {
		t.Errorf("Expected image nginx:latest, got %s", req.Image)
	}

	if len(req.Ports) != 1 {
		t.Errorf("Expected 1 port mapping, got %d", len(req.Ports))
	}

	if req.RestartPolicy != "unless-stopped" {
		t.Errorf("Expected restart policy unless-stopped, got %s", req.RestartPolicy)
	}
}

func TestVolumeModel(t *testing.T) {
	vol := Volume{
		Name:       "my-volume",
		Driver:     "local",
		MountPoint: "/var/lib/containers/storage/volumes/my-volume/_data",
		Labels:     map[string]string{"app": "test"},
		Scope:      "local",
	}

	if vol.Name != "my-volume" {
		t.Errorf("Expected name my-volume, got %s", vol.Name)
	}

	if vol.Driver != "local" {
		t.Errorf("Expected driver local, got %s", vol.Driver)
	}
}

func TestNetworkModel(t *testing.T) {
	net := Network{
		ID:       "net-123",
		Name:     "my-network",
		Driver:   "bridge",
		Subnet:   "10.88.0.0/16",
		Gateway:  "10.88.0.1",
		Internal: false,
		IPv6:     false,
	}

	if net.Name != "my-network" {
		t.Errorf("Expected name my-network, got %s", net.Name)
	}

	if net.Subnet != "10.88.0.0/16" {
		t.Errorf("Expected subnet 10.88.0.0/16, got %s", net.Subnet)
	}
}

func TestAuditActionConstants(t *testing.T) {
	// Verify all action constants are defined
	actions := []string{
		ActionContainerCreate,
		ActionContainerStart,
		ActionContainerStop,
		ActionContainerRestart,
		ActionContainerRemove,
		ActionContainerUpdate,
		ActionContainerBackup,
		ActionContainerRestore,
		ActionImagePull,
		ActionImageRemove,
		ActionTemplateCreate,
		ActionTemplateDelete,
		ActionTemplateDeploy,
		ActionVolumCreate,
		ActionVolumeRemove,
		ActionNetworkCreate,
		ActionNetworkRemove,
		ActionStackCreate,
		ActionStackUpdate,
		ActionStackDelete,
		ActionStackDeploy,
		ActionStackStop,
	}

	for _, action := range actions {
		if action == "" {
			t.Error("Action constant should not be empty")
		}
	}
}
