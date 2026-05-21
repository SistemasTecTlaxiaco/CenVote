import LocalDatabase from '../database.js';

const db = new LocalDatabase('votes');

export default {
  create: (data) => db.create({ ...data, timestamp: new Date() }),
  find: (query) => db.find(query),
  findOne: (query) => db.findOne(query),
  findById: (id) => db.findById(id),
  findByIdAndUpdate: (id, update, opts) => db.findByIdAndUpdate(id, update, opts),
  findOneAndUpdate: (query, update, opts) => db.findOneAndUpdate(query, update, opts),
  findByIdAndDelete: (id) => db.findByIdAndDelete(id),
  deleteMany: (query) => db.deleteMany(query),
  countDocuments: (query) => db.countDocuments(query)
};
