#!/bin/bash
# Podmangr Installation Script
# Run as root or with sudo
#
# Usage:
#   Interactive:  sudo ./install.sh
#   With options: sudo ./install.sh --port 8443 --https
#                 sudo ./install.sh --port 8080 --http
#                 sudo ./install.sh -p 443 -y
#
# Options:
#   -p, --port PORT    Set the port number (default: 443)
#   --https            Use HTTPS (default for most ports)
#   --http             Use HTTP (no encryption)
#   -y, --yes          Skip confirmations (auto-install Podman if missing)
#   -h, --help         Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/podmangr"
DATA_DIR="/var/lib/podmangr"
BINARY_NAME="podmangr"
DEFAULT_PORT=443

# CLI arguments
CLI_PORT=""
CLI_PROTOCOL=""
AUTO_YES=false

# Detect the script's directory (where the extracted files are)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Show help
show_help() {
    echo "Podmangr Installation Script"
    echo ""
    echo "Usage:"
    echo "  sudo ./install.sh [options]"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT    Set the port number (default: 443)"
    echo "  --https            Use HTTPS with self-signed certificate"
    echo "  --http             Use HTTP (no encryption)"
    echo "  -y, --yes          Skip confirmations (auto-install dependencies)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo ./install.sh                    # Interactive installation"
    echo "  sudo ./install.sh -p 443 -y          # Non-interactive, HTTPS on 443"
    echo "  sudo ./install.sh --port 8080 --http # HTTP on port 8080"
    echo "  sudo ./install.sh -p 8443 --https    # HTTPS on port 8443"
    exit 0
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--port)
                CLI_PORT="$2"
                shift 2
                ;;
            --https)
                CLI_PROTOCOL="https"
                shift
                ;;
            --http)
                CLI_PROTOCOL="http"
                shift
                ;;
            -y|--yes)
                AUTO_YES=true
                shift
                ;;
            -h|--help)
                show_help
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Validate port if provided
    if [ -n "$CLI_PORT" ]; then
        if ! [[ "$CLI_PORT" =~ ^[0-9]+$ ]] || [ "$CLI_PORT" -lt 1 ] || [ "$CLI_PORT" -gt 65535 ]; then
            echo -e "${RED}Invalid port number: $CLI_PORT${NC}"
            exit 1
        fi
    fi
}

# Print banner
print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ____           _                                   "
    echo " |  _ \ ___   __| |_ __ ___   __ _ _ __   __ _ _ __  "
    echo " | |_) / _ \ / _\` | '_ \` _ \ / _\` | '_ \ / _\` | '__| "
    echo " |  __/ (_) | (_| | | | | | | (_| | | | | (_| | |    "
    echo " |_|   \___/ \__,_|_| |_| |_|\__,_|_| |_|\__, |_|    "
    echo "                                         |___/       "
    echo -e "${NC}"
    echo -e "${CYAN}  Podman deserves better tooling.${NC}"
    echo ""
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Please run as root or with sudo${NC}"
        exit 1
    fi
}

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

