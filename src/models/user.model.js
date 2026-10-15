const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    // `unique: true` creates a database index. THE DATABASE (not our code) guarantees
    // no two users share an email, even if two registrations arrive at the same instant.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Only the bcrypt hash is stored, never the password. `select: false` means queries
    // do NOT return it unless we explicitly ask (login does).
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
    toJSON: {
      // Controls what leaves the server when a user is sent as JSON.
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
