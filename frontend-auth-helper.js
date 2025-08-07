/**
 * Frontend Authentication Helper
 * Makes authentication easier for your frontend in production
 */

class AuthManager {
  constructor(apiBaseUrl = 'http://localhost:3000/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.refreshPromise = null; // Prevent multiple refresh attempts
  }

  // Store tokens after login
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  // Clear tokens on logout
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.accessToken;
  }

  // Get authorization header
  getAuthHeader() {
    return this.accessToken ? `Bearer ${this.accessToken}` : null;
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = fetch(`${this.apiBaseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }
        return response.json();
      })
      .then(data => {
        this.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // Make authenticated API request with automatic token refresh
  async apiRequest(url, options = {}) {
    const makeRequest = async (token) => {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      return fetch(`${this.apiBaseUrl}${url}`, {
        ...options,
        headers,
      });
    };

    try {
      // Try with current access token
      let response = await makeRequest(this.accessToken);

      // If unauthorized, try to refresh token
      if (response.status === 401 && this.refreshToken) {
        console.log('Access token expired, refreshing...');
        
        try {
          const newAccessToken = await this.refreshAccessToken();
          response = await makeRequest(newAccessToken);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          this.clearTokens();
          throw new Error('Authentication failed. Please login again.');
        }
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Login method
  async login(username, password) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout method
  async logout() {
    try {
      if (this.accessToken) {
        await this.apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  // Register method
  async register(userData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
}

// Usage examples:
/*
// Initialize
const auth = new AuthManager('https://your-api-domain.com/api');

// Login
try {
  const user = await auth.login('username', 'password');
  console.log('Logged in:', user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Make authenticated requests
try {
  const response = await auth.apiRequest('/tasks');
  const tasks = await response.json();
  console.log('Tasks:', tasks);
} catch (error) {
  console.error('Request failed:', error.message);
}

// Logout
await auth.logout();
*/

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
} else if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}
