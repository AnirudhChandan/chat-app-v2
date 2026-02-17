import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import Signup from "./pages/Signup"; // Ensure this file exists, or remove this line

// Protected Route Component: Redirects to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return children;
};

function App() {
  const { checkAuth, isCheckingAuth } = useAuthStore();

  // FIX: Actually call the function inside useEffect
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Optional: Show a loading spinner while checking auth
  if (isCheckingAuth && !useAuthStore.getState().isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Chat Route */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes to chat (which will redirect to login if needed) */}
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
