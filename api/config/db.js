const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "cobranza",
  port: parseInt(process.env.DB_PORT || "5432"),
  max: 15,
  idleTimeoutMillis: 60000,
});

// Verificar la conexión
db.connect()
  .then((client) => {
    console.log("Conectado a PostgreSQL");
    client.release();
  })
  .catch((err) => {
    console.error("Error conectando a PostgreSQL:", err);
  });

// Manejar errores del pool
db.on("error", (err) => {
  console.error("Error en el pool de conexiones PostgreSQL:", err);
});

module.exports = db;
