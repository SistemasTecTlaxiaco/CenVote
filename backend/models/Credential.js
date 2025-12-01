import mongoose from 'mongoose';

const CredentialSchema = new mongoose.Schema({
    credKey: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Credential', CredentialSchema);
