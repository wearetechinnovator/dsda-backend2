const mongoose = require("mongoose");

const bookingDetailsSchema = new mongoose.Schema({
    booking_details_booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'booking',
        required: true,
        index: true
    },
    booking_details_hotel_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    booking_details_is_head_guest: {
        type: String,
        enum: ['0', '1'], // 0=No | 1=Yes
    },
    booking_details_guest_name: String,
    booking_details_guest_phone: String,
    booking_details_guest_gender: String,
    booking_details_guest_age: String,
    booking_details_guest_nationality: String,
    booking_details_guest_address: String,
    booking_details_country: String,
    booking_details_state: String,
    booking_details_district: String,
    booking_details_address: String,
    booking_details_room_no: String,
    booking_details_guest_id_type: String,
    booking_details_guest_id_proof: String,
    booking_details_guest_id_number: String,
    booking_details_checkin_date_time: String,
    booking_details_checkout_date_time: String,
    booking_details_status: {
        type: String,
        enum: ['0', '1'], // 0=checkin | 1=checkout 
        default: '0',
        index: true
    },
    booking_details_extra_occupancy: {
        type: String,
        enum: ['0', '1'], // 0=No | 1=Yes
        default: '0',
    },
    booking_details_charge_applicable: {
        type: String,
        enum: ['0', '1'], // 0=No | 1=Yes
        default: '1'
    },
    booking_details_charge_amount_for_this_guest: String,
    IsDel: {
        type: String,
        enum: ['0', '1', '2'], // 0=Active | 1=Trash | 2=Permanent Delete
        default: '0'
    }
}, { timestamps: true })

module.exports = mongoose.model("booking_details", bookingDetailsSchema);
