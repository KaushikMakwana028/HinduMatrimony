import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import storageService from '../services/storageService';
import profileService from '../services/profileService';
import homeService from '../services/homeService';
import { DEMO_TOKEN as CONFIG_DEMO_TOKEN } from '../config/api';

export const DEMO_TOKEN =
    CONFIG_DEMO_TOKEN ||
    'eyJpdiI6Ikp5RXlzL1FNZm1pYjE3L0VSdWdiRlE9PSIsInZhbHVlIjoiS0FvUzNPNFMxUnVoblVVWkZhRHovQT09IiwibWFjIjoiMjYyZGVkOWI1NGUwZDM0MDgyNTAzNTk2OWRlNDgyOTQ2NDU2ZTMwZTNmOGYxYzg4MTRhMDA2NThiODMyZjE1NiIsInRhZyI6IiJ9';

export const DEMO_USER = {
    id: 9999,
    first_name: 'Demo',
    last_name: 'User',
    name: 'Demo User',
    email: 'demo@hindumatrimony.org.in',
    phone: '9876543210',
    gender: 'Male',
    date_of_birth: '1998-01-01',
    age: 28,
    on_behalf: 'Self',
    marital_status: 'Never Married',
    mother_tongue: 'Hindi',
    religion: 'Hindu',
    religion_name: 'Hindu',
    caste: 'Brahmin',
    caste_name: 'Brahmin',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    location: 'Ahmedabad, Gujarat, India',
    height: "5' 9\"",
    weight: '70 kg',
    membership: 2,
    membership_type: 'Premium',
    package_name: 'Premium Member',
    package_id: 1,
    is_premium: true,
    is_demo: true,
    code: 'HM-DEMO',
    member_code: 'HM-DEMO',
};

export const AuthContext = createContext({
    user: null,
    token: null,
    isAuthenticated: false,
    isDemo: false,
    isLoading: true,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    updateUser: () => {},
    loginAsDemo: async () => {},
    loginWithToken: async () => {},
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
        // Clear caches so the new login starts fresh without stale account data
        profileService.clearSettingsCache();
        homeService.clearDashboardCache();

        const response = await authService.login(credentials);

        if (response && response.access_token) {
            setToken(response.access_token);
            await storageService.saveAuthToken(response.access_token);

            if (response.user) {
                const existing = await storageService.getUser();
                // ONLY merge if existing user matches the new user ID to prevent cross-account pollution
                const isSameUser = existing && String(existing.id) === String(response.user.id);
                const mergedUser = isSameUser
                    ? {
                          ...existing,
                          ...response.user,
                          phone: response.user.phone || existing?.phone || '',
                          email: response.user.email || existing?.email || '',
                      }
                    : {
                          ...response.user,
                          phone: response.user.phone || '',
                          email: response.user.email || '',
                      };
                setUser(mergedUser);
                await storageService.saveUser(mergedUser);
            }
        }

        return response;
    }, []);

    // Register / Signup action
    const register = useCallback(async (userData) => {
        // Clear caches so the new registration starts fresh
        profileService.clearSettingsCache();
        homeService.clearDashboardCache();

        const response = await authService.register(userData);

        if (response && response.access_token) {
            setToken(response.access_token);
            await storageService.saveAuthToken(response.access_token);

            if (response.user) {
                // Retain all registration fields (gender, dob, on_behalf, etc.)
                const combinedUser = {
                    ...userData,
                    ...response.user,
                    first_name: response.user.first_name || userData.first_name,
                    last_name: response.user.last_name || userData.last_name,
                    gender: response.user.gender || userData.gender,
                    date_of_birth: response.user.date_of_birth || userData.date_of_birth,
                    on_behalf: response.user.on_behalf || userData.on_behalf,
                    phone: response.user.phone || userData.phone,
                    email: response.user.email || userData.email,
                };
                setUser(combinedUser);
                await storageService.saveUser(combinedUser);
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
            // Clean up all memory caches and storage immediately
            profileService.clearSettingsCache();
            homeService.clearDashboardCache();
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

    // Demo login action with predefined token and account
    const loginAsDemo = useCallback(async (customToken = DEMO_TOKEN, customUser = {}) => {
        profileService.clearSettingsCache();
        homeService.clearDashboardCache();

        const tokenToUse = customToken || DEMO_TOKEN;
        const demoUserData = {
            ...DEMO_USER,
            ...customUser,
        };

        setToken(tokenToUse);
        setUser(demoUserData);

        await Promise.all([
            storageService.saveAuthToken(tokenToUse),
            storageService.saveUser(demoUserData),
        ]);

        return {
            result: true,
            access_token: tokenToUse,
            user: demoUserData,
        };
    }, []);

    // Login with token alias
    const loginWithToken = useCallback(
        async (customToken, customUser = {}) => {
            return loginAsDemo(customToken, customUser);
        },
        [loginAsDemo]
    );

    const value = {
        user,
        token,
        isAuthenticated: !!token,
        isDemo: !!(user?.is_demo || token === DEMO_TOKEN),
        isLoading,
        login,
        register,
        logout,
        updateUser,
        loginAsDemo,
        loginWithToken,
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
