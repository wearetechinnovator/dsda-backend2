const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    // _id: String,
    booking_id: String,
    booking_hotel_id: {
        type: String,
        required: true,
        index:true
    },
    booking_head_guest_name: String,
    booking_head_guest_phone: String,
    booking_number_of_guest: String,
    booking_checkin_date_time: String,
    booking_checkout_date_time: String,
    booking_status: {
        type: String,
        enum: ['0', '1', '2'], // 0=Checkin | 1=Checkout | 2=Partial Checkout
        default: '0'
    },
    booking_bill_amount_per_guest: String,
    booking_bill_amount: String,
    booking_verified_by: {
        type: String,
        enum: ['0', '1', '2'], // 0=MANAGER | 1=OTP | 2=ADMIN
        default: '0'
    },
    booking_added_by: {
        type: String,
        enum: ['0', '1'], // 0=ADMIN | 1=HOTEL
        default: '1'
    },
    IsDel: {
        type: String,
        enum: ['0', '1', '2'], // 0=Active | 1=Trash | 2=Permanent Delete
        default: '0',
        index: true
    }
}, { timestamps: true })

module.exports = mongoose.model("booking", bookingSchema);
