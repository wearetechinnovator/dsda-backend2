const router = require("express").Router();
const {
    addBooking,
    getBooking
} = require('../controllers/booking.controller')



router
    .route('/add-booking')
    .post(addBooking);

router
    .route('/get-booking')
    .post(getBooking);



module.exports = router;