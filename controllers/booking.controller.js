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
            if ([guest.guestName, guest.gender, guest.age, guest.nationality, guest.address, guest.idType, guest.idNumber, guest.mobileNumber, guest.roomNumber].some(field => !field || field === '')) {
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
    const isHead = req.body?.head;
    const mobileNumber = req.body?.mobile;
    const roomNumber = req.body?.room;
    const fromDate = req.body?.fromDate;
    const toDate = req.body?.toDate;
    const limit = req.body?.limit ?? 10;
    const page = req.body?.page ?? 1;
    const search = req.body?.search?.trim();
    const trash = req.body?.trash;
    const skip = (page - 1) * limit;
    const bookingId = req.body?.bookingId; // Get booking_details using booking id
    const isCheckIn = req.body?.checkin;
    const idCardNumber = req.body?.idCardNumber;
    const guestName = req.body?.guestName;

    try {
        const redisDB = await connectRedis();

        if (bookingId) {
            const data = await bookingDetailsModel.find({ booking_details_booking_id: bookingId, IsDel: "0", booking_details_status: "0" });
            if (!data) {
                return res.status(404).json({ err: 'No data found' });
            }

            return res.status(200).json(data);
        }

        if (id && !isCheckIn) {
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

        const query = { IsDel: trash ? "1" : "0" };

        if (isHead) {
            query.booking_details_is_head_guest = "1";
        }
        if (mobileNumber) {
            query.booking_details_guest_phone = mobileNumber;
        }
        if (roomNumber) {
            query.booking_details_room_no = roomNumber;
        }
        if (isCheckIn) {
            query.booking_details_hotel_id = id;
            query.booking_details_status = "0";
        }
        if (fromDate && toDate) {
            const dateFilter = {};

            if (fromDate) {
                dateFilter.$gte = fromDate + ' 00:00:00';
            }
            if (toDate) {
                dateFilter.$lte = toDate + ' 23:59:59';
            }

            query.booking_details_checkin_date_time = dateFilter;
        }
        if (idCardNumber) {
            query.booking_details_guest_id_number = idCardNumber
        }
        if (guestName) {
            query.booking_details_guest_name = { $regex: guestName, $options: "i" };
        }


        const data = await bookingDetailsModel.find(query)
            .skip(skip).limit(limit).sort({ _id: -1 }).populate('booking_details_booking_id');
        const totalCount = await bookingDetailsModel.countDocuments(query);

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
    const month = req.body?.month;
    const year = req.body?.year;
    const hotelId = req.body?.hotel_id;



    try {
        const redisDB = await connectRedis();

        if (id) {
            const data = await bookingModel.findOne({ _id: id, IsDel: "0" });
            if (!data) return res.status(404).json({ err: 'No data found' });
            return res.status(200).json(data);
        }


        if (search) {
            const regex = new RegExp(search, "i");
            const data = await bookingModel.find({
                IsDel: "0",
                booking_head_guest_name: regex
            });
            return res.status(200).json(data);
        }

        const cacheKey = `headBookingGet:page=${page}:limit=${limit}:month=${month}:year=${year}`;
        // const cached = await redisDB.get(cacheKey);
        // if (cached) return res.status(200).json(JSON.parse(cached));

        const query = { IsDel: trash ? "1" : "0" };
        if (hotelId) query.booking_hotel_id = hotelId;

        if (month && year) {
            const monthNum = parseInt(month);
            const yearNum = parseInt(year, 10);

            if (monthNum && !isNaN(yearNum)) {
                const monthIndex = monthNum - 1;
                const firstDay = new Date(yearNum, monthIndex, 1);
                const lastDay = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59, 999);

                const formatDate = (d) => {
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    return `${yyyy}-${mm}-${dd}`;
                };

                query.booking_checkin_date_time = {
                    $gte: formatDate(firstDay) + ' 00:00:00',
                    $lte: formatDate(lastDay) + ' 23:59:59'
                };
            }
        }

        // 🔹 Aggregation for date-wise totals
        const summaryData = await bookingModel.aggregate([
            { $match: query },
            {
                $addFields: {
                    bookingDate: {
                        $dateFromString: {
                            dateString: "$booking_checkin_date_time",
                            onError: new Date("1970-01-01"),
                            onNull: new Date("1970-01-01")
                        }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } }
                    },
                    total_guest: { $sum: { $toInt: "$booking_number_of_guest" } },
                    total_bill: { $sum: { $toDouble: "$booking_bill_amount" } }
                }
            },
            { $sort: { "_id.date": 1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        const totalCount = summaryData.length;

        // 🔹 Response (summary in data)
        const result = {
            data: summaryData.map(d => ({
                date: d._id.date,
                total_guest: d.total_guest,
                total_bill: d.total_bill
            })),
            total: totalCount,
            page,
            limit
        };

        await redisDB.setEx(cacheKey, 5, JSON.stringify(result));

        return res.status(200).json(result);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ err: "Something went wrong" });
    }
};




// CheckOut;
const checkOut = async (req, res) => {
    const { ids, bookingId, date, time, numberOfGuest } = req.body;

    if (!ids || ids.length < 1 || !bookingId || !numberOfGuest) {
        return res.status(400).json({ err: "Please fill all required fields." });
    }

    try {
        // Update booking details status
        const checkout = await bookingDetailsModel.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    booking_details_status: "1",
                    booking_details_checkout_date_time: `${date} ${time}`
                }
            }
        );

        // If any documents were updated
        if (checkout.modifiedCount > 0) {
            const getBookingData = await bookingModel.findOne({ _id: bookingId });
            const checkedOutDetails = await bookingDetailsModel.find({
                booking_details_booking_id: bookingId,
                booking_details_status: "1"
            });

            if (parseInt(checkedOutDetails.length) === parseInt(getBookingData.booking_number_of_guest)) {
                await bookingModel.updateOne(
                    { _id: bookingId },
                    {
                        $set: {
                            booking_status: "1",
                            booking_checkout_date_time: `${date} ${time}`
                        }
                    }
                );
            } else {
                await bookingModel.updateOne(
                    { _id: bookingId },
                    {
                        $set: {
                            booking_status: "2"
                        }
                    }
                );
            }

            return res.status(200).json({
                message: "Checkout updated successfully",
                updatedCount: checkout.modifiedCount
            });
        }


        return res.status(500).json({ err: "User not checkout" });


    } catch (error) {
        console.error("Checkout error:", error);
        return res.status(500).json({ err: "Something went wrong." });
    }
};



