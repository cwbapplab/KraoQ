import { useState, useEffect } from 'react';

const API_URL = "http://localhost:3001";

export function useAuth() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/auth/status`, { credentials: 'include' });
            const data = await res.json();
            if (data.isAuthenticated) {
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error("Auth check failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const login = async (username, password) => {
        setError(null);
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || "Login failed");
            setUser(data.user);
            return data.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const register = async (username, password, displayName) => {
        setError(null);
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, displayName }),
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
            setUser(data.user);
            return data.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, { credentials: 'include' });
            setUser(null);
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    return {
        user,
        setUser,
        isLoading,
        error,
        setError,
        login,
        register,
        logout,
        checkStatus
    };
}
