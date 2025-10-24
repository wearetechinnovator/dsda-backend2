const fetch = require("node-fetch");
const connectRedis = require("../db/redis");
const bookingModel = require("../models/booking.model");
const bookingDetailsModel = require("../models/bookingDetails.model");
const fileUpload = require("../helper/fileUpload");
const tripleSHA1 = require("../helper/sha1_hash");
const mongoose = require("mongoose");


const addBooking = async (req, res) => {
    const {
        mobileNumber, NumberOfGuest, checkInDate, checkInTime, verificationBy,
        guestList, hotelId, token, checkoutDate, checkoutTime
    } = req.body;

    if ([mobileNumber, NumberOfGuest, checkInDate, checkInTime, checkoutDate, checkoutTime].some(field => field === '')) {
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
    // =====================================[ All Validation Close here ]===================================

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
            booking_checkout_date_time: `${checkoutDate} ${checkoutTime}`,
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
            let photoPath = "";
            if (guest.idProof) {
                uploadPath = await fileUpload(guest.idProof);
            }
            if (guest.photo) {
                photoPath = await fileUpload(guest.photo);
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
                booking_details_checkout_date_time: `${checkoutDate} ${checkoutTime}`,
                booking_details_charge_amount_for_this_guest: getSiteSetting.charges_per_tourist || 0,
                booking_details_guest_dob: guest.dob,
                booking_details_guest_photo: photoPath
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
    const isEnrolled = req.body?.enrolled;
    const hotelId = req.body?.hotelId;


    try {
        const redisDB = await connectRedis();


        // ::::::::::::: [ Provide Hotel and Get Total Enrolled Data ]:::::::::::::
        if (hotelId && isEnrolled) {
            const data = await bookingModel.aggregate([
                {
                    $match: {
                        booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)),
                        IsDel: "0"
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalGuests: {
                            $sum: { $toInt: "$booking_number_of_guest" }
                        },
                        totalCharges: {
                            $sum: { $toInt: "$booking_bill_amount" }
                        }
                    }
                }
            ]);

            if (!data) {
                return res.status(404).json({ err: 'No data found' });
            }

            return res.status(200).json(data);

        }

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
            query.booking_details_status = {
                $eq: "0"
            }
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
        if (hotelId) {
            query.booking_details_hotel_id = hotelId;
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


// :::::::::::::::::::::::::: [GET ALL STATICTICS DATA SPESIFIC HOTEL] ::::::::::::::::::::::::
const getStat = async (req, res) => {
    const hotelId = req.body?.hotelId;
    const getOccupied = req.body?.occupied;

    if (!hotelId) {
        return res.status(400).json({ err: "Please fill all required fields." });
    }

    try {
        const todayStr = new Date().toISOString().split("T")[0]; // "2025-10-24"


        // Total Occupied bed
        const occu = await bookingDetailsModel.find({
            booking_details_hotel_id: hotelId,
            booking_details_status: "0"
        });
        // When get only occupied data: `USED IN MASTER SERVICES`;
        if (getOccupied) {
            return res.status(200).json({ occupied: occu.length || 0 });
        }

        // Total Footfall
        const getTotalFootFall = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)),
                    IsDel: "0",
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
        const getTodayFootFall = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)),
                    booking_checkin_date_time: { $regex: `^${todayStr}` },
                    IsDel: "0",
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
                    booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)),
                    booking_checkin_date_time: { $regex: `^${todayStr}` },
                    IsDel: "0",
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } },
                },
            },
        ]);

        // Total Amenities
        const totalAmenity = await bookingModel.aggregate([
            {
                $match: {
                    booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)),
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


// FOR ALL HOTEL
const getTotalStatsforAdmin = async (req, res) => {
    try {
        // Get Setting from Admin //Service 1
        const getAdminSetting = await fetch(process.env.MASTER_API + "/site-setting/get", { method: 'post' })
        const { age_for_charges } = await getAdminSetting.json();

        // Get today's start and end timestamps
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);


        const [
            todayActiveHotel, totalOccupied, todayFootFall,
            totalFootFall, totalForeigner, totalIndian, totalMale, totalFemale,
            totalOtherGender, todayAminityCharge, totalAminityCharge, todayChild,
            totalChild, totalAdult, todayAdult
        ] = await Promise.all([
            // Total Active Hotels;
            await bookingModel.countDocuments({
                IsDel: '0',
                booking_status: '0',
                booking_checkin_date_time: {
                    $gte: startOfDay.toISOString(),
                    $lte: endOfDay.toISOString()
                }
            }),

            // Total Occupied Beds;
            await bookingDetailsModel.countDocuments({
                booking_details_status: "0"
            }),

            // Today Footfalls;
            await bookingModel.aggregate([
                {
                    $match: {
                        IsDel: "0",
                        booking_checkin_date_time: {
                            $gte: startOfDay.toISOString(),
                            $lte: endOfDay.toISOString(),
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalFootFall: { $sum: { $toDouble: "$booking_number_of_guest" } }
                    },
                },
            ]),

            // All Footfalls;
            await bookingModel.aggregate([
                {
                    $match: {
                        IsDel: "0",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalFootFall: { $sum: { $toDouble: "$booking_number_of_guest" } }
                    },
                },
            ]),

            // Till Today Foreigner
            await bookingDetailsModel.countDocuments({
                booking_details_guest_nationality: "foreign", IsDel: "0"
            }),

            // Till Today Indian;
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                $or: [
                    { booking_details_guest_nationality: "india" },
                    { booking_details_guest_nationality: "" }
                ]
            }),


            // Till Today Male
            await bookingDetailsModel.countDocuments({
                booking_details_guest_gender: "male", IsDel: "0"
            }),

            // Till Today Female
            await bookingDetailsModel.countDocuments({
                booking_details_guest_gender: "female", IsDel: "0"
            }),

            // Till Today Other Gender
            await bookingDetailsModel.countDocuments({
                booking_details_guest_gender: { $nin: ["male", "female"] },
                IsDel: "0",
            }),

            // Today Aminity Charge
            await bookingModel.aggregate([
                {
                    $match: {
                        booking_checkin_date_time: {
                            $gte: startOfDay.toISOString(),
                            $lte: endOfDay.toISOString(),
                        },
                        IsDel: "0",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } }
                    },
                },
            ]),

            // Total Aminity Charge;
            await bookingModel.aggregate([
                {
                    $match: {
                        IsDel: "0",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } }
                    },
                },
            ]),

            // Today Child
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                $expr: { $lt: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            }),

            // Total Child
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                $expr: { $lt: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            }),

            // Total Adult
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                $expr: { $gte: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            }),

            // Today Adult
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                $expr: { $gte: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            })
        ])


        return res.status(200).json({
            active_hotel: todayActiveHotel,
            total_occupied: totalOccupied,
            today_footfall: todayFootFall[0]?.totalFootFall || 0,
            total_footfall: totalFootFall[0]?.totalFootFall || 0,
            total_foreigner: totalForeigner,
            total_indian: totalIndian,
            total_male: totalMale,
            total_female: totalFemale,
            total_other_gender: totalOtherGender,
            today_aminity_charge: todayAminityCharge[0]?.totalAmount || 0,
            total_aminity_charge: totalAminityCharge[0]?.totalAmount || 0,
            today_child: todayChild,
            total_child: totalChild,
            total_adult: totalAdult,
            today_adult: todayAdult
        })

    } catch (error) {
        console.error(error);
        return res.status(500).json({ err: "Something went wrong" });
    }
}


