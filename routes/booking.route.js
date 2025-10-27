const router = require("express").Router();
const {
    addBooking,
    getBooking,
    getStat,
    getTotalStatsforAdmin,
    touristFootfallDate,
    touristFootfalDayWise,
    getTotalAmountHotelWise,
    getBookingSummaryByDateRange,
    getHotelWithEnrolledData
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

router
    .route("/get-admin-stats")
    .post(getTotalStatsforAdmin);


router
    .route("/tourist-data/footfall")
    .post(touristFootfallDate);


router
    .route("/tourist-data/footfall-daywise")
    .post(touristFootfalDayWise);


router
    .route("/get-hotel-wise-total-amount")
    .post(getTotalAmountHotelWise);


router
    .route("/get-booking-summary-by-daterange")
    .post(getBookingSummaryByDateRange);


router
    .route("/get-hotel-enrolled-data")
    .post(getHotelWithEnrolledData);


module.exports = router;