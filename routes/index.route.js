const router = require("express").Router();
const bookingRoute = require("./booking.route");



router.use("/check-in", bookingRoute);

module.exports = router;