# Interactive port selection (skipped if CLI args provided)
select_port() {
    # If port was provided via CLI, use it
    if [ -n "$CLI_PORT" ]; then
        SELECTED_PORT=$CLI_PORT
        # Determine protocol
        if [ "$CLI_PROTOCOL" = "http" ]; then
            USE_HTTPS=false
        elif [ "$CLI_PROTOCOL" = "https" ]; then
            USE_HTTPS=true
        else
            # Auto-detect based on port
            if [ "$CLI_PORT" -eq 80 ] || [ "$CLI_PORT" -eq 8080 ]; then
                USE_HTTPS=false
            else
                USE_HTTPS=true
            fi
        fi
        echo ""
        if [ "$USE_HTTPS" = true ]; then
            echo -e "${GREEN}Using port ${BOLD}$SELECTED_PORT${NC}${GREEN} with HTTPS${NC}"
        else
            echo -e "${YELLOW}Using port ${BOLD}$SELECTED_PORT${NC}${YELLOW} with HTTP${NC}"
        fi
        return
    fi

    echo ""
    echo -e "${BOLD}Select the port for Podmangr web interface:${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} 443   - Standard HTTPS (recommended, requires root)"
    echo -e "  ${GREEN}2)${NC} 8443  - Alternative HTTPS port"
    echo -e "  ${GREEN}3)${NC} 8080  - HTTP only (no encryption, for testing)"
    echo -e "  ${GREEN}4)${NC} Custom port"
    echo ""

    while true; do
        read -p "Enter your choice [1-4] (default: 1): " port_choice
        port_choice=${port_choice:-1}

        case $port_choice in
            1)
                SELECTED_PORT=443
                USE_HTTPS=true
                break
                ;;
            2)
                SELECTED_PORT=8443
                USE_HTTPS=true
                break
                ;;
            3)
                SELECTED_PORT=8080
                USE_HTTPS=false
                break
                ;;
            4)
                read -p "Enter custom port number (1-65535): " custom_port
                if [[ "$custom_port" =~ ^[0-9]+$ ]] && [ "$custom_port" -ge 1 ] && [ "$custom_port" -le 65535 ]; then
                    SELECTED_PORT=$custom_port
                    if [ "$custom_port" -eq 80 ] || [ "$custom_port" -eq 8080 ]; then
                        USE_HTTPS=false
                    else
                        echo ""
                        echo -e "  ${GREEN}1)${NC} HTTPS (encrypted, self-signed certificate)"
                        echo -e "  ${GREEN}2)${NC} HTTP  (no encryption)"
                        read -p "Use HTTPS? [1-2] (default: 1): " https_choice
                        https_choice=${https_choice:-1}
                        if [ "$https_choice" = "2" ]; then
                            USE_HTTPS=false
                        else
                            USE_HTTPS=true
                        fi
                    fi
                    break
                else
                    echo -e "${RED}Invalid port number. Please enter a number between 1 and 65535.${NC}"
                fi
                ;;
            *)
                echo -e "${RED}Invalid choice. Please enter 1, 2, 3, or 4.${NC}"
                ;;
        esac
    done

    echo ""
    if [ "$USE_HTTPS" = true ]; then
        echo -e "${GREEN}Selected: Port ${BOLD}$SELECTED_PORT${NC}${GREEN} with HTTPS${NC}"
    else
        echo -e "${YELLOW}Selected: Port ${BOLD}$SELECTED_PORT${NC}${YELLOW} with HTTP (no encryption)${NC}"
    fi
}

# Generate systemd service file with selected port
generate_service_file() {
    local port=$1
    local use_http=$2

    cat > /etc/systemd/system/podmangr.service << EOF
[Unit]
Description=Podmangr - Podman Container Management
Documentation=https://github.com/podmangr/podmangr
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root

# Working directory and binary
WorkingDirectory=/var/lib/podmangr
ExecStart=/opt/podmangr/podmangr

# Environment variables
Environment=PODMANGR_DB_PATH=/var/lib/podmangr/podmangr.db
Environment=PODMANGR_CERT_DIR=/var/lib/podmangr/certs
Environment=PODMANGR_PORT=$port
EOF

    if [ "$use_http" = true ]; then
        echo "Environment=PODMANGR_USE_HTTP=true" >> /etc/systemd/system/podmangr.service
    fi

    cat >> /etc/systemd/system/podmangr.service << EOF

# Restart policy
Restart=always
RestartSec=5

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=podmangr

[Install]
WantedBy=multi-user.target
EOF
}

# Configure firewall
configure_firewall() {
    local port=$1

    if systemctl is-active --quiet firewalld; then
        echo "Configuring firewall for port $port..."
        firewall-cmd --permanent --add-port=${port}/tcp 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        echo -e "${GREEN}Firewall configured for port $port${NC}"
    elif command -v ufw &> /dev/null && ufw status | grep -q "active"; then
        echo "Configuring UFW firewall for port $port..."
        ufw allow ${port}/tcp 2>/dev/null || true
        echo -e "${GREEN}UFW firewall configured for port $port${NC}"
    else
        echo -e "${YELLOW}No active firewall detected. You may need to manually open port $port.${NC}"
    fi
}

