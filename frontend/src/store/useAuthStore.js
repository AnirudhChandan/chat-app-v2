import { create } from "zustand";
import api from "../api/axios";

export const useAuthStore = create((set) => ({
  user: (() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (err) {
      console.error("Failed to parse user from local storage:", err);
      return null;
    }
  })(),

  token: localStorage.getItem("token") || null,
  isAuthenticated: !!localStorage.getItem("token"),
  isSigningUp: false,
  isLoggingIn: false,
  isCheckingAuth: true,

  checkAuth: async () => {
    try {
      const token = localStorage.getItem("token");
      let user = null;
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) user = JSON.parse(storedUser);
      } catch (e) {
        console.error("Auth check parse error", e);
      }

      if (token && user) {
        set({ isAuthenticated: true, token, user, isCheckingAuth: false });
      } else {
        set({
          isAuthenticated: false,
          token: null,
          user: null,
          isCheckingAuth: false,
        });
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } catch (error) {
      console.log("Auth check error", error);
      set({ isAuthenticated: false, token: null, isCheckingAuth: false });
    }
  },

  signup: async (formData) => {
    set({ isSigningUp: true });
    try {
      const res = await api.post("/auth/register", formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      set({
        user: res.data.user,
        token: res.data.token,
        isAuthenticated: true,
      });
      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      // RETURN THE REAL ERROR MESSAGE
      const message = error.response?.data?.message || "Signup failed";
      return { success: false, message };
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (email, password) => {
    set({ isLoggingIn: true });
    try {
      const res = await api.post("/auth/login", { email, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      set({
        user: res.data.user,
        token: res.data.token,
        isAuthenticated: true,
      });
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      const message = error.response?.data?.message || "Login failed";
      return { success: false, message };
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
