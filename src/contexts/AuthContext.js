import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import storageService from '../services/storageService';

export const AuthContext = createContext({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    updateUser: () => {},
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load stored authentication on initial launch
    useEffect(() => {
        let isMounted = true;

        async function restoreSession() {
            try {
                const [storedToken, storedUser] = await Promise.all([
                    storageService.getAuthToken(),
                    storageService.getUser(),
                ]);

                if (isMounted) {
                    if (storedToken) {
                        setToken(storedToken);
                    }
                    if (storedUser) {
                        setUser(storedUser);
                    }
                }
            } catch (err) {
                console.warn('Failed to restore auth session:', err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        restoreSession();

        return () => {
            isMounted = false;
        };
    }, []);

    // Login action
    const login = useCallback(async (credentials) => {
        const response = await authService.login(credentials);

        if (response && response.access_token) {
            setToken(response.access_token);
            await storageService.saveAuthToken(response.access_token);

            if (response.user) {
                setUser(response.user);
                await storageService.saveUser(response.user);
            }
        }

        return response;
    }, []);

    // Register / Signup action
    const register = useCallback(async (userData) => {
        const response = await authService.register(userData);

        if (response && response.access_token) {
            setToken(response.access_token);
            await storageService.saveAuthToken(response.access_token);

            if (response.user) {
                setUser(response.user);
                await storageService.saveUser(response.user);
            }
        }

        return response;
    }, []);

    // Logout action
    const logout = useCallback(async () => {
        try {
            if (token) {
                await authService.logout(token);
            }
        } catch (err) {
            console.warn('Logout error:', err);
        } finally {
            setToken(null);
            setUser(null);
            await storageService.clearAuthData();
        }
    }, [token]);

    // Update user profile locally
    const updateUser = useCallback(async (updatedUser) => {
        setUser((prev) => {
            const merged = { ...prev, ...updatedUser };
            storageService.saveUser(merged);
            return merged;
        });
    }, []);

    const value = {
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
        updateUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
