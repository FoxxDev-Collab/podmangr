/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// API functions to test
const API_BASE = "/api";

// Helper to make authenticated requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  token: string | null = null
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

describe("API Functions", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("apiRequest", () => {
    it("should make a request to the correct endpoint", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await apiRequest("/containers");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/containers",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should include authorization header when token is provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await apiRequest("/containers", {}, "test-token");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/containers",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should pass custom options to fetch", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await apiRequest(
        "/containers",
        {
          method: "POST",
          body: JSON.stringify({ name: "test" }),
        },
        "test-token"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/containers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "test" }),
        })
      );
    });
  });
});

describe("Container API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list containers", async () => {
    const mockContainers = [
      { id: "1", name: "container-1", status: "running" },
      { id: "2", name: "container-2", status: "stopped" },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockContainers),
    });

    const response = await apiRequest("/containers", {}, mockToken);
    const data = await response.json();

    expect(data).toEqual(mockContainers);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/containers",
      expect.any(Object)
    );
  });

  it("should create a container", async () => {
    const newContainer = {
      name: "new-container",
      image: "nginx:latest",
      ports: [{ host_port: 8080, container_port: 80, protocol: "tcp" }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: "new-id", ...newContainer, status: "created" }),
    });

    const response = await apiRequest(
      "/containers",
      {
        method: "POST",
        body: JSON.stringify(newContainer),
      },
      mockToken
    );
    const data = await response.json();

    expect(data.name).toBe("new-container");
    expect(data.image).toBe("nginx:latest");
  });

  it("should handle container actions (start/stop/restart)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "running" }),
    });

    const response = await apiRequest(
      "/containers/123/start",
      { method: "POST" },
      mockToken
    );
    expect(response.ok).toBe(true);
  });
});

describe("Pod API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list pods", async () => {
    const mockPods = [
      { id: "pod-1", name: "my-pod", containers: 3, status: "Running" },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPods),
    });

    const response = await apiRequest("/pods", {}, mockToken);
    const data = await response.json();

    expect(data).toEqual(mockPods);
  });

  it("should create a pod", async () => {
    const newPod = {
      name: "test-pod",
      ports: [{ host_port: 8080, container_port: 80, protocol: "tcp" }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "pod-id", ...newPod, status: "Created" }),
    });

    const response = await apiRequest(
      "/pods",
      {
        method: "POST",
        body: JSON.stringify(newPod),
      },
      mockToken
    );
    const data = await response.json();

    expect(data.name).toBe("test-pod");
  });
});

describe("Image API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list images", async () => {
    const mockImages = [
      { id: "sha256:abc", repository: "nginx", tag: "latest", size: 142000000 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockImages),
    });

    const response = await apiRequest("/images", {}, mockToken);
    const data = await response.json();

    expect(data).toEqual(mockImages);
  });

  it("should pull an image", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "pulling" }),
    });

    const response = await apiRequest(
      "/images/pull",
      {
        method: "POST",
        body: JSON.stringify({ image: "nginx:latest" }),
      },
      mockToken
    );

    expect(response.ok).toBe(true);
  });
});

describe("Volume API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list volumes", async () => {
    const mockVolumes = [
      { name: "data-vol", driver: "local", mount_point: "/var/lib/containers/storage/volumes/data-vol" },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockVolumes),
    });

    const response = await apiRequest("/volumes", {}, mockToken);
    const data = await response.json();

    expect(data).toEqual(mockVolumes);
  });

  it("should create a volume", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: "new-volume", driver: "local" }),
    });

    const response = await apiRequest(
      "/volumes",
      {
        method: "POST",
        body: JSON.stringify({ name: "new-volume" }),
      },
      mockToken
    );
    const data = await response.json();

    expect(data.name).toBe("new-volume");
  });
});

describe("Network API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list networks", async () => {
    const mockNetworks = [
      { id: "net-1", name: "podman", driver: "bridge", subnet: "10.88.0.0/16" },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNetworks),
    });

    const response = await apiRequest("/podman-networks", {}, mockToken);
    const data = await response.json();

    expect(data).toEqual(mockNetworks);
  });

  it("should create a network", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "net-new", name: "my-network", driver: "bridge" }),
    });

    const response = await apiRequest(
      "/podman-networks",
      {
        method: "POST",
        body: JSON.stringify({ name: "my-network", subnet: "10.90.0.0/16" }),
      },
      mockToken
    );
    const data = await response.json();

    expect(data.name).toBe("my-network");
  });
});

describe("Authentication API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should login successfully", async () => {
    const mockResponse = {
      token: "jwt-token-here",
      user: { id: 1, username: "admin", role: "admin" },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password" }),
    });
    const data = await response.json();

    expect(data.token).toBe("jwt-token-here");
    expect(data.user.username).toBe("admin");
  });

  it("should handle login failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid credentials" }),
    });

    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });

    expect(response.ok).toBe(false);
  });

  it("should logout successfully", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Logged out" }),
    });

    const response = await apiRequest(
      "/auth/logout",
      { method: "POST" },
      "test-token"
    );

    expect(response.ok).toBe(true);
  });
});

describe("System API", () => {
  const mockToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get system resources", async () => {
    const mockResources = {
      cpu_percent: 25.5,
      memory_used: 4294967296,
      memory_total: 17179869184,
      disk_used: 100000000000,
      disk_total: 500000000000,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResources),
    });

    const response = await apiRequest("/system/resources", {}, mockToken);
    const data = await response.json();

    expect(data.cpu_percent).toBe(25.5);
    expect(data.memory_total).toBe(17179869184);
  });

  it("should list services", async () => {
    const mockServices = [
      { name: "podman.service", status: "running", enabled: true },
      { name: "sshd.service", status: "running", enabled: true },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockServices),
    });

    const response = await apiRequest("/services", {}, mockToken);
    const data = await response.json();

    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("podman.service");
  });

  it("should list processes", async () => {
    const mockProcesses = [
      { pid: 1, name: "systemd", cpu: 0.1, memory: 0.5 },
      { pid: 1000, name: "podmangr", cpu: 2.5, memory: 1.2 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProcesses),
    });

    const response = await apiRequest("/processes", {}, mockToken);
    const data = await response.json();

    expect(data).toHaveLength(2);
  });
});
