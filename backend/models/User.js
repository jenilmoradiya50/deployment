const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    password: {
      type: String,
      required: true
    },
    name: {
      type: String,
      default: 'Admin User'
    },
    role: {
      type: String,
      enum: ['admin', 'technician', 'viewer'],
      default: 'admin'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
