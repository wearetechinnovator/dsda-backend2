require("dotenv").config();
const express = require("express");
const app = express();
const PORT = 8081 || process.env.PORT;
const connection = require("./db/connection");
const cors = require("cors");
const compression = require("compression");
const router = require("./routes/index.route");
const bookingDetailsModel = require("./models/bookingDetails.model");
const bookingModel = require("./models/booking.model");


// app.use(cors({
//     origin: process.env.CORS_ORIGIN.split(","),
//     credentials: true
// }));
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (res.getHeader('Content-Type') === 'application/json') {
            return true;
        }
        return false;
    }
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));


// test only (remove in production)
app.get("/", (req, res) => {
    res.send("hello service2");
})


// API
app.use("/booking/api/v1", router);

/*
app.get("/clear-junk", async (req, res) => {
    try {
        const start = new Date("2025-12-17T00:00:00.000Z");
        const end = new Date("2025-12-18T00:00:00.000Z");

        // 1️⃣ Get booking IDs from bookingDetails
        const bookedDetails = await bookingDetailsModel.find(
            {

            },
            { booking_details_booking_id: 1, booking_details_guest_name: 1 } // fetch only booking_id
        );

        // 2️⃣ Convert to array of ObjectIds
        const bookedIds = bookedDetails.map(item => item.booking_details_booking_id);

        // 3️⃣ Fetch bookings NOT in bookedIds
        const test = await bookingModel.countDocuments({
            IsDel: "0",
            _id: { $nin: bookedIds }
        });

        // let a= await bookingModel.deleteMany({
        //     IsDel: "0",
        //     _id: { $nin: bookedIds }
        // })
        // console.log(a)
        res.json(test);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
*/


/*
app.get("/solve-checkout", async (req, res) => {
    try {
        const start = new Date("2025-12-17T00:00:00.000Z");
        const end = new Date("2025-12-18T00:00:00.000Z");

        // 1️⃣ Get booking IDs from bookingDetails
        const bookedDetails = await bookingModel.find(
            {
                booking_status: "1"
            },
            { _id: 1, booking_head_guest_name: 1 } // fetch only booking_id
        );

        // 2️⃣ Convert to array of ObjectIds
        const bookedIds = bookedDetails.map(item => item._id);

        // 3️⃣ Fetch bookings NOT in bookedIds
        const test = await bookingDetailsModel.find({
            booking_details_status: "0",
            booking_details_booking_id: { $in: bookedIds }
        }).populate("booking_details_booking_id")

        // let count = 0;
        // for (let b of test) {
        //     count++;
        //     let result =  await bookingDetailsModel.updateOne({
        //         IsDel: "0",
        //         _id: { $in: b._id }
        //     }, { $set: { booking_details_status: "1", booking_details_checkout_date_time: b.booking_details_booking_id.booking_checkout_date_time } })
        //     console.log(result.modifiedCount);
        // }
        // let a = await bookingDetailsModel.updateMany({
        //     IsDel: "0",
        //     booking_details_booking_id: { $in: bookedIds }
        // }, {$set: {booking_details_status: "1"}})

        // console.log(a)
        res.json(test);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

*/





// DB connection...
connection().then(con => {
    if (con) {
        app.listen(PORT, () => {
            console.log("[*] Server running on " + PORT);
        })
    } else {
        console.log("[*] Database connection failed")
    }
}).catch((er) => {
    console.log("[*] Something went wrong: ", er)
})