// Admin Tourist Data Date and Hotel wise
const touristFootfallDate = async (req, res) => {
    const hotelId = req.body?.id;
    const limit = Number(req.body?.limit) || 10;
    const page = Number(req.body?.page) || 1;
    const search = req.body?.search?.trim() || "";
    const startDate = req.body?.startDate;
    const endDate = req.body?.endDate;
    const skip = (page - 1) * limit;

    if (!hotelId || !startDate || !endDate) {
        return res.status(500).json({ err: "fill the required" })
    }

    try {
        const redisDB = await connectRedis();

        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const enrolledData = await bookingModel.find({
            booking_hotel_id: hotelId,
            IsDel: '0',
            booking_checkin_date_time: {
                $gte: startDateTime,
                $lte: endDateTime
            }
        })
            .skip(skip)
            .limit(limit)
            .sort({ _id: -1 });

        const totalCount = await bookingModel.countDocuments({
            booking_hotel_id: hotelId,
            IsDel: '0',
            booking_checkin_date_time: {
                $gte: startDateTime,
                $lte: endDateTime
            }
        });

        const result = { data: enrolledData, total: totalCount, page, limit };

        return res.status(200).json(result);

    } catch (error) {
        console.error("touristFootfallData error:", error);
        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};


// Daywise Tourist Footfall
const touristFootfalDayWise = async (req, res) => {
    const limit = Number(req.body?.limit) || 10;
    const page = Number(req.body?.page) || 1;
    const search = req.body?.search?.trim() || "";
    const skip = (page - 1) * limit;
    const { hotelId, startDate, endDate, zone, sector, block, district, policeStation } = req.body;

    try {
        const redisDB = await connectRedis();
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // Get Setting;
        const getAdminSetting = await fetch(`${process.env.MASTER_API}/site-setting/get`, { method: 'post' });
        const { age_for_charges } = await getAdminSetting.json();
        const adultAge = parseFloat(age_for_charges);

        let matches = { IsDel: "0" };
        if (hotelId) {
            matches.booking_details_hotel_id = hotelId;
        }
        if (startDate && endDate) {
            matches.booking_details_checkin_date_time = {
                $gte: startDateTime,
                $lte: endDateTime
            }
        }
        if (zone || sector || district || policeStation) {
            let ids = [];
            const hotelListReq = await fetch(`${process.env.MASTER_API}/hotel/get`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    zone, sector, block, policeStation, district,
                    limit: 5000000
                })
            });
            const hotelList = await hotelListReq.json();
            hotelList.data?.forEach(h => {
                ids.push(h._id);
            });

            matches.booking_details_hotel_id = {
                $in: ids
            }

        }

        const guestStats = await bookingDetailsModel.aggregate([
            { $match: matches },
            {
                $group: {
                    _id: "$booking_details_hotel_id", // Group by hotel ID
                    totalMale: { $sum: { $cond: [{ $eq: ["$booking_details_guest_gender", "male"] }, 1, 0] } },
                    totalFemale: { $sum: { $cond: [{ $eq: ["$booking_details_guest_gender", "female"] }, 1, 0] } },
                    totalOtherGender: { $sum: { $cond: [{ $and: [{ $ne: ["$booking_details_guest_gender", "male"] }, { $ne: ["$booking_details_guest_gender", "female"] }] }, 1, 0] } },
                    totalAdult: { $sum: { $cond: [{ $gte: [{ $toDouble: "$booking_details_guest_age" }, adultAge] }, 1, 0] } },
                    totalChild: { $sum: { $cond: [{ $lt: [{ $toDouble: "$booking_details_guest_age" }, adultAge] }, 1, 0] } },
                    totalForeigner: { $sum: { $cond: [{ $eq: ["$booking_details_guest_nationality", "foreign"] }, 1, 0] } },
                    totalIndian: { $sum: { $cond: [{ $in: ["$booking_details_guest_nationality", ["india", ""]] }, 1, 0] } },
                    totalFootFall: { $sum: { $cond: [{ $eq: ["$IsDel", "0"] }, 1, 0] } },
                    totalAmenitiesCharges: { $sum: { $cond: [{ $eq: ["$IsDel", "0"] }, { $toDouble: "$booking_details_charge_amount_for_this_guest" }, 0] } }

                }
            },
            { $skip: skip },
            { $limit: limit },
            { $sort: { _id: 1 } },
            {
                $project: {
                    hotelId: "$_id",
                    _id: 0,
                    totalMale: 1,
                    totalFemale: 1,
                    totalOtherGender: 1,
                    totalAdult: 1,
                    totalChild: 1,
                    totalForeigner: 1,
                    totalIndian: 1,
                    totalFootFall: 1,
                    totalAmenitiesCharges: 1
                }
            }
        ]);

        await Promise.all(
            guestStats.map(async (s) => {
                const hotelListReq = await fetch(`${process.env.MASTER_API}/hotel/get`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: s.hotelId })
                });
                const hotelList = await hotelListReq.json();
                if (hotelListReq.status === 200) {
                    s.hotel_details = hotelList; // assign to the object, not array
                } else {
                    s.hotel_details = null; // fallback if API fails
                }
            })
        );

        const totalCountAgg = await bookingDetailsModel.aggregate([
            { $match: { IsDel: "0" } },
            { $group: { _id: "$booking_details_hotel_id" } },
            { $count: "total" }
        ]);
        const totalCount = totalCountAgg[0]?.total || 0;

        const result = { data: guestStats, total: totalCount, page, limit };
        res.status(200).json(result);

    } catch (error) {
        console.error("touristFootfallData error:", error);
        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};


