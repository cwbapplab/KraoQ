import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Check, ArrowRight } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
    if (!isOpen) return null;

    const accentColor = type === 'danger' ? 'red' : 'primary';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
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
                    className="relative w-full max-w-sm overflow-hidden bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(244,63,94,0.1)]"
                >
                    {/* Background Glow */}
                    <div className={`absolute -top-12 -right-12 w-32 h-32 bg-${type === 'danger' ? 'red' : 'primary'}-500/10 rounded-full blur-[60px]`} />

                    <div className="relative p-8">
                        {/* Header */}
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-full ${type === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'} flex items-center justify-center mb-6`}>
                                {type === 'danger' ? <AlertTriangle size={32} /> : <Check size={32} />}
                            </div>

                            <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
                            <p className="text-text-muted text-sm leading-relaxed mb-8">
                                {message}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`w-full ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'} text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2`}
                            >
                                {confirmText}
                            </motion.button>

                            <button
                                onClick={onClose}
                                className="w-full h-12 text-sm font-bold text-text-muted hover:text-white transition-colors"
                            >
                                {cancelText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ConfirmationModal;