// :::::::::::::::::::::::::: [GET ALL STATICTICS DATA] ::::::::::::::::::::::::
const getStat = async (req, res) => {
    const { hotelId } = req.body;

    if (!hotelId) {
        return res.status(400).json({ err: "Please fill all required fields." });
    }

    try {
        // Total Occupied bed
        const occu = await bookingDetailsModel.find({
            booking_details_hotel_id: hotelId,
            booking_details_status: "0"
        });


        // Total Footfall
        const getTotalFootFall = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: hotelId,
                    IsDel: "0", // optional: only active bookings
                },
            },
            {
                $group: {
                    _id: null,
                    totalFootFall: { $sum: { $toDouble: "$booking_number_of_guest" } }
                },
            },
        ]);


        // Today Footfall
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const getTodayFootFall = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: hotelId,
                    booking_checkin_date_time: {
                        $gte: startOfDay.toISOString(),
                        $lte: endOfDay.toISOString(),
                    },
                    IsDel: "0", // optional: only active bookings
                },
            },
            {
                $group: {
                    _id: null,
                    totalFootFall: { $sum: { $toDouble: "$booking_number_of_guest" } }
                },
            },
        ]);


        // Today aminity charge;
        const todayTotal = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: hotelId,
                    booking_checkin_date_time: {
                        $gte: startOfDay.toISOString(),
                        $lte: endOfDay.toISOString(),
                    },
                    IsDel: "0", // optional: only active bookings
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } }
                },
            },
        ]);


        // Total Footfal
        const totalAmenity = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: hotelId,
                    IsDel: "0", // optional: only active bookings
                },
            },
            {
                $group: {
                    _id: null,

                    totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } }
                },
            },
        ]);



        return res.status(200).json({
            occupied: occu.length || 0,
            totalFootFall: getTotalFootFall[0]?.totalFootFall || 0,
            todayFootFall: getTodayFootFall[0]?.totalFootFall || 0,
            todayAminity: todayTotal[0]?.totalAmount || 0,
            totalAminity: totalAmenity[0]?.totalAmount || 0
        })

    } catch (error) {
        console.error(error);
        return res.status(500).json({ err: "Something went wrong" });
    }
}




module.exports = {
    addBooking,
    getBooking,
    getHeadOfBooking,
    checkOut,
    getStat
}