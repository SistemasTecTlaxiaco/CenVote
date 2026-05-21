import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

// Asegurar que la carpeta data existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class LocalDatabase {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.filePath = path.join(dataDir, `${collectionName}.json`);
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn(`⚠️ Error loading ${this.collectionName}.json:`, err.message);
    }
    return [];
  }

  saveData() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error(`❌ Error saving ${this.collectionName}.json:`, err);
    }
  }

  create(doc) {
    const newDoc = { ...doc, _id: doc._id || `${this.collectionName}-${Date.now()}` };
    this.data.push(newDoc);
    this.saveData();
    return newDoc;
  }

  find(query = {}) {
    return this.data.filter(doc => {
      return Object.keys(query).every(key => {
        if (query[key] === undefined) return true;
        return doc[key] === query[key];
      });
    });
  }

  findOne(query = {}) {
    return this.find(query)[0] || null;
  }

  findById(id) {
    return this.data.find(doc => doc._id === id) || null;
  }

  findOneAndUpdate(query, update, options = {}) {
    const index = this.data.findIndex(doc => {
      return Object.keys(query).every(key => doc[key] === query[key]);
    });

    if (index === -1) {
      if (options.upsert) {
        const newDoc = { ...query, ...update };
        this.data.push(newDoc);
        this.saveData();
        return newDoc;
      }
      return null;
    }

    this.data[index] = { ...this.data[index], ...update };
    this.saveData();
    return this.data[index];
  }

  findByIdAndUpdate(id, update, options = {}) {
    const index = this.data.findIndex(doc => doc._id === id);

    if (index === -1) {
      return null;
    }

    this.data[index] = { ...this.data[index], ...update };
    this.saveData();
    return this.data[index];
  }

  findByIdAndDelete(id) {
    const index = this.data.findIndex(doc => doc._id === id);

    if (index === -1) {
      return null;
    }

    const deleted = this.data[index];
    this.data.splice(index, 1);
    this.saveData();
    return deleted;
  }

  deleteOne(query) {
    const index = this.data.findIndex(doc => {
      return Object.keys(query).every(key => doc[key] === query[key]);
    });

    if (index === -1) {
      return false;
    }

    this.data.splice(index, 1);
    this.saveData();
    return true;
  }

  deleteMany(query = {}) {
    const initialLength = this.data.length;
    this.data = this.data.filter(doc => {
      return !Object.keys(query).every(key => doc[key] === query[key]);
    });
    this.saveData();
    return initialLength - this.data.length;
  }

  countDocuments(query = {}) {
    return this.find(query).length;
  }
}

export default LocalDatabase;
