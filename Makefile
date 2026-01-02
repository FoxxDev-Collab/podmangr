.PHONY: dev-frontend dev-backend build clean deploy test vendor package release release-linux release-all

# Binary name and Go path
BINARY_NAME := podmangr
GO := $(shell which go 2>/dev/null || echo "/usr/local/go/bin/go")
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME := $(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS := -ldflags="-s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Development
dev-frontend:
	cd podmangr-frontend && npm run dev

dev-backend:
	cd podmangr-backend && PODMANGR_USE_HTTP=true PODMANGR_PORT=8080 $(GO) run -mod=vendor .

# Build production binary (frontend + backend)
build: build-frontend build-backend
	@echo "Build complete: podmangr-backend/$(BINARY_NAME)"
	@ls -lh podmangr-backend/$(BINARY_NAME)

build-frontend:
	@echo "Building frontend..."
	cd podmangr-frontend && npm run build
	rm -rf podmangr-backend/frontend_dist
	cp -r podmangr-frontend/out podmangr-backend/frontend_dist
	@echo "Frontend built and copied to backend/frontend_dist"

build-backend:
	@echo "Building backend with embedded frontend..."
	cd podmangr-backend && CGO_ENABLED=0 $(GO) build -mod=vendor $(LDFLAGS) -o $(BINARY_NAME)
	@echo "Backend binary built: podmangr-backend/$(BINARY_NAME)"

# Clean build artifacts
clean:
	rm -rf podmangr-frontend/out
	rm -rf podmangr-frontend/.next
	rm -rf podmangr-backend/frontend_dist
	rm -f podmangr-backend/$(BINARY_NAME)
	rm -f podmangr-*.tar.gz
	mkdir -p podmangr-backend/frontend_dist
	echo '<!DOCTYPE html><html><body>Build required</body></html>' > podmangr-backend/frontend_dist/index.html
	@echo "Cleaned build artifacts"

# Create deployment package
package: build
	@echo "Creating deployment package..."
	mkdir -p dist
	cp podmangr-backend/$(BINARY_NAME) dist/
	cp scripts/install.sh dist/
	cp scripts/podmangr.service dist/
	tar -czvf podmangr-$(VERSION).tar.gz -C dist .
	rm -rf dist
	@echo "Package created: podmangr-$(VERSION).tar.gz"

# Deploy to test VM
# Usage: make deploy VM=192.168.1.100 USER=admin
deploy: package
	@echo "Deploying to $(USER)@$(VM)..."
	scp podmangr-$(VERSION).tar.gz $(USER)@$(VM):/tmp/
	ssh $(USER)@$(VM) "cd /tmp && tar -xzf podmangr-$(VERSION).tar.gz && sudo bash install.sh"
	@echo "Deployment complete!"

# Run tests
test:
	cd podmangr-backend && $(GO) test -mod=vendor ./...

# Run frontend tests
test-frontend:
	cd podmangr-frontend && npm test

# Vendor dependencies
vendor:
	cd podmangr-backend && $(GO) mod tidy && $(GO) mod vendor

# Create release tarball (single architecture - current system)
release: build
	@echo "Creating release package v$(VERSION)..."
	@mkdir -p release
	@cp podmangr-backend/$(BINARY_NAME) release/
	@cp scripts/install.sh release/
	@chmod +x release/install.sh
	@cd release && tar -czvf ../podmangr-$(VERSION)-linux-amd64.tar.gz .
	@rm -rf release
	@echo ""
	@echo "Release package created: podmangr-$(VERSION)-linux-amd64.tar.gz"
	@echo ""
	@echo "To install on a target system:"
	@echo "  1. Copy the tarball to the target machine"
	@echo "  2. Extract: tar -xzf podmangr-$(VERSION)-linux-amd64.tar.gz"
	@echo "  3. Run: sudo ./install.sh"
	@ls -lh podmangr-$(VERSION)-linux-amd64.tar.gz

# Build for Linux amd64 (cross-compile if needed)
release-linux-amd64: build-frontend
	@echo "Building for Linux amd64..."
	@mkdir -p release
	cd podmangr-backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -mod=vendor $(LDFLAGS) -o ../release/$(BINARY_NAME)
	@cp scripts/install.sh release/
	@chmod +x release/install.sh
	@cd release && tar -czvf ../podmangr-$(VERSION)-linux-amd64.tar.gz .
	@rm -rf release
	@echo "Created: podmangr-$(VERSION)-linux-amd64.tar.gz"

# Build for Linux arm64
release-linux-arm64: build-frontend
	@echo "Building for Linux arm64..."
	@mkdir -p release
	cd podmangr-backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build -mod=vendor $(LDFLAGS) -o ../release/$(BINARY_NAME)
	@cp scripts/install.sh release/
	@chmod +x release/install.sh
	@cd release && tar -czvf ../podmangr-$(VERSION)-linux-arm64.tar.gz .
	@rm -rf release
	@echo "Created: podmangr-$(VERSION)-linux-arm64.tar.gz"

# Build all release packages
release-all: build-frontend
	@echo "Building all release packages for v$(VERSION)..."
	@$(MAKE) release-linux-amd64
	@$(MAKE) release-linux-arm64
	@echo ""
	@echo "All release packages created:"
	@ls -lh podmangr-$(VERSION)-*.tar.gz

# Show version
version:
	@echo "Version: $(VERSION)"
	@echo "Build time: $(BUILD_TIME)"

# Help target
help:
	@echo "Podmangr Build System"
	@echo ""
	@echo "Development:"
	@echo "  make dev-frontend    - Run Next.js dev server (port 3000)"
	@echo "  make dev-backend     - Run Go backend in dev mode (port 8080)"
	@echo ""
	@echo "Build:"
	@echo "  make build           - Build production binary (frontend + backend)"
	@echo "  make build-frontend  - Build frontend only"
	@echo "  make build-backend   - Build backend only"
	@echo "  make clean           - Remove build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  make release         - Create release tarball for current system"
	@echo "  make release-linux-amd64 - Create Linux amd64 release"
	@echo "  make release-linux-arm64 - Create Linux arm64 release"
	@echo "  make release-all     - Create all release packages"
	@echo ""
	@echo "Testing:"
	@echo "  make test            - Run backend tests"
	@echo "  make test-frontend   - Run frontend tests"
	@echo ""
	@echo "Deployment:"
	@echo "  make package         - Create deployment package"
	@echo "  make deploy VM=x.x.x.x USER=admin - Deploy to remote VM"
	@echo ""
	@echo "Other:"
	@echo "  make vendor          - Update Go vendor dependencies"
	@echo "  make version         - Show version info"
	@echo "  make help            - Show this help"
