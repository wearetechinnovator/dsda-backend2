const router = require("express").Router();
const hotelRoute = require("./hotel.route");



router.use("/hotel", hotelRoute);

module.exports = router;
