const router = require("express").Router();
const bookingRoute = require("./booking.route");
const checkoutRoute = require("./checkout.route")



router.use("/check-in", bookingRoute);
router.use("/check-out", checkoutRoute);

module.exports = router;
