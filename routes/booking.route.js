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
    getHotelWithEnrolledData,
    getTotalAmountHotelId,
    getPublicBookingDetails
} = require('../controllers/booking.controller')
const middleware = require("../middleware/middleware");


router
    .route('/add-booking')
    .post(middleware, addBooking);


router
    .route('/get-booking')
    .post(middleware, getBooking);

router
    .route('/public/get-booking') // ----[For Public bill use] ---
    .post(getPublicBookingDetails);
    
router
    .route('/get-stats')
    .post(middleware, getStat);

router
    .route("/get-admin-stats")
    .post(middleware, getTotalStatsforAdmin);


router
    .route("/tourist-data/footfall")
    .post(middleware, touristFootfallDate);


router
    .route("/tourist-data/footfall-daywise")
    .post(middleware, touristFootfalDayWise);


router
    .route("/get-hotel-wise-total-amount")
    .post(middleware, getTotalAmountHotelWise);


router
    .route("/get-hotel-id-total-amount")
    .post(middleware, getTotalAmountHotelId);


router
    .route("/get-booking-summary-by-daterange")
    .post(middleware, getBookingSummaryByDateRange);


router
    .route("/get-hotel-enrolled-data")
    .post(middleware, getHotelWithEnrolledData);


module.exports = router;