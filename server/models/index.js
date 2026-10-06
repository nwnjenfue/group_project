const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config({ path: __dirname + '/../.env' });

// Подключение с использованием объекта конфигурации
const sequelize = new Sequelize({
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
});

// Импортируем модель User
const UserModel = require('./User');
const User = UserModel(sequelize);

const Сводная = sequelize.define('Сводная', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    код_окэд: {
        type: DataTypes.STRING,
        allowNull: false
    },
    вид_деятельности: {
        type: DataTypes.STRING,
        allowNull: false
    },
    количество_нп: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    средняя_численность_работников: {
        type: DataTypes.STRING,
        allowNull: false
    },
    'Сумма по полю ФОТ': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
    },
    Сумма_по_полю_ср_зп: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
    },
    сумма_налогов: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
    },
    удельный_вес: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0
    },
    ИПН: {
        type: DataTypes.STRING,
        allowNull: true
    },
    СН: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'Сводная',
    timestamps: true
});

const OtchetyFull = sequelize.define('OtchetyFull', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    'Код ОКЭД': {
        type: DataTypes.STRING,
        allowNull: true
    },
    'ОКЭД': {
        type: DataTypes.STRING,
        allowNull: true
    },
    'ИИН/БИН': {
        type: DataTypes.STRING,
        allowNull: true
    },
    'Код НУ': {
        type: DataTypes.STRING,
        allowNull: true
    },
    'empl_1_q1': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_2_q1': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_3_q1': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_1_q2': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_2_q2': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_3_q2': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_1_q3': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_2_q3': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_3_q3': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_1_q4': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_2_q4': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'empl_3_q4': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'сколько_месяцев': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'Кол-во_чел': {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    'Ср.числ': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    'field_200_00_001': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    'field_200_00_002': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    'ФОТ': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    'Ср.зп': {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    'Наименование': {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'otchety_full',
    timestamps: true
});

// Экспортируем модели
module.exports = {
    sequelize,
    User,
    Сводная,
    OtchetyFull
}; 