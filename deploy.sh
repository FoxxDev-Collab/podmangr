#!/bin/bash

# Podmangr Full Deployment Script
# This script builds the frontend, copies it to backend, rebuilds the Go binary, and restarts the service

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/podmangr-frontend"
BACKEND_DIR="$SCRIPT_DIR/podmangr-backend"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Podmangr Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Step 1: Build Frontend
echo -e "${YELLOW}[1/5] Building frontend...${NC}"
cd "$FRONTEND_DIR"
if npm run build; then
    echo -e "${GREEN}✓ Frontend build successful${NC}"
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    exit 1
fi
echo

# Step 2: Copy to Backend
echo -e "${YELLOW}[2/5] Copying frontend to backend...${NC}"
rm -rf "$BACKEND_DIR/frontend_dist"/*
cp -r "$FRONTEND_DIR/out"/* "$BACKEND_DIR/frontend_dist/"
echo -e "${GREEN}✓ Frontend copied to backend${NC}"
echo

# Step 3: Rebuild Backend
echo -e "${YELLOW}[3/5] Building backend binary...${NC}"
cd "$BACKEND_DIR"
if /usr/local/go/bin/go build -o podmangr; then
    echo -e "${GREEN}✓ Backend build successful${NC}"
else
    echo -e "${RED}✗ Backend build failed${NC}"
    exit 1
fi
echo

# Step 4: Check if systemd service exists
echo -e "${YELLOW}[4/5] Checking service configuration...${NC}"
if systemctl list-unit-files | grep -q "podmangr.service"; then
    SERVICE_EXISTS=true
    echo -e "${GREEN}✓ Systemd service detected${NC}"
else
    SERVICE_EXISTS=false
    echo -e "${YELLOW}⚠ No systemd service found${NC}"
fi
echo

# Step 5: Restart Service
echo -e "${YELLOW}[5/5] Restarting service...${NC}"
if [ "$SERVICE_EXISTS" = true ]; then
    echo -e "${BLUE}Restarting podmangr.service...${NC}"
    sudo systemctl restart podmangr.service
    sleep 2
    if systemctl is-active --quiet podmangr.service; then
        echo -e "${GREEN}✓ Service restarted successfully${NC}"
        echo
        echo -e "${BLUE}Service status:${NC}"
        systemctl status podmangr.service --no-pager -l | head -n 10
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo -e "${YELLOW}Check logs with: sudo journalctl -u podmangr.service -n 50${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Manual restart required:${NC}"
    echo -e "  cd $BACKEND_DIR"
    echo -e "  sudo ./podmangr"
fi

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
