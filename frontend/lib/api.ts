const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  projects_count?: number;
}

export interface Project {
  id: string;
  space_id: string;
  name: string;
  description?: string;
  goal?: string;
  created_at: string;
  document_count?: number;
  concept_count?: number;
  average_mastery?: number;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  public setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
  }

  public removeToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.removeToken();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Network request failed" }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: { email: string; password: string; full_name?: string }) {
    return this.request<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ access_token: string; user: User }>("/auth/login/json", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  // Spaces endpoints
  async listSpaces(): Promise<Space[]> {
    return this.request<Space[]>("/spaces");
  }

  async createSpace(data: { name: string; description?: string }): Promise<Space> {
    return this.request<Space>("/spaces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSpace(id: string): Promise<Space & { projects: Project[] }> {
    return this.request<Space & { projects: Project[] }>(`/spaces/${id}`);
  }

  async deleteSpace(id: string): Promise<void> {
    return this.request<void>(`/spaces/${id}`, { method: "DELETE" });
  }

  // Projects endpoints
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects");
  }

  async createProject(data: { space_id: string; name: string; description?: string; goal?: string }): Promise<Project> {
    return this.request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`);
  }

  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/projects/${id}`, { method: "DELETE" });
  }

  // Materials endpoints
  async uploadDocument(projectId: string, file: File): Promise<any> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return response.json();
  }

  async listDocuments(projectId: string): Promise<any[]> {
    return this.request<any[]>(`/projects/${projectId}/documents`);
  }

  async getDocument(documentId: string): Promise<any> {
    return this.request<any>(`/documents/${documentId}`);
  }

  async deleteDocument(documentId: string): Promise<void> {
    return this.request<void>(`/documents/${documentId}`, { method: "DELETE" });
  }

  async searchMaterials(projectId: string, query: string, topK: number = 5): Promise<any[]> {
    return this.request<any[]>(`/projects/${projectId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, top_k: topK }),
    });
  }

  // Convenience HTTP methods
  async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, { ...options, method: "GET" });
    return { data };
  }

  async post<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async put<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async patch<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async delete<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, { ...options, method: "DELETE" });
    return { data };
  }
}

export const api = new ApiClient();
export default api;