// Update Checkout Date Time for Booking Details
const updateCheckoutDateTime = async (req, res) => {
    try {
        const { bookingId, checkoutDateTime } = req.body;

        if (!bookingId || !checkoutDateTime) {
            return res.status(400).json({ err: "Please provide bookingId and checkoutDateTime." });
        }


        const updatedBookingDetails = await bookingDetailsModel.updateOne(
            {
                booking_details_booking_id: bookingId,
                booking_details_status: { $ne: "1" }  // ✅ Correct $ne usage
            },
            {
                $set: { booking_details_checkout_date_time: checkoutDateTime }
            }
        );


        const updatedBooking = await bookingModel.updateOne(
            {
                _id: bookingId,
                booking_status: { $ne: "1" }  // ✅ Correct $ne usage
            },
            {
                $set: { booking_checkout_date_time: checkoutDateTime }
            }
        );

        if (
            (!updatedBookingDetails.matchedCount || !updatedBookingDetails.modifiedCount) &&
            (!updatedBooking.matchedCount || !updatedBooking.modifiedCount)
        ) {
            return res.status(404).json({ err: "Checkout Date not updated" });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("updateCheckoutDateTime error:", error);
        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};



// Get Total Amount Hotel Wise
const getTotalAmountHotelWise = async (req, res) => {
    const { startDate, endDate } = req.body;

    try {
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        let matches = { IsDel: "0" };

        if (startDate && endDate) {
            matches.booking_checkin_date_time = {
                $gte: startDateTime,
                $lte: endDateTime
            }
        }

        const guestStats = await bookingModel.aggregate([
            { $match: matches },
            {
                $group: {
                    _id: "$booking_hotel_id", // Group by hotel ID
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $toDouble: "$booking_bill_amount" }, 0] },
                                { $toDouble: "$booking_bill_amount" },
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    hotelId: "$_id",
                    _id: 0,
                    totalAmount: 1
                }
            }
        ]);

        res.status(200).json(guestStats);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};



