import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

// Import Models
import User from './models/User.js';
import Candidate from './models/Candidate.js';
import Survey from './models/Survey.js';
import Vote from './models/Vote.js';
import Session from './models/Session.js';
import Credential from './models/Credential.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
    }
  }
};

connectDB();

// ===== PASSKEY/WEBAUTHN ENDPOINTS =====

// Generar challenge para registro
app.post('/api/passkey/register/options', async (req, res) => {
  try {
    const { username, displayName } = req.body;

    if (!username || !displayName) {
      return res.status(400).json({ error: 'username y displayName son requeridos' });
    }

    // Generar challenge aleatorio y codificarlo en base64url
    const challengeBuffer = crypto.randomBytes(32);
    const challenge = challengeBuffer.toString('base64url');
    const sessionId = `reg-${Date.now()}-${Math.random()}`;
    const userId = `user-${Date.now()}`;

    // Guardar sesión en MongoDB
    await Session.create({
      sessionId,
      userId,
      username,
      displayName,
      challenge: challengeBuffer, // Guardamos el Buffer
      type: 'register'
    });

    res.json({
      challenge,
      sessionId,
      userId,
      username,
      displayName
    });
  } catch (error) {
    console.error('Error in register/options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar y guardar credencial registrada
app.post('/api/passkey/register/verify', async (req, res) => {
  try {
    const { sessionId, credentialId, publicKey, username, displayName } = req.body;

    // Verificar sesión
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(400).json({ error: 'Sesión inválida o expirada' });
    }

    // Guardar credencial
    const credKey = `${username}-${credentialId.substring(0, 20)}`;
    await Credential.create({
      credKey,
      userId: session.userId,
      credentialId,
      publicKey,
      username,
      displayName
    });

    // Crear o actualizar usuario
    await User.findOneAndUpdate(
      { username },
      {
        _id: session.userId,
        username,
        displayName,
        wallet_address: session.userId,
        created_at: new Date()
      },
      { upsert: true, new: true }
    );

    // Limpiar sesión
    await Session.deleteOne({ sessionId });

    res.json({
      success: true,
      userId: session.userId,
      username,
      displayName,
      message: 'Passkey registrado exitosamente'
    });
  } catch (error) {
    console.error('Error in register/verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generar challenge para autenticación
app.post('/api/passkey/authenticate/options', async (req, res) => {
  try {
    const challengeBuffer = crypto.randomBytes(32);
    const challenge = challengeBuffer.toString('base64url');
    const sessionId = `auth-${Date.now()}-${Math.random()}`;

    await Session.create({
      sessionId,
      userId: `auth-${Date.now()}`,
      challenge: challengeBuffer,
      type: 'authenticate'
    });

    res.json({
      challenge,
      sessionId
    });
  } catch (error) {
    console.error('Error in authenticate/options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar autenticación
app.post('/api/passkey/authenticate/verify', async (req, res) => {
  try {
    const { sessionId, credentialId, username } = req.body;

    // Verificar sesión
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(400).json({ error: 'Sesión inválida o expirada' });
    }

    // Buscar credencial
    const credential = await Credential.findOne({ username, credentialId });
    if (!credential) {
      return res.status(401).json({ error: 'Credencial no encontrada' });
    }

    // Buscar usuario
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Limpiar sesión
    await Session.deleteOne({ sessionId });

    // Crear token de sesión
    const authToken = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      authToken,
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      message: '¡Autenticación exitosa!'
    });
  } catch (error) {
    console.error('Error in authenticate/verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== USUARIOS ENDPOINTS =====
app.post('/api/users', async (req, res) => {
  try {
    const userId = `user-${Date.now()}`;
    const user = await User.create({ _id: userId, ...req.body });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== CANDIDATOS ENDPOINTS =====
app.post('/api/candidates', async (req, res) => {
  try {
    // Validar que el usuario existe antes de crear candidato
    if (req.body.wallet_address) {
      const user = await User.findOne({ wallet_address: req.body.wallet_address });
      if (!user) {
        return res.status(400).json({
          error: 'Debe existir un usuario registrado con esta wallet antes de registrar un candidato'
        });
      }
    }

    const candidateId = `candidate-${Date.now()}`;
    const candidate = await Candidate.create({ _id: candidateId, ...req.body });
    res.status(201).json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find();
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/candidates/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/candidates/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/candidates/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SURVEYS ENDPOINTS =====
app.post('/api/surveys', async (req, res) => {
  try {
    const surveyId = `survey-${Date.now()}`;
    const survey = await Survey.create({ _id: surveyId, ...req.body });
    res.status(201).json(survey);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/surveys', async (req, res) => {
  try {
    const surveys = await Survey.find();
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    res.json(survey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/surveys/:id/vote', async (req, res) => {
  try {
    const { candidateId, voterAddress } = req.body;
    const surveyId = req.params.id;

    // Verificar que existe la encuesta
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Verificar que el candidato está en la encuesta
    if (!survey.candidates.includes(candidateId)) {
      return res.status(400).json({ error: 'Candidate not in this survey' });
    }

    // Verificar si el usuario ya votó
    const existingVote = await Vote.findOne({ surveyId, voterAddress });
    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted in this survey' });
    }

    // Registrar el voto
    await Vote.create({
      surveyId,
      candidateId,
      voterAddress
    });

    const totalVotes = await Vote.countDocuments({ surveyId });

    res.json({
      success: true,
      message: 'Vote registered successfully',
      totalVotes
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/surveys/:id/results', async (req, res) => {
  try {
    const surveyId = req.params.id;
    const survey = await Survey.findById(surveyId);

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const votes = await Vote.find({ surveyId });
    const totalVotes = votes.length;

    // Crear resultados con información de candidatos
    const results = [];
    for (const candidateId of survey.candidates) {
      const candidate = await Candidate.findById(candidateId);
      const voteCount = votes.filter(v => v.candidateId === candidateId).length;
      const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).toFixed(2) : 0;

      results.push({
        candidateId,
        candidateName: candidate ? candidate.name : 'Unknown',
        votes: voteCount,
        percentage: parseFloat(percentage)
      });
    }

    res.json({
      surveyId,
      surveyName: survey.title, // Note: Survey model uses 'title'
      totalVotes,
      results: results.sort((a, b) => b.votes - a.votes)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/surveys/:id/check-vote', async (req, res) => {
  try {
    const { voterAddress } = req.body;
    const surveyId = req.params.id;

    const vote = await Vote.findOne({ surveyId, voterAddress });
    const hasVoted = !!vote;

    res.json({ hasVoted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    res.json(survey);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    // Also delete associated votes
    await Vote.deleteMany({ surveyId: req.params.id });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== DEBUG ENDPOINT =====
app.get('/api/debug', async (req, res) => {
  try {
    const users = await User.find();
    const credentials = await Credential.find();
    const sessions = await Session.find();

    res.json({
      users,
      credentials: credentials.map(c => ({
        ...c.toObject(),
        credentialId: c.credentialId.substring(0, 20) + '...'
      })),
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        type: s.type,
        username: s.username
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Passkey API: http://localhost:${PORT}/api/passkey/`);
    console.log(`🔍 Debug: http://localhost:${PORT}/api/debug`);
  });
}

export default app;