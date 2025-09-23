// migrate.js
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");
const bookingModel = require("./models/booking.model");


// 1. MySQL Connection
const mysqlConnection = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "dsda",
});

// 2. MongoDB Connection
mongoose.connect("mongodb+srv://Sourav:Sourav58558tis@dsdaservice1.befmntq.mongodb.net/dsda_hotel_booking", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});



// 4. Migration Function (Insert Only)
const migrateUsers = async () => {
    try {
        // Fetch from MySQL
        const [rows] = await mysqlConnection.query("SELECT * FROM tb_police_station");

        // Insert all rows directly
        await bookingModel.insertMany(
            rows.map((row) => ({
                _id: row.id,
                booking_id: row.booking_id,
                booking_hotel_id: row.booking_hotel_id,
                booking_head_guest_name: row.booking_head_guest_name,
                booking_head_guest_phone: row.booking_head_guest_phone,
                booking_number_of_guest: row.booking_number_of_guest,
                booking_checkin_date_time: row.booking_checkin_date_time,
                booking_checkout_date_time: row.booking_checkout_date_time,
                booking_status: row.booking_status,
                booking_is_paid: row.booking_is_paid,
                booking_bill_amount_per_guest: row.booking_bill_amount_per_guest,
                booking_bill_amount: row.booking_bill_amount,
                booking_date_time: row.booking_date_time,
                booking_verified_by: row.booking_verified_by,
                booking_added_by: row.booking_added_by,
                isDel: row.IsDel
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
