// migrate.js
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");
const zoneModel = require('./models/zone.model');
const blockModel = require('./models/block.model');
const districtModel = require('./models/district.model');
const sectorModel = require('./models/sector.model');
const policeStationModel = require('./models/policeStation.model');


// 1. MySQL Connection
const mysqlConnection = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "dsda",
});

// 2. MongoDB Connection
mongoose.connect("mongodb://localhost:27017/dsda_master_payment", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});



// 4. Migration Function (Insert Only)
const migrateUsers = async () => {
    try {
        // Fetch from MySQL
        const [rows] = await mysqlConnection.query("SELECT * FROM tb_police_station");

        // Insert all rows directly
        await policeStationModel.insertMany(
            rows.map((row) => ({
                name: row.police_station_name,
                details: row.police_station_details,
                district: "68c1752786d074f2fe362ed4"
            })),
        );

        console.log("✅ Migration completed (insert only)!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

migrateUsers();
