'use strict';

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { ROLE_VALUES, ROLES } = require('./constants');

module.exports = (sequelize) => {
  class User extends Model {
    async comparePassword(plain) {
      if (!plain || !this.password) return false;
      return bcrypt.compare(plain, this.password);
    }

    // Never leak the password hash through an API response.
    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 120] },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
        set(value) {
          this.setDataValue('email', String(value || '').trim().toLowerCase());
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...ROLE_VALUES),
        allowNull: false,
        defaultValue: ROLES.PATIENT,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      indexes: [{ unique: true, fields: ['email'] }, { fields: ['role'] }],
      hooks: {
        beforeSave: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, config.bcryptRounds);
          }
        },
      },
    }
  );

  User.associate = (models) => {
    User.hasOne(models.Patient, { foreignKey: 'userId', as: 'patientProfile' });
    User.hasOne(models.Doctor, { foreignKey: 'userId', as: 'doctorProfile' });
    User.hasOne(models.Nurse, { foreignKey: 'userId', as: 'nurseProfile' });
  };

  return User;
};
