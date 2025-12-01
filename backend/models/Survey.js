import mongoose from 'mongoose';

const SurveySchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    candidates: [{ type: String, ref: 'Candidate' }],
    start_date: { type: Date },
    end_date: { type: Date },
    isActive: { type: Boolean, default: true },
    vote_fee: { type: Number, default: 0.1 },
    created_by: { type: String },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Survey', SurveySchema);
