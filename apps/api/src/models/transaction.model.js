const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./user.model');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  amount: {
    type: DataTypes.DECIMAL,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ETB'
  },
  fee: {
    type: DataTypes.DECIMAL,
    defaultValue: 0
  },
  type: {
    type: DataTypes.ENUM('PAYMENT', 'DEPOSIT', 'WITHDRAWAL'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reference: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.STRING
  },
  recipient: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true
});

Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });

module.exports = Transaction;
