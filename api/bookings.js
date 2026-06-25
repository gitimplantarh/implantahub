import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT || '5432'),
  ssl:      { rejectUnauthorized: false }
});

// Garante que a tabela existe na primeira execução
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id          SERIAL PRIMARY KEY,
      spot_id     TEXT NOT NULL,
      day_key     TEXT NOT NULL,
      name        TEXT NOT NULL,
      team        TEXT DEFAULT '',
      note        TEXT DEFAULT '',
      recurrent   BOOLEAN DEFAULT false,
      rec_dow     INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(spot_id, day_key),
      UNIQUE(spot_id, rec_dow) DEFERRABLE INITIALLY DEFERRED
    );
  `);
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    await ensureTable();

    // GET /api/bookings?week=YYYY-MM-DD
    if (req.method === 'GET') {
      const { week } = req.query;

      // Busca reservas normais da semana
      const { rows: normal } = await pool.query(
        `SELECT id, spot_id, day_key, name, team, note, recurrent, rec_dow
         FROM bookings
         WHERE recurrent = false
           AND day_key >= $1
           AND day_key <= $2`,
        [week, getEndOfWeek(week)]
      );

      // Busca reservas recorrentes
      const { rows: recurrents } = await pool.query(
        `SELECT id, spot_id, day_key, name, team, note, recurrent, rec_dow
         FROM bookings
         WHERE recurrent = true`
      );

      return res.status(200).json({ bookings: [...normal, ...recurrents] });
    }

    // POST /api/bookings — criar reserva
    if (req.method === 'POST') {
      const { spot_id, day_key, name, team, note, recurrent, rec_dow } = req.body;

      if (!spot_id || !name) {
        return res.status(400).json({ error: 'spot_id e name são obrigatórios' });
      }

      if (recurrent) {
        // Reserva recorrente: salva com rec_dow e sem day_key fixo
        const { rows } = await pool.query(
          `INSERT INTO bookings (spot_id, day_key, name, team, note, recurrent, rec_dow)
           VALUES ($1, 'recurrent', $2, $3, $4, true, $5)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [spot_id, name, team || '', note || '', rec_dow]
        );
        return res.status(201).json({ booking: rows[0] || null });
      } else {
        if (!day_key) return res.status(400).json({ error: 'day_key é obrigatório' });

        const { rows } = await pool.query(
          `INSERT INTO bookings (spot_id, day_key, name, team, note, recurrent)
           VALUES ($1, $2, $3, $4, $5, false)
           ON CONFLICT (spot_id, day_key) DO NOTHING
           RETURNING *`,
          [spot_id, day_key, name, team || '', note || '']
        );
        return res.status(201).json({ booking: rows[0] || null });
      }
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('DB error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

function getEndOfWeek(mondayStr) {
  const d = new Date(mondayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4);
  return d.toISOString().slice(0, 10);
}
