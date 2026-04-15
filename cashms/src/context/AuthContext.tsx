import * as React from "react";
import { API } from "@/services/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: Record<string, boolean>;
  effectivePermissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isAuthReady: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  React.useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        localStorage.removeItem("user");
        setIsAuthReady(true);
        return;
      }

      try {
        const response = await API.get("/auth/me");
        const resolvedUser = response.data.user as AuthUser;
        setUser(resolvedUser);
        localStorage.setItem("user", JSON.stringify(resolvedUser));
      } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setIsAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

