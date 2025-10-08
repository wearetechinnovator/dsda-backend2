const router = require("express").Router();
const {
    addBooking,
    getBooking,
    getStat
} = require('../controllers/booking.controller')



router
    .route('/add-booking')
    .post(addBooking);

router
    .route('/get-booking')
    .post(getBooking);

router
    .route('/get-stats')
    .post(getStat);



module.exports = router;