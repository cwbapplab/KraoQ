import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Github, Chrome, Loader2, ArrowRight } from 'lucide-react';

const API_URL = "http://localhost:3001";

const AuthModal = ({ isOpen, onClose, onAuthSuccess, login, register, error, setError }) => {
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Password Validation Logic
    const passwordRequirements = [
        { label: '8+ characters', test: (p) => p.length >= 8 },
        { label: 'Upper & lowercase', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
        { label: 'Contains a number', test: (p) => /\d/.test(p) },
    ];
    const isPasswordValid = mode === 'login' || passwordRequirements.every(req => req.test(password));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isPasswordValid) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(email, password, displayName);
            }
            // If we reach here, it was successful
            onAuthSuccess();
        } catch (err) {
            // Error is handled by the hook and passed back
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError(null);
    };

    const googleLogin = () => {
        window.location.href = `${API_URL}/auth/google`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-md overflow-hidden bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(99,102,241,0.2)]"
                >
                    {/* Background Glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/20 rounded-full blur-[80px]" />

                    <div className="relative p-8 sm:p-10">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <motion.h2
                                    key={mode}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-3xl font-black text-white"
                                >
                                    {mode === 'login' ? 'Welcome Back' : 'Join KraoQ'}
                                </motion.h2>
                                <p className="text-text-muted mt-2">
                                    {mode === 'login' ? 'Great to see you again!' : 'Start your karaoke journey today.'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-full text-text-muted hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Google Auth */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={googleLogin}
                            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-all mb-6 shadow-lg"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </motion.button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-px bg-white/5 flex-1" />
                            <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">Or login with email</span>
                            <div className="h-px bg-white/5 flex-1" />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl mb-6 flex items-center gap-3"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                {error}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === 'register' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-2"
                                >
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Display Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border-none"
                                            placeholder="Your name"
                                            required
                                        />
                                    </div>
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Username / Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border-none"
                                        placeholder="Enter username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border-none"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                {mode === 'register' && (
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 ml-1">
                                        {passwordRequirements.map((req, i) => {
                                            const met = req.test(password);
                                            return (
                                                <div key={i} className={`flex items-center gap-1.5 transition-colors ${met ? 'text-green-400' : 'text-white/20'}`}>
                                                    <div className={`w-1 h-1 rounded-full ${met ? 'bg-green-400' : 'bg-white/20'}`} />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">{req.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <motion.button
                                whileHover={isPasswordValid ? { scale: 1.02 } : {}}
                                whileTap={isPasswordValid ? { scale: 0.98 } : {}}
                                type="submit"
                                disabled={isSubmitting || !isPasswordValid}
                                className="w-full bg-gradient-to-r from-primary to-accent text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-primary/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Log In' : 'Create Account'}
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        <div className="mt-8 text-center">
                            <button
                                onClick={toggleMode}
                                className="text-sm font-medium text-text-muted hover:text-primary transition-colors inline-flex items-center gap-2 group"
                            >
                                {mode === 'login' ? "New here? Create an account" : "Already have an account? Log in"}
                                <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                    →
                                </motion.span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AuthModal;
