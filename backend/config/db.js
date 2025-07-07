import { Sequelize } from 'sequelize';

const sequelize = new Sequelize("freedb_Chatapp", "freedb_unnati", 'Fym#b$kd#ADJ4Ch', {
  host: 'sql.freedb.tech',
  dialect: 'mysql',
});

export default sequelize;
