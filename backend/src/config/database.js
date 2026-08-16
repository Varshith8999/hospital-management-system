'use strict';

const { Sequelize } = require('sequelize');
const config = require('./index');

const common = {
  logging: config.db.logging ? console.log : false, // eslint-disable-line no-console
  define: {
    underscored: false,
    freezeTableName: false,
  },
};

let sequelize;

if (config.db.dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.db.storage,
    ...common,
  });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    pool: {
      max: config.db.poolMax,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    retry: { max: 3 },
    ...common,
  });
}

module.exports = sequelize;
