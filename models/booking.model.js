const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    booking_hotel_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    booking_head_guest_name: {
        type: String,
        index: true
    },
    booking_head_guest_phone: {
        type: String,
        index: true
    },
    booking_number_of_guest: {
        type: String,
        index: true
    },
    booking_checkin_date_time: {
        type: String,
        index: true
    },
    booking_checkout_date_time: {
        type: String,
        index: true
    },
    booking_status: {
        type: String,
        enum: ['0', '1', '2'], // 0=Checkin | 1=Checkout | 2=Partial Checkout
        default: '0',
        index: true
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
