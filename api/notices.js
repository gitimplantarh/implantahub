// api/notices.js
// Adicionar este arquivo na pasta /api/ do repositório

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     process.env.DB_PORT || 5432,
  ssl:      { rejectUnauthorized: false },
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = await pool.connect();
  try {
    // GET — listar avisos
    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT * FROM notices ORDER BY pinned DESC, created_at DESC LIMIT 50'
      );
      return res.status(200).json(result.rows);
    }

    // POST — criar aviso
    if (req.method === 'POST') {
      const { author, team, message, emoji } = req.body;
      if (!author || !message) return res.status(400).json({ error: 'author e message são obrigatórios' });
      const result = await client.query(
        'INSERT INTO notices (author, team, message, emoji) VALUES ($1,$2,$3,$4) RETURNING *',
        [author, team||'', message, emoji||'📌']
      );
      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
};
