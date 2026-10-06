const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 120, message = 'Слишком много запросов' } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ message });
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets) if (now - value.start > 10 * 60_000) buckets.delete(key);
}, 10 * 60_000).unref();

module.exports = rateLimit;
