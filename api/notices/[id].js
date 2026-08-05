
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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const client = await pool.connect();
  try {
    if (req.method === 'DELETE') {
      await client.query('DELETE FROM notices WHERE id = $1', [id]);
      return res.status(200).json({ deleted: true });
    }

    if (req.method === 'PATCH') {
      const { pinned } = req.body;
      const result = await client.query(
        'UPDATE notices SET pinned = $1 WHERE id = $2 RETURNING *',
        [pinned, id]
      );
      return res.status(200).json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
};
