const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, sparse: true }, // Email or Username
    googleId: { type: String, unique: true, sparse: true },
    passwordHash: { type: String },
    displayName: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Method to verify password
userSchema.methods.verifyPassword = async function (password) {
    return await bcrypt.compare(password, this.passwordHash);
};

// Static method to create new user
userSchema.statics.register = async function (username, password, displayName) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = new this({
        username,
        passwordHash: hash,
        displayName: displayName || username.split('@')[0]
    });

    return await user.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;
