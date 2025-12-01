import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    first_name: { type: String, required: true },
    paternal_last_name: { type: String, required: true },
    maternal_last_name: { type: String, required: true },
    phone: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    wallet_address: { type: String },  // Sin unique para permitir múltiples null
    created_at: { type: Date, default: Date.now }
});

// Índices para búsquedas rápidas
UserSchema.index({ email: 1 });
UserSchema.index({ wallet_address: 1 }, { sparse: true });  // Índice sparse para búsquedas

export default mongoose.model('User', UserSchema);