# Show configuration summary
show_summary() {
    local port=$1
    local use_https=$2
    local ip_addr

    ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$ip_addr" ]; then
        ip_addr="your-server-ip"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}======================================${NC}"
    echo -e "${GREEN}${BOLD}  Installation Complete!${NC}"
    echo -e "${GREEN}${BOLD}======================================${NC}"
    echo ""

    if [ "$use_https" = true ]; then
        echo -e "  Access Podmangr at: ${BOLD}${GREEN}https://${ip_addr}:${port}${NC}"
        if [ "$port" = "443" ]; then
            echo -e "                  or: ${BOLD}${GREEN}https://${ip_addr}${NC}"
        fi
        echo ""
        echo -e "  ${YELLOW}Note: A self-signed certificate will be generated on first run.${NC}"
        echo -e "  ${YELLOW}You'll need to accept the certificate warning in your browser.${NC}"
    else
        echo -e "  Access Podmangr at: ${BOLD}${GREEN}http://${ip_addr}:${port}${NC}"
        echo ""
        echo -e "  ${RED}Warning: Running without encryption. Use only on trusted networks.${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}Authentication:${NC}"
    echo "  Login with your system credentials (PAM authentication)"
    echo "  Users in the 'wheel' or 'sudo' group have admin access."
    echo ""
    echo -e "  ${BOLD}Service commands:${NC}"
    echo "    systemctl status podmangr    - Check service status"
    echo "    systemctl restart podmangr   - Restart service"
    echo "    systemctl stop podmangr      - Stop service"
    echo "    journalctl -u podmangr -f    - View live logs"
    echo ""
    echo -e "  ${BOLD}Configuration:${NC}"
    echo "    Binary:     /opt/podmangr/podmangr"
    echo "    Data:       /var/lib/podmangr/"
    echo "    Database:   /var/lib/podmangr/podmangr.db"
    echo "    Certs:      /var/lib/podmangr/certs/"
    echo ""
}

# Main installation
main() {
    # Parse command line arguments first
    parse_args "$@"

    print_banner
    check_root

    echo -e "${YELLOW}Starting Podmangr installation...${NC}"
    echo ""

    # Check if Podman is installed, offer to install if not
    if ! command -v podman &> /dev/null; then
        echo -e "${YELLOW}Podman is not installed.${NC}"
        if [ "$AUTO_YES" = true ]; then
            echo "Auto-installing Podman and podman-compose..."
            install_podman_deps
        else
            read -p "Would you like to install Podman and podman-compose? [Y/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                install_podman_deps
            fi
        fi
    elif ! command -v podman-compose &> /dev/null; then
        echo -e "${YELLOW}podman-compose is not installed.${NC}"
        if [ "$AUTO_YES" = true ]; then
            echo "Auto-installing podman-compose..."
            install_podman_deps
        else
            read -p "Would you like to install podman-compose? [Y/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                install_podman_deps
            fi
        fi
    else
        echo -e "${GREEN}Podman and podman-compose are already installed${NC}"
    fi

    # Interactive port selection
    select_port

    # Create directories
    echo ""
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

    # Generate and install systemd service with selected port
    echo "Installing systemd service (port: $SELECTED_PORT)..."
    if [ "$USE_HTTPS" = true ]; then
        generate_service_file "$SELECTED_PORT" false
    else
        generate_service_file "$SELECTED_PORT" true
    fi
    systemctl daemon-reload

    # Set ownership
    chown -R root:root "$DATA_DIR"
    chown root:root "$INSTALL_DIR/$BINARY_NAME"

    # Configure firewall
    configure_firewall "$SELECTED_PORT"

    # Enable and start service
    echo "Enabling and starting Podmangr service..."
    systemctl enable podmangr
    systemctl start podmangr

    # Wait a moment and check status
    sleep 2
    if systemctl is-active --quiet podmangr; then
        show_summary "$SELECTED_PORT" "$USE_HTTPS"
    else
        echo -e "${RED}Service failed to start. Check logs with:${NC}"
        echo "  journalctl -u podmangr -n 50"
        exit 1
    fi
}

# Run main function
main "$@"
