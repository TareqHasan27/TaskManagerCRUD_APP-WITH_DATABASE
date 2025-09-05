require('dotenv').config({ path: '../.env' });
console.log("Loaded ENV:", process.env.DB_USER, process.env.DB_PASSWORD);

const mysql = require("mysql2/promise");

async function testDB() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
    });

    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    console.log("✅ Database connected! Test result:", rows[0].result);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

testDB();