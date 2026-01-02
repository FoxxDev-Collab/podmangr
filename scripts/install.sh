#!/bin/bash
# Podmangr Installation Script
# Run as root or with sudo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}  Podmangr Installation${NC}"
echo -e "${CYAN}  Podman deserves better tooling${NC}"
echo -e "${CYAN}================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/podmangr"
DATA_DIR="/var/lib/podmangr"
BINARY_NAME="podmangr"

# Detect the script's directory (where the extracted files are)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to detect package manager
detect_package_manager() {
    if command -v dnf &> /dev/null; then
        echo "dnf"
    elif command -v yum &> /dev/null; then
        echo "yum"
    elif command -v apt-get &> /dev/null; then
        echo "apt"
    else
        echo "unknown"
    fi
}

# Function to install Podman dependencies
install_podman_deps() {
    PKG_MANAGER=$(detect_package_manager)

    echo -e "${YELLOW}Installing Podman and dependencies...${NC}"

    case $PKG_MANAGER in
        dnf|yum)
            # Install EPEL repository for podman-compose (RHEL/CentOS/Rocky/Alma)
            if [ -f /etc/redhat-release ]; then
                echo "Installing EPEL repository..."
                $PKG_MANAGER install -y epel-release 2>/dev/null || true
            fi

            # Install Podman and podman-compose
            echo "Installing Podman..."
            $PKG_MANAGER install -y podman

            echo "Installing podman-compose..."
            $PKG_MANAGER install -y podman-compose 2>/dev/null || {
                echo -e "${YELLOW}podman-compose not available via package manager, trying pip...${NC}"
                # Fallback to pip if package not available
                if command -v pip3 &> /dev/null; then
                    pip3 install podman-compose
                elif command -v pip &> /dev/null; then
                    pip install podman-compose
                else
                    echo -e "${YELLOW}Warning: Could not install podman-compose. Stack deployment may not work.${NC}"
                fi
            }
            ;;
        apt)
            # Debian/Ubuntu
            apt-get update
            apt-get install -y podman

            # podman-compose on Debian/Ubuntu
            apt-get install -y podman-compose 2>/dev/null || {
                echo -e "${YELLOW}podman-compose not available via apt, trying pip...${NC}"
                apt-get install -y python3-pip
                pip3 install podman-compose
            }
            ;;
        *)
            echo -e "${YELLOW}Unknown package manager. Please install Podman and podman-compose manually.${NC}"
            ;;
    esac

    # Verify installation
    if command -v podman &> /dev/null; then
        PODMAN_VERSION=$(podman --version 2>/dev/null | head -1)
        echo -e "${GREEN}Podman installed: $PODMAN_VERSION${NC}"
    else
        echo -e "${RED}Warning: Podman installation may have failed${NC}"
    fi

    if command -v podman-compose &> /dev/null; then
        COMPOSE_VERSION=$(podman-compose --version 2>/dev/null | head -1)
        echo -e "${GREEN}podman-compose installed: $COMPOSE_VERSION${NC}"
    else
        echo -e "${YELLOW}Warning: podman-compose not found. Stack deployment features may be limited.${NC}"
    fi
}

echo -e "${YELLOW}Installing Podmangr...${NC}"

# Check if Podman is installed, offer to install if not
if ! command -v podman &> /dev/null; then
    echo -e "${YELLOW}Podman is not installed.${NC}"
    read -p "Would you like to install Podman and podman-compose? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        install_podman_deps
    fi
elif ! command -v podman-compose &> /dev/null; then
    echo -e "${YELLOW}podman-compose is not installed.${NC}"
    read -p "Would you like to install podman-compose? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        install_podman_deps
    fi
else
    echo -e "${GREEN}Podman and podman-compose are already installed${NC}"
fi

# Create directories
echo "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/certs"
mkdir -p "$DATA_DIR/stacks"
mkdir -p "$DATA_DIR/backups"

# Stop existing service if running
if systemctl is-active --quiet podmangr; then
    echo "Stopping existing Podmangr service..."
    systemctl stop podmangr
fi

# Copy binary
echo "Installing binary..."
cp "$SCRIPT_DIR/$BINARY_NAME" "$INSTALL_DIR/"
chmod 755 "$INSTALL_DIR/$BINARY_NAME"

# Install systemd service
echo "Installing systemd service..."
cp "$SCRIPT_DIR/podmangr.service" /etc/systemd/system/
systemctl daemon-reload

# Set ownership
chown -R root:root "$DATA_DIR"
chown root:root "$INSTALL_DIR/$BINARY_NAME"

# Configure firewall if firewalld is running
if systemctl is-active --quiet firewalld; then
    echo "Configuring firewall..."
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

# Enable and start service
echo "Enabling and starting Podmangr service..."
systemctl enable podmangr
systemctl start podmangr

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet podmangr; then
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "Access Podmangr at: ${GREEN}https://$(hostname -I | awk '{print $1}')${NC}"
    echo ""
    echo "Login with your system credentials (PAM authentication)"
    echo "Users in the 'wheel' or 'sudo' group have admin access."
    echo ""
    echo "Service commands:"
    echo "  systemctl status podmangr"
    echo "  systemctl restart podmangr"
    echo "  journalctl -u podmangr -f"
else
    echo -e "${RED}Service failed to start. Check logs with:${NC}"
    echo "  journalctl -u podmangr -n 50"
    exit 1
fi