// Get Booking summary by date range;
const getBookingSummaryByDateRange = async (req, res) => {
    const limit = parseInt(req.body?.limit ?? 10);
    const page = parseInt(req.body?.page ?? 1);
    const skip = (page - 1) * limit;
    const { startDate, endDate, hotelId } = req.body;

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateArray = [];
        let currentDate = new Date(start);

        while (currentDate <= end) {
            dateArray.push(currentDate.toISOString().split("T")[0]); // YYYY-MM-DD
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Aggregate bookings
        const bookings = await bookingModel.aggregate([
            {
                $match: {
                    IsDel: "0",
                    booking_checkin_date_time: {
                        $gte: start.toISOString().split("T")[0],
                        $lte: end.toISOString().split("T")[0],
                    },
                    ...(hotelId ? { booking_hotel_id: new mongoose.Types.ObjectId(hotelId) } : {})
                },
            },
            {
                $group: {
                    _id: "$booking_checkin_date_time",
                    totalGuests: { $sum: { $toInt: "$booking_number_of_guest" } },
                    totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } },
                    activeHotelIds: { $addToSet: "$booking_hotel_id" },
                },
            },
            {
                $addFields: {
                    activeHotelCount: { $size: "$activeHotelIds" },
                },
            },
            {
                $project: {
                    _id: 1,
                    totalGuests: 1,
                    totalAmount: 1,
                    activeHotelCount: 1,
                },
            },
        ]);

        // Map dates to results, fill missing dates with 0
        const fullResult = dateArray.map(date => {
            const booking = bookings.find(b => b._id.split(" ")[0] === date);
            return {
                date,
                totalGuests: booking ? booking.totalGuests : 0,
                totalAmount: booking ? booking.totalAmount : 0,
                activeHotelCount: booking ? booking.activeHotelCount : 0,
            };
        });

        // Apply pagination
        const paginatedResult = fullResult.slice(skip, skip + limit);

        return res.status(200).json({
            total: fullResult.length,
            page,
            limit,
            data: paginatedResult,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};




module.exports = {
    addBooking,
    getBooking,
    getHeadOfBooking,
    checkOut,
    getStat,
    getTotalStatsforAdmin,
    touristFootfallDate,
    touristFootfalDayWise,
    updateCheckoutDateTime,
    getTotalAmountHotelWise,
    getBookingSummaryByDateRange
}