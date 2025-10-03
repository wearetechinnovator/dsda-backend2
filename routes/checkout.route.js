const router = require("express").Router();
const {
    getHeadOfBooking
} = require('../controllers/booking.controller')


router
    .route('/get-booking-head')
    .post(getHeadOfBooking);


module.exports = router;