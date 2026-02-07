import { useState, useEffect } from 'react';

const API_URL = "https://karaoq.ngrok.io";

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

            const isJson = res.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await res.json() : { error: await res.text() };

            if (!res.ok) throw new Error(data.message || data.error || "Login failed");

            if (data.token) {
                localStorage.setItem('kraoq_token', data.token);
            }

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

            const isJson = res.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await res.json() : { error: await res.text() };

            if (!res.ok) throw new Error(data.message || data.error || "Registration failed");

            if (data.token) {
                localStorage.setItem('kraoq_token', data.token);
            }

            setUser(data.user);
            return data.user;
        } catch (err) {
            console.error("Registration Fetch Error:", err);
            setError(err.message);
            throw err;
        }
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, { credentials: 'include' });
            localStorage.removeItem('kraoq_token');
            setUser(null);
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    const googleLoginNative = async () => {
        setError(null);
        try {
            // Only try to use the plugin if we are in a Tauri environment
            if (!window.__TAURI_INTERNALS__) {
                throw new Error("Native Google Auth only available in App");
            }

            const { signIn } = await import('@choochmeque/tauri-plugin-google-auth-api');
            const response = await signIn({
                clientId: '1098347408946-lpq5dsaso2cng9jotu21gskl833jegbs.apps.googleusercontent.com',
                scopes: ['email', 'profile', 'openid'],
            });

            if (!response.idToken) throw new Error("Failed to get ID token from Google");

            const res = await fetch(`${API_URL}/auth/google-native`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: response.idToken }),
                credentials: 'include'
            });

            const isJson = res.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await res.json() : { error: await res.text() };

            if (!res.ok) throw new Error(data.error || 'Native login failed');

            if (data.token) {
                localStorage.setItem('kraoq_token', data.token);
            }

            setUser(data.user);
            return data.user;
        } catch (err) {
            console.error("Native Google Login Error:", err);
            setError(err.message);
            throw err;
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
        googleLoginNative,
        checkStatus
    };
}
