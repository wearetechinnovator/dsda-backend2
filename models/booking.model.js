const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    booking_hotel_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    booking_head_guest_name: String,
    booking_head_guest_phone: String,
    booking_number_of_guest: String,
    booking_checkin_date_time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    booking_checkout_date_time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    booking_status: {
        type: String,
        enum: ['0', '1', '2'], // 0=Checkin | 1=Checkout | 2=Partial Checkout
    },
    booking_is_paid: {
        type: String,
        enum: ['0', '1'], // 0=Not Paid | 1=Paid
        default: '1'
    },
    booking_bill_amount_per_guest: String,
    booking_bill_amount: String,
    booking_date_time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    booking_verified_by: {
        type: String,
        enum: ['0', '1', '2'], // 0=MANAGER | 1=OTP | 2=ADMIN
        default: '1'
    },
    booking_added_by: {
        type: String,
        enum: ['0', '1'], // 0=ADMIN | 1=HOTEL
        default: '0'
    },
    isDel: {
        type: String,
        enum: ['0', '1', '2'], // 0=Active | 1=Trash | 2=Permanent Delete
        default: '0'
    }
}, { timestamps: true })

module.exports = mongoose.model("booking", bookingSchema);
