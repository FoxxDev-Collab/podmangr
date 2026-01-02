#!/bin/bash
# Podmangr Installation Script
# Run as root or with sudo

set -e

INSTALL_DIR="/opt/podmangr"
DATA_DIR="/var/lib/podmangr"
CONFIG_DIR="/etc/podmangr"
SERVICE_FILE="/etc/systemd/system/podmangr.service"

echo "=== Podmangr Installation ==="
echo "Podman deserves better tooling"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root or with sudo"
    exit 1
fi

# Check if binary exists in current directory
if [ ! -f "./podmangr" ]; then
    echo "Error: podmangr binary not found in current directory"
    echo "Please build the project first: make build"
    exit 1
fi

# Create directories
echo "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/certs"
mkdir -p "$DATA_DIR/backups"
mkdir -p "$CONFIG_DIR"

# Copy binary
echo "Installing binary..."
cp ./podmangr "$INSTALL_DIR/podmangr"
chmod 755 "$INSTALL_DIR/podmangr"

# Copy environment file if it doesn't exist
if [ ! -f "$CONFIG_DIR/podmangr.env" ]; then
    echo "Creating default configuration..."
    cp ./deploy/podmangr.env.example "$CONFIG_DIR/podmangr.env"
    chmod 600 "$CONFIG_DIR/podmangr.env"
fi

# Install systemd service
echo "Installing systemd service..."
cp ./deploy/podmangr.service "$SERVICE_FILE"
chmod 644 "$SERVICE_FILE"

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable service
echo "Enabling service..."
systemctl enable podmangr

echo ""
echo "=== Installation Complete ==="
echo ""
echo "To start Podmangr:"
echo "  systemctl start podmangr"
echo ""
echo "To check status:"
echo "  systemctl status podmangr"
echo ""
echo "To view logs:"
echo "  journalctl -u podmangr -f"
echo ""
echo "Configuration file: $CONFIG_DIR/podmangr.env"
echo "Database location:  $DATA_DIR/podmangr.db"
echo "Web interface:      https://localhost (port 443)"
echo ""
echo "Login with your system credentials (PAM authentication)"
echo "Users in the 'wheel' or 'sudo' group have admin access."
