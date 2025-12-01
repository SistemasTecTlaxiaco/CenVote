import mongoose from 'mongoose';

const VoteSchema = new mongoose.Schema({
    surveyId: { type: String, ref: 'Survey', required: true },
    candidateId: { type: String, ref: 'Candidate', required: true },
    voterAddress: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

VoteSchema.index({ surveyId: 1, voterAddress: 1 }, { unique: true });

export default mongoose.model('Vote', VoteSchema);
