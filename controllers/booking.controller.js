const fetch = require("node-fetch");
const connectRedis = require("../db/redis");
const bookingModel = require("../models/booking.model");
const bookingDetailsModel = require("../models/bookingDetails.model");
const fileUpload = require("../helper/fileUpload");
const tripleSHA1 = require("../helper/sha1_hash");


const addBooking = async (req, res) => {
    const {
        mobileNumber, NumberOfGuest, checkInDate, checkInTime, verificationBy,
        guestList, hotelId, token
    } = req.body;

    if ([mobileNumber, NumberOfGuest, checkInDate, checkInTime].some(field => field === '')) {
        return res.status(401).json({ err: 'All fields are required first' })
    }

    for (let i = 0; i < guestList.length; i++) {
        const guest = guestList[i];
        if (i === 0) {
            if ([guest.guestName, guest.gender, guest.age, guest.nationality, guest.address, guest.idType, guest.idNumber, guest.idProof, guest.mobileNumber, guest.roomNumber].some(field => !field || field === '')) {
                return res.status(401).json({ err: 'All fields are required sec' })
            }
        } else {
            if ([guest.guestName, guest.gender, guest.age].some(field => !field || field === '')) {
                return res.status(401).json({ err: 'All fields are required sec' })
            }
        }

    }
    // ============================= [All Validation Close here] ==========================

    try {
        let getSiteSetting;
        let billAmount;

        // Get Settings;
        getSiteSetting = await fetch(process.env.MASTER_API + "/site-setting/get", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token: token })
        })
        getSiteSetting = await getSiteSetting.json();


        // Get Number of Guest and Total  Amount
        let numOfGuest = guestList.filter(guest =>
            parseInt(guest.age) > parseInt(getSiteSetting.age_for_charges)).length;
        billAmount = (getSiteSetting.charges_per_tourist || 0) * numOfGuest;


        // Add booking
        const newBooking = await bookingModel.create({
            booking_hotel_id: hotelId,
            booking_head_guest_name: guestList[0].guestName,
            booking_head_guest_phone: guestList[0].mobileNumber,
            booking_number_of_guest: NumberOfGuest,
            booking_checkin_date_time: `${checkInDate} ${checkInTime}`,
            booking_bill_amount_per_guest: getSiteSetting.charges_per_tourist || 0,
            booking_bill_amount: billAmount,
            booking_verified_by: verificationBy === "manager" ? "0" : "1",
            booking_added_by: "1",
        })


        // Add booking details
        for (let i = 0; i < guestList.length; i++) {
            const guest = guestList[i];

            // Upload file
            let uploadPath = "";
            if (guest.idProof) {
                uploadPath = await fileUpload(guest.idProof);
            }
            // let pathHash = tripleSHA1(upload, 3);


            await bookingDetailsModel.create({
                booking_details_is_head_guest: i === 0 ? '1' : '0',
                booking_details_booking_id: newBooking._id,
                booking_details_hotel_id: hotelId,
                booking_details_guest_name: guest.guestName,
                booking_details_guest_gender: guest.gender,
                booking_details_guest_age: guest.age,
                booking_details_guest_nationality: guest.nationality,
                booking_details_guest_address: guest.address,
                booking_details_guest_id_number: guest.idNumber,
                booking_details_guest_id_type: guest.idType,
                booking_details_guest_id_proof: uploadPath,
                booking_details_guest_phone: guest.mobileNumber,
                booking_details_room_no: guest.roomNumber,
                booking_details_checkin_date_time: `${checkInDate} ${checkInTime}`,
            });
        }

        return res.status(200).json(newBooking);


    } catch (error) {
        console.log(error);
        return res.status(500).json({ err: "Something went wrong" });
    }

}

// All Booking info
const getBooking = async (req, res) => {
    const id = req.body?.id;
    const limit = req.body?.limit ?? 10;
    const page = req.body?.page ?? 1;
    const search = req.body?.search?.trim();
    const trash = req.body?.trash;
    const skip = (page - 1) * limit;
    const bookingId = req.body?.bookingId; //Get booking Details using booking id


    try {
        const redisDB = await connectRedis();

        if (bookingId) {
            const data = await bookingDetailsModel.find({ booking_details_booking_id: bookingId, IsDel: "0" });
            if (!data) {
                return res.status(404).json({ err: 'No data found' });
            }

            return res.status(200).json(data);
        }

        if (id) {
            const data = await bookingDetailsModel.findOne({ _id: id, IsDel: "0" });
            if (!data) {
                return res.status(404).json({ err: 'No data found' });
            }

            return res.status(200).json(data);
        }

        if (search) {
            const regex = new RegExp(search, "i");
            const data = await bookingDetailsModel.find({ IsDel: "0", name: regex })

            return res.status(200).json(data);
        }


        const cacheKey = `booking-details:page=${page}:limit=${limit}`;
        // const cachedUsers = await redisDB.get(cacheKey);

        // if (cachedUsers) {
        //     return res.status(200).json(JSON.parse(cachedUsers));
        // }

        const data = await bookingDetailsModel.find({ IsDel: trash ? "1" : "0" })
            .skip(skip).limit(limit).sort({ _id: -1 });
        const totalCount = await bookingDetailsModel.countDocuments({ IsDel: trash ? "1" : "0" });

        const result = { data: data, total: totalCount, page, limit };

        await redisDB.setEx(cacheKey, 5, JSON.stringify(result));

        return res.status(200).json(result);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ err: "Something went wrong" });
    }
}


// ::::::::::::::::::: [GET HEAD OF BOOKING FROM BOOKING MODEL] ::::::::::::::::
const getHeadOfBooking = async (req, res) => {
    const id = req.body?.id;
    const limit = req.body?.limit ?? 10;
    const page = req.body?.page ?? 1;
    const search = req.body?.search?.trim();
    const trash = req.body?.trash;
    const skip = (page - 1) * limit;

    try {
        const redisDB = await connectRedis();

        if (id) {
            const data = await bookingModel.findOne({ _id: id, IsDel: "0" });
            if (!data) {
                return res.status(404).json({ err: 'No data found' });
            }

            return res.status(200).json(data);
        }

        if (search) {
            const regex = new RegExp(search, "i");
            const data = await bookingModel.find({ IsDel: "0", name: regex })

            return res.status(200).json(data);
        }


        const cacheKey = `headBookingGet:page=${page}:limit=${limit}`;
        // const cachedUsers = await redisDB.get(cacheKey);

        // if (cachedUsers) {
        //     return res.status(200).json(JSON.parse(cachedUsers));
        // }

        const data = await bookingModel.find({ IsDel: trash ? "1" : "0" })
            .skip(skip).limit(limit).sort({ _id: -1 });
        const totalCount = await bookingModel.countDocuments({ IsDel: trash ? "1" : "0" });

        const result = { data: data, total: totalCount, page, limit };

        await redisDB.setEx(cacheKey, 5, JSON.stringify(result));

        return res.status(200).json(result);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ err: "Something went wrong" });
    }

}

const checkOut = async (req, res) => {

}


module.exports = {
    addBooking,
    getBooking,
    getHeadOfBooking
}