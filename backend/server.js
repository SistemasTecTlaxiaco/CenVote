import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Import Models
import User from './models/User.js';
import Candidate from './models/Candidate.js';
import Survey from './models/Survey.js';
import Vote from './models/Vote.js';
import Session from './models/Session.js';
import Credential from './models/Credential.js';
import { hashPassword, verifyPassword, generateToken, removeToken, requireAuth, requireAdmin, seedAdmin } from './auth.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===== AUTH ENDPOINTS =====

// Registro de usuario normal
app.post('/api/auth/register', async (req, res) => {
  try {
    const { first_name, paternal_last_name, maternal_last_name, email, password, phone } = req.body;
    if (!first_name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const existing = User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }
    const hashedPw = await hashPassword(password);
    const userId = `user-${Date.now()}`;
    const user = User.create({
      _id: userId,
      first_name,
      paternal_last_name: paternal_last_name || '',
      maternal_last_name: maternal_last_name || '',
      phone: phone || '',
      email,
      password: hashedPw,
      role: 'user',
      wallet_address: null,
      created_at: new Date().toISOString()
    });
    const token = generateToken(userId);
    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    let user = User.findOne({ email });
    if (!user) {
      // Registrar usuario nuevo automáticamente
      const hashedPw = await hashPassword(password);
      const userId = `user-${Date.now()}`;
      user = User.create({
        _id: userId,
        first_name: email.split('@')[0],
        paternal_last_name: '',
        maternal_last_name: '',
        phone: '',
        email,
        password: hashedPw,
        role: 'user',
        wallet_address: null,
        created_at: new Date().toISOString()
      });
      const token = generateToken(user._id);
      const { password: _, ...safeUser } = user;
      console.log(`✨ Usuario nuevo autocreado para passkey/login: ${email}`);
      return res.json({ token, user: safeUser });
    }
    
    // Si el usuario existe pero no tiene contraseña asignada (por ejemplo, importado o passkey-only previo)
    if (!user.password) {
      const hashedPw = await hashPassword(password);
      const updatedUser = User.findByIdAndUpdate(user._id, { password: hashedPw }, { new: true });
      const token = generateToken(updatedUser._id);
      const { password: _, ...safeUser } = updatedUser;
      console.log(`🔐 Contraseña asignada automáticamente al usuario legacy: ${email}`);
      return res.json({ token, user: safeUser });
    }
    
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = generateToken(user._id);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener usuario autenticado
app.get('/api/auth/me', requireAuth, (req, res) => {
  const { password, ...safeUser } = req.user;
  res.json(safeUser);
});

// Actualizar perfil
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { first_name, paternal_last_name, maternal_last_name, phone, email } = req.body;
    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (paternal_last_name !== undefined) updates.paternal_last_name = paternal_last_name;
    if (maternal_last_name !== undefined) updates.maternal_last_name = maternal_last_name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) {
      const existing = User.findOne({ email });
      if (existing && existing._id !== req.user._id) {
        return res.status(400).json({ error: 'Ese email ya está en uso por otro usuario' });
      }
      updates.email = email;
    }
    const updated = User.findByIdAndUpdate(req.user._id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { password, ...safeUser } = updated;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  removeToken(req.token);
  res.json({ success: true });
});

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

    // Verificar si la credencial ya existe para evitar duplicados
    const existingCred = await Credential.findOne({ credentialId });
    if (existingCred) {
      await Session.deleteOne({ sessionId });
      return res.status(400).json({ error: 'Esta passkey ya está registrada en el sistema' });
    }

    // Buscar usuario existente (por email / username)
    let user = await User.findOne({ email: username }) || await User.findOne({ username });

    if (!user) {
      // Solo crear usuario minimal si no existe (passkey-only users)
      user = await User.findOneAndUpdate(
        { username },
        {
          _id: session.userId,
          username,
          email: username, // Asumimos que username es el email
          displayName,
          first_name: displayName || username,
          paternal_last_name: '',
          maternal_last_name: '',
          phone: '',
          role: 'user',
          wallet_address: null,
          created_at: new Date().toISOString()
        },
        { upsert: true, new: true }
      );
    }

    // Guardar credencial usando el ID real del usuario en la BD
    const credKey = `${username}-${credentialId.substring(0, 20)}`;
    await Credential.create({
      credKey,
      userId: user._id,
      credentialId,
      publicKey,
      username,
      displayName,
      created_at: new Date().toISOString()
    });

    // Limpiar sesión
    await Session.deleteOne({ sessionId });

    res.json({
      success: true,
      userId: user._id || session.userId,
      username: user.username || user.email || username,
      displayName: user.first_name || displayName,
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

    // Buscar credencial (soporta búsqueda por credentialId únicamente si no hay username)
    const credential = username 
      ? await Credential.findOne({ username, credentialId })
      : await Credential.findOne({ credentialId });
      
    if (!credential) {
      return res.status(401).json({ error: 'Credencial no encontrada' });
    }

    // Buscar usuario (probamos email, username e ID para máxima robustez)
    const user = await User.findOne({ email: credential.username }) || 
                 await User.findOne({ username: credential.username }) || 
                 await User.findById(credential.userId);
                 
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Limpiar sesión
    await Session.deleteOne({ sessionId });

    // Crear token de sesión usando el sistema de AuthService del backend
    const authToken = generateToken(user._id);

    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      authToken,
      token: authToken, // Para compatibilidad
      user: safeUser,
      userId: user._id,
      username: user.username || user.email || user.first_name,
      displayName: user.displayName || user.first_name,
      message: '¡Autenticación exitosa!'
    });
  } catch (error) {
    console.error('Error in authenticate/verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar credenciales de un usuario
app.get('/api/passkey/list/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const credentials = await Credential.find({ username });
    const mapped = credentials.map(c => ({
      ...c,
      id: c._id
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una credencial
app.delete('/api/passkey/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Credential.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Credencial no encontrada' });
    }
    res.json({ success: true, message: 'Credencial eliminada exitosamente' });
  } catch (error) {
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
  (async () => {

    const PORT = process.env.PORT || 3000;

    // Seed admin user
    await seedAdmin();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Using local JSON database (backend/data/)`);
    });

  })();
}

export default app;