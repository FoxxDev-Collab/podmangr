.PHONY: dev-frontend dev-backend build clean deploy test vendor package

# Binary name
BINARY_NAME := podmangr
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME := $(shell date -u '+%Y-%m-%d_%H:%M:%S')

# Development
dev-frontend:
	cd podmangr-frontend && npm run dev

dev-backend:
	cd podmangr-backend && PODMANGR_USE_HTTP=true PODMANGR_PORT=8080 go run -mod=vendor .

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
	cd podmangr-backend && go build -mod=vendor -ldflags="-s -w" -o $(BINARY_NAME)
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
	cd podmangr-backend && go test -mod=vendor ./...

# Run frontend tests
test-frontend:
	cd podmangr-frontend && npm test

# Vendor dependencies
vendor:
	cd podmangr-backend && go mod tidy && go mod vendor
