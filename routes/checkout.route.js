const router = require("express").Router();
const {
    getHeadOfBooking,
    checkOut
} = require('../controllers/booking.controller')



router
    .route("/guest-checkout")
    .post(checkOut);

router
    .route('/get-booking-head')
    .post(getHeadOfBooking);


module.exports = router;