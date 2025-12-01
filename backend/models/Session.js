import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String },
    username: { type: String },
    displayName: { type: String },
    challenge: { type: Buffer, required: true },
    type: { type: String, enum: ['register', 'authenticate'], required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 }
});

export default mongoose.model('Session', SessionSchema);
