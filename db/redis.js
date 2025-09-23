const { createClient } = require("redis");
const REDIS_DB_URI = process.env.REDIS_URI || "redis://localhost:6379";

const client = createClient({
    url: REDIS_DB_URI,
});

client.on("error", (err) => {
    console.error("Redis Client Error:", err);
});

async function connectRedis() {
    if (!client.isOpen) {
        await client.connect();
    }
    return client;
}

module.exports = connectRedis;
