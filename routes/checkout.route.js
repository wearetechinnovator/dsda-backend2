const router = require("express").Router();
const {
    getHeadOfBooking,
    checkOut,
    updateCheckoutDateTime
} = require('../controllers/booking.controller')



router
    .route("/guest-checkout")
    .post(checkOut);

router
    .route('/get-booking-head')
    .post(getHeadOfBooking);

router
    .route('/update-checkout-datetime')
    .post(updateCheckoutDateTime);


module.exports = router;