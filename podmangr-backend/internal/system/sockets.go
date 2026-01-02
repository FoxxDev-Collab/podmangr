package system

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"strconv"
	"strings"
	"sync"
)

// PodmanSocket represents an available Podman socket
type PodmanSocket struct {
	ID         string `json:"id"`          // Unique identifier: "root" or "user:{username}"
	Path       string `json:"path"`        // Full socket path
	User       string `json:"user"`        // Username ("root" for system socket)
	UID        int    `json:"uid"`         // User ID (0 for root)
	Mode       string `json:"mode"`        // "rootful" or "rootless"
	Accessible bool   `json:"accessible"`  // Can current process access this socket
	Active     bool   `json:"active"`      // Is this the currently active socket
}

// SocketRegistry manages multiple Podman services for different sockets
type SocketRegistry struct {
	services      map[string]*PodmanService
	currentSocket string
	mu            sync.RWMutex
}

// Global socket registry
var socketRegistry *SocketRegistry
var registryOnce sync.Once

// GetSocketRegistry returns the singleton socket registry
func GetSocketRegistry() *SocketRegistry {
	registryOnce.Do(func() {
		socketRegistry = &SocketRegistry{
			services:      make(map[string]*PodmanService),
			currentSocket: "",
		}
		// Initialize with discovered sockets
		socketRegistry.initializeSockets()
	})
	return socketRegistry
}

// initializeSockets discovers and initializes available sockets
func (r *SocketRegistry) initializeSockets() {
	sockets := DiscoverSockets()

	for _, socket := range sockets {
		if socket.Accessible {
			var svc *PodmanService
			if socket.Mode == "rootful" {
				svc = &PodmanService{targetUser: ""}
			} else {
				svc = NewPodmanServiceWithUser(socket.User)
			}
			r.services[socket.ID] = svc

			// Set first accessible socket as current if none set
			if r.currentSocket == "" {
				r.currentSocket = socket.ID
			}
		}
	}

	// If still no socket, try the default
	if r.currentSocket == "" {
		r.services["default"] = NewPodmanService()
		r.currentSocket = "default"
	}
}

// GetCurrentService returns the currently active PodmanService
func (r *SocketRegistry) GetCurrentService() *PodmanService {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if svc, ok := r.services[r.currentSocket]; ok {
		return svc
	}

	// Fallback to default service
	return NewPodmanService()
}

// GetCurrentSocketID returns the ID of the currently active socket
func (r *SocketRegistry) GetCurrentSocketID() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.currentSocket
}

// SwitchSocket changes the active Podman socket
func (r *SocketRegistry) SwitchSocket(socketID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.services[socketID]; !ok {
		return fmt.Errorf("socket not found: %s", socketID)
	}

	r.currentSocket = socketID
	return nil
}

// GetService returns a PodmanService for a specific socket ID
func (r *SocketRegistry) GetService(socketID string) (*PodmanService, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if svc, ok := r.services[socketID]; ok {
		return svc, nil
	}
	return nil, fmt.Errorf("socket not found: %s", socketID)
}

// ListSockets returns all discovered sockets with their status
func (r *SocketRegistry) ListSockets() []PodmanSocket {
	r.mu.RLock()
	currentID := r.currentSocket
	r.mu.RUnlock()

	sockets := DiscoverSockets()

	// Mark the current socket as active
	for i := range sockets {
		sockets[i].Active = sockets[i].ID == currentID
	}

	return sockets
}

// RefreshSockets re-discovers available sockets
func (r *SocketRegistry) RefreshSockets() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Remember current socket
	currentSocket := r.currentSocket

	// Re-discover
	sockets := DiscoverSockets()
	r.services = make(map[string]*PodmanService)

	for _, socket := range sockets {
		if socket.Accessible {
			var svc *PodmanService
			if socket.Mode == "rootful" {
				svc = &PodmanService{targetUser: ""}
			} else {
				svc = NewPodmanServiceWithUser(socket.User)
			}
			r.services[socket.ID] = svc
		}
	}

	// Try to restore current socket, or pick first available
	if _, ok := r.services[currentSocket]; ok {
		r.currentSocket = currentSocket
	} else if len(r.services) > 0 {
		for id := range r.services {
			r.currentSocket = id
			break
		}
	}
}

// DiscoverSockets finds all available Podman sockets on the system
func DiscoverSockets() []PodmanSocket {
	var sockets []PodmanSocket

	// Check root/system socket
	rootSocketPath := "/run/podman/podman.sock"
	if _, err := os.Stat(rootSocketPath); err == nil {
		sockets = append(sockets, PodmanSocket{
			ID:         "root",
			Path:       rootSocketPath,
			User:       "root",
			UID:        0,
			Mode:       "rootful",
			Accessible: isSocketAccessible(rootSocketPath),
		})
	}

	// Check rootless sockets in /run/user/*/podman/podman.sock
	entries, err := os.ReadDir("/run/user")
	if err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			socketPath := fmt.Sprintf("/run/user/%s/podman/podman.sock", entry.Name())
			if _, err := os.Stat(socketPath); err != nil {
				continue
			}

			uid, err := strconv.Atoi(entry.Name())
			if err != nil {
				continue
			}

			// Get username for this UID
			username := getUsernameForUID(uid)
			if username == "" {
				continue
			}

			sockets = append(sockets, PodmanSocket{
				ID:         fmt.Sprintf("user:%s", username),
				Path:       socketPath,
				User:       username,
				UID:        uid,
				Mode:       "rootless",
				Accessible: isSocketAccessibleForUser(socketPath, username),
			})
		}
	}

	return sockets
}

// isSocketAccessible checks if the current process can access the socket
func isSocketAccessible(path string) bool {
	// Check if we can stat the socket
	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	// Check if it's a socket
	if info.Mode()&os.ModeSocket == 0 {
		return false
	}

	// Try to actually access it - for root socket, we need to be root or have permissions
	if os.Getuid() == 0 {
		return true
	}

	// For non-root, check if we can access the file
	file, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return false
	}
	file.Close()
	return true
}

// isSocketAccessibleForUser checks if we can access a user's socket
// When running as root, we can sudo to any user
func isSocketAccessibleForUser(path string, username string) bool {
	// If running as root, we can sudo to any user
	if os.Getuid() == 0 {
		return true
	}

	// Check if current user matches
	currentUser, err := user.Current()
	if err != nil {
		return false
	}

	if currentUser.Username == username {
		return isSocketAccessible(path)
	}

	return false
}

// getUsernameForUID returns the username for a given UID
func getUsernameForUID(uid int) string {
	cmd := exec.Command("getent", "passwd", fmt.Sprintf("%d", uid))
	output, err := cmd.Output()
	if err != nil {
		return ""
	}

	// Parse passwd entry: username:x:uid:gid:...
	parts := strings.Split(strings.TrimSpace(string(output)), ":")
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}

	return ""
}
