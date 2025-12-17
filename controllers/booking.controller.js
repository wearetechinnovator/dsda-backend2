const fetch = require("node-fetch");
const bookingModel = require("../models/booking.model");
const bookingDetailsModel = require("../models/bookingDetails.model");
const fileUpload = require("../helper/fileUpload");
const tripleSHA1 = require("../helper/sha1_hash");
const mongoose = require("mongoose");
const crypto = require("crypto");
const https = require('https')



const addBooking = async (req, res) => {


    const {
        mobileNumber, NumberOfGuest, checkInDate, checkInTime, verificationBy,
        guestList, hotelId, token, checkoutDate, checkoutTime, existsCheck, hotelName
    } = req.body;

    // ======================= [Mobile Number Exsistance checking] ====================;
    if (existsCheck && mobileNumber) {
        try {
            const check = await bookingModel.find({
                booking_head_guest_phone: mobileNumber,
                booking_status: '0'
            });

            if (check.length > 0) {
                return res.status(200).json({ exist: true })
            } else {
                return res.status(200).json({ exist: false })
            }
        } catch (error) {
            return res.status(500).json({ err: "Something went wrong" });
        }
    }

    // ======================= [Booking Add] ====================;

    if ([mobileNumber, NumberOfGuest, checkInDate, checkInTime, checkoutDate, checkoutTime].some(field => field === '')) {
        return res.status(401).json({ err: 'All fields are required' })
    }

    for (let i = 0; i < guestList.length; i++) {
        const guest = guestList[i];
        if (i === 0) {
            if ([guest.guestName, guest.gender, guest.age, guest.nationality, guest.address, guest.idType, guest.idNumber, guest.mobileNumber, guest.roomNumber].some(field => !field || field === '')) {
                return res.status(401).json({ err: 'All fields are required' })
            }
        } else {
            if ([guest.guestName, guest.gender, guest.age].some(field => !field || field === '')) {
                return res.status(401).json({ err: 'All fields are required' })
            }
        }
    }
    // ============================[ All Validation Close here ]========================

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
            booking_number_of_guest: String(NumberOfGuest).trim(),
            booking_checkin_date_time: `${checkInDate} ${checkInTime}`,
            booking_checkout_date_time: `${checkoutDate} ${checkoutTime}`,
            booking_bill_amount_per_guest: getSiteSetting.charges_per_tourist || 0,
            booking_bill_amount: billAmount,
            booking_verified_by: verificationBy === "manager" ? "0" : "1",
            booking_added_by: "1",
        })


        // Add booking details
        let allGuestsToInsert = [];

        for (let i = 0; i < guestList.length; i++) {
            const guest = guestList[i];

            let uploadPath = "";
            let photoPath = "";

            if (guest.idProof) {
                uploadPath = await fileUpload(guest.idProof);
            }
            if (guest.photo) {
                photoPath = await fileUpload(guest.photo);
            }

            allGuestsToInsert.push({
                booking_details_is_head_guest: i === 0 ? '1' : '0',
                booking_details_booking_id: newBooking._id,
                booking_details_hotel_id: hotelId,
                booking_details_guest_name: guest.guestName,
                booking_details_guest_gender: guest.gender,
                booking_details_guest_age: guest.age,
                booking_details_guest_nationality: guest.nationality,
                booking_details_country: guest.nationality === "india" ? "India" : guest.country,
                booking_details_guest_address: guest.address,
                booking_details_district: guest.district,
                booking_details_state: guest.state,
                booking_details_guest_id_number: guest.idNumber,
                booking_details_guest_id_type: guest.idType,
                booking_details_guest_id_proof: uploadPath,
                booking_details_guest_phone: guest.mobileNumber,
                booking_details_room_no: guest.roomNumber,
                booking_details_checkin_date_time: `${checkInDate} ${checkInTime}`,
                booking_details_checkout_date_time: `${checkoutDate} ${checkoutTime}`,
                booking_details_charge_amount_for_this_guest: (parseInt(guest.age) > parseInt(getSiteSetting.age_for_charges) ? getSiteSetting.charges_per_tourist : 0),
                booking_details_charge_applicable: (parseInt(guest.age) > parseInt(getSiteSetting.age_for_charges) ? "1" : "0"),
                booking_details_guest_dob: guest.dob,
                booking_details_guest_photo: photoPath
            });
        }

        await bookingDetailsModel.insertMany(allGuestsToInsert);



        // =========================[SEND WELCOME MESSAGE]========================
        // =======================================================================

        const username = "WBDSDA"; // username of the department
        const password = "Admin#123"; // password of the department
        const senderid = "WBDSDA"; // sender id of the department
        const message = `Welcome to Digha. For Mahaprasad of Jagannath Dham, please contact 9059052550 Digha Sankarpur Dev Authority`; // message content
        const mobileno = guestList[0].mobileNumber; // single number
        const deptSecureKey = "9a6e9fff-02d5-4275-99f8-9992b04e7580"; // department secure key
        const templateid = "1407176303661507970"; // template id

        // Encrypt password (SHA1)
        const encryptedPassword = crypto
            .createHash("sha1")
            .update(password.trim())
            .digest("hex");


        // Generate key (SHA512)
        const key = crypto
            .createHash("sha512")
            .update(
                username.trim() +
                senderid.trim() +
                message.trim() +
                deptSecureKey.trim()
            )
            .digest("hex");

        // Prepare data
        const data = {
            username: username.trim(),
            password: encryptedPassword.trim(),
            senderid: senderid.trim(),
            content: message.trim(),
            smsservicetype: "singlemsg",
            mobileno: mobileno.trim(),
            key: key.trim(),
            templateid: templateid.trim(),
        };




        const body = new URLSearchParams(data);
        const agent = new https.Agent({ rejectUnauthorized: false });
        const url = "https://msdgweb.mgov.gov.in/esms/sendsmsrequestDLT";
        await fetch(url, {
            method: "POST",
            body: body,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            agent: agent
        });



        const message2 = `You are successfully checked in ${hotelName} from ${checkInDate} to ${checkoutDate} and amount of Rs. ${billAmount} received for ${NumberOfGuest} Person -Digha Sankarpur Dev Authority`;
        const templateid2 = "1407176554324712567"; // template id
        // Prepare data
        const data2 = {
            username: username.trim(),
            password: encryptedPassword.trim(),
            senderid: senderid.trim(),
            content: message2.trim(),
            smsservicetype: "singlemsg",
            mobileno: mobileno.trim(),
            key: key.trim(),
            templateid: templateid2.trim(),
        };
        const body2 = new URLSearchParams(data2);
        await fetch(url, {
            method: "POST",
            body: body2,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            agent: agent
        });

        return res.status(200).json(newBooking);

    } catch (error) {
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
            const data = await bookingDetailsModel.find({
                booking_details_booking_id: bookingId, IsDel: "0", booking_details_status: "0"
            });
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
            .skip(skip).limit(limit).sort({
                booking_details_checkin_date_time: -1,
                booking_details_booking_id: -1,
                booking_details_is_head_guest: -1
            }).populate('booking_details_booking_id');
        const totalCount = await bookingDetailsModel.countDocuments(query);

        const result = { data: data, total: totalCount, page, limit };

        return res.status(200).json(result);

    } catch (error) {

        return res.status(500).json({ err: "Something went wrong" });
    }
}


const deleteBooking = async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({ err: "Please provide booking id" });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ err: "Invalid booking id" });
    }

    try {
        // Soft delete booking
        const bookingResult = await bookingModel.updateOne(
            { _id: new mongoose.Types.ObjectId(String(bookingId)) },
            { $set: { IsDel: '2' } }
        );

        if (bookingResult.matchedCount === 0) {
            return res.status(404).json({ err: "Booking not found" });
        }

        // Soft delete booking details (optional but recommended)
        await bookingDetailsModel.updateMany(
            { booking_details_booking_id: new mongoose.Types.ObjectId(String(bookingId)) },
            { $set: { IsDel: '2' } }
        );

        return res.status(200).json({ msg: "Booking deleted successfully" });

    } catch (error) {
        console.error("Delete booking error:", error);
        return res.status(500).json({ err: "Something went wrong" });
    }
};



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

        return res.status(200).json(result);

    } catch (error) {

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
        return res.status(500).json({ err: "Something went wrong" });
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

        const pipeline = [
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
                    totalFootFall: {
                        $sum: { $toDouble: "$booking_number_of_guest" }
                    },
                },
            },
        ];

        // log the query



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

        return res.status(500).json({ err: "Something went wrong" });
    }
}


// FOR ALL HOTEL
const getTotalStatsforAdmin = async (req, res) => {
    const { token } = req.body;

    try {
        // Get Setting from Admin //Service 1
        const getAdminSetting = await fetch(process.env.MASTER_API + "/site-setting/get", {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        })
        const { age_for_charges } = await getAdminSetting.json();

        const todayStr = new Date().toISOString().split("T")[0]; // "2025-10-24"


        const [
            todayActiveHotel, totalOccupied, todayFootFall,
            totalFootFall, totalForeigner, totalIndian, totalMale, totalFemale,
            totalOtherGender, todayAminityCharge, totalAminityCharge, todayChild,
            totalChild, totalAdult, todayAdult
        ] = await Promise.all([
            // Total Active Hotels;
            await bookingModel.aggregate([
                {
                    $match: {
                        IsDel: "0",
                        booking_checkin_date_time: { $regex: `^${todayStr}` },
                    },
                },
                {
                    $group: {
                        _id: "$booking_hotel_id",
                    },
                },
                {
                    $count: "uniqueHotelCount",
                },
            ]),

            // Total Occupied Beds;
            await bookingDetailsModel.countDocuments({
                booking_details_status: "0"
            }),

            // Today Footfalls;
            await bookingModel.aggregate([
                {
                    $match: {
                        IsDel: "0",
                        booking_checkin_date_time: { $regex: `^${todayStr}` },
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
                booking_details_guest_gender: "Male", IsDel: "0"
            }),

            // Till Today Female
            await bookingDetailsModel.countDocuments({
                booking_details_guest_gender: "Female", IsDel: "0"
            }),

            // Till Today Other Gender
            await bookingDetailsModel.countDocuments({
                booking_details_guest_gender: { $nin: ["Male", "Female"] },
                IsDel: "0",
            }),

            // Today Aminity Charge
            await bookingModel.aggregate([
                {
                    $match: {
                        booking_checkin_date_time: { $regex: `^${todayStr}` },
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
                booking_details_checkin_date_time: { $regex: `^${todayStr}` },
                $expr: { $lte: [{ $toDouble: "$booking_details_guest_age" }, age_for_charges] }
            }),

            // Total Child
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                $expr: { $lte: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            }),

            // Total Adult
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                $expr: { $gt: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            }),

            // Today Adult
            await bookingDetailsModel.countDocuments({
                IsDel: "0",
                booking_details_checkin_date_time: { $regex: `^${todayStr}` },
                $expr: { $gt: [{ $toDouble: "$booking_details_guest_age" }, parseFloat(age_for_charges)] }
            })
        ])


        return res.status(200).json({
            active_hotel: todayActiveHotel[0]?.uniqueHotelCount || 0,
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
        return res.status(500).json({ err: "Something went wrong", msg: error });
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
    const { hotelId, startDate, endDate, zone, sector, block, district, policeStation, token } = req.body;

    try {
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // Get Setting;
        const getAdminSetting = await fetch(`${process.env.MASTER_API}/site-setting/get`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                hotelToken: token
            })
        });
        const { age_for_charges } = await getAdminSetting.json();
        const adultAge = parseFloat(age_for_charges);

        let matches = { IsDel: "0" };
        if (hotelId) {
            matches.booking_details_hotel_id = new mongoose.Types.ObjectId(String(hotelId));
        }
        if (startDate && endDate) {
            matches.booking_details_checkin_date_time = {
                $gte: startDateTime,
                $lte: endDateTime
            }
        }

        if (zone || sector || block || district || policeStation) {
            const hotelFilter = {
                zone: zone || undefined,
                sector: sector || undefined,
                block: block || undefined,
                policeStation: policeStation || undefined,
                district: district || undefined,
                limit: 900000000,
                hotelToken: token
            };

            const hotelListReq = await fetch(`${process.env.MASTER_API}/hotel/get`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hotelFilter)
            });

            const hotelList = await hotelListReq.json();
            const ids = hotelList.data?.map(h => new mongoose.Types.ObjectId(String(h._id))) || [];

            matches.booking_details_hotel_id = { $in: ids };
        }


        const guestStats = await bookingDetailsModel.aggregate([
            { $match: matches },
            {
                $group: {
                    _id: "$booking_details_hotel_id", // Group by hotel ID
                    totalMale: { $sum: { $cond: [{ $eq: ["$booking_details_guest_gender", "Male"] }, 1, 0] } },
                    totalFemale: { $sum: { $cond: [{ $eq: ["$booking_details_guest_gender", "Female"] }, 1, 0] } },
                    totalOtherGender: { $sum: { $cond: [{ $and: [{ $ne: ["$booking_details_guest_gender", "Male"] }, { $ne: ["$booking_details_guest_gender", "Female"] }] }, 1, 0] } },
                    totalAdult: { $sum: { $cond: [{ $gt: [{ $toDouble: "$booking_details_guest_age" }, adultAge] }, 1, 0] } },
                    totalChild: { $sum: { $cond: [{ $lte: [{ $toDouble: "$booking_details_guest_age" }, adultAge] }, 1, 0] } },
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
                    body: JSON.stringify({ id: s.hotelId, hotelToken: token })
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
            { $match: matches },
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


        const updatedBookingDetails = await bookingDetailsModel.updateMany(
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

        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};



// Get Total Amount Hotel Id
const getTotalAmountHotelId = async (req, res) => {
    const { startDate, endDate, hotelId } = req.body;

    try {
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        let matches = { IsDel: "0", booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)) };

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

        // build date array (YYYY-MM-DD)
        const dateArray = [];
        let currentDate = new Date(start);
        while (currentDate <= end) {
            dateArray.push(currentDate.toISOString().split("T")[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // base match without date (we'll filter by onlyDate in pipeline)
        let baseMatch = {
            IsDel: "0",
            ...(hotelId ? { booking_hotel_id: new mongoose.Types.ObjectId(String(hotelId)) } : {})
        };


        // Use string YYYY-MM-DD for range comparison after we compute onlyDate
        const startStr = start.toISOString().split("T")[0];
        const endStr = end.toISOString().split("T")[0];

        const bookings = await bookingModel.aggregate([
            { $match: baseMatch },

            // Convert datetime string to Date then to YYYY-MM-DD string
            {
                $addFields: {
                    onlyDate: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            // If your field is already a date type you can omit $toDate
                            date: { $toDate: "$booking_checkin_date_time" }
                        }
                    }
                }
            },

            // Filter by onlyDate range (works with YYYY-MM-DD strings)
            {
                $match: {
                    onlyDate: { $gte: startStr, $lte: endStr }
                }
            },

            // Group by onlyDate (NOT raw datetime)
            {
                $group: {
                    _id: "$onlyDate",
                    totalGuests: { $sum: { $toInt: "$booking_number_of_guest" } },
                    totalAmount: { $sum: { $toDouble: "$booking_bill_amount" } },
                    activeHotelIds: { $addToSet: "$booking_hotel_id" }
                }
            },

            {
                $addFields: {
                    activeHotelCount: { $size: "$activeHotelIds" }
                }
            },

            {
                $project: {
                    _id: 1,
                    totalGuests: 1,
                    totalAmount: 1,
                    activeHotelCount: 1
                }
            },

            // optional: sort by date ascending
            { $sort: { _id: 1 } }
        ]);

        // Map dates to results, match by exact YYYY-MM-DD (no split)
        const fullResult = dateArray.map(date => {
            const booking = bookings.find(b => b._id === date);
            return {
                date,
                totalGuests: booking ? booking.totalGuests : 0,
                totalAmount: booking ? booking.totalAmount : 0,
                activeHotelCount: booking ? booking.activeHotelCount : 0
            };
        });

        // Pagination
        const paginatedResult = fullResult.slice(skip, skip + limit);

        return res.status(200).json({
            total: fullResult.length,
            page,
            limit,
            data: paginatedResult
        });
    } catch (error) {

        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};



// Get Hotel Details with Total Guest Enrolled and Total Charges;
const getHotelWithEnrolledData = async (req, res) => {
    const limit = parseInt(req.body?.limit ?? 10);
    const page = parseInt(req.body?.page ?? 1);
    const skip = (page - 1) * limit;
    const { startDate, endDate, hotelId } = req.body;

    try {
        // Build dynamic match filter
        const matchFilter = { IsDel: "0" };

        // Add optional date filter
        if (startDate && endDate) {
            if (startDate === endDate) {
                matchFilter.booking_checkin_date_time = { $regex: `^${startDate}` };
            } else {
                matchFilter.booking_checkin_date_time = {
                    $gte: new Date(startDate).toISOString().split("T")[0],
                    $lte: new Date(endDate).toISOString().split("T")[0],
                };
            }

        }

        // Add optional hotel filter
        if (hotelId) {
            matchFilter.booking_hotel_id = new mongoose.Types.ObjectId(hotelId);
        }

        // Main aggregation with pagination
        const bookings = await bookingModel.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: "$booking_hotel_id",
                    totalEnrolled: { $sum: { $toInt: "$booking_number_of_guest" } },
                    totalCharges: { $sum: { $toDouble: "$booking_bill_amount" } },
                },
            },
            {
                $project: {
                    _id: 0,
                    hotelId: "$_id",
                    totalEnrolled: 1,
                    totalCharges: 1,
                },
            },
            { $sort: { totalEnrolled: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]);

        // Total count for pagination
        const totalCount = await bookingModel.aggregate([
            { $match: matchFilter },
            { $group: { _id: "$booking_hotel_id" } },
            { $count: "total" },
        ]);

        const total = totalCount[0]?.total ?? 0;

        return res.status(200).json({
            total,
            page,
            limit,
            data: bookings,
        });

    } catch (error) {

        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
};



// Get booking data for public bill View;
const getPublicBookingDetails = async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(401).json({ err: "Please provide bill id" });
    }

    try {
        const bookingData = await bookingModel.findOne({ _id: id }).populate('booking_hotel_id')

        if (!bookingData) {
            return res.status(404).json({ err: 'Bill not found' })
        }

        return res.status(200).json(bookingData);

    } catch (error) {

        return res.status(500).json({ success: false, err: "Something went wrong" });
    }
}



const autoChekout = async (req, res) => {
    try {
        // Convert IST date into DB-compatible string format
        function getISTDateString() {
            const utcNow = Date.now();
            const IST_OFFSET = 5.5 * 60 * 60 * 1000;
            const d = new Date(utcNow + IST_OFFSET);

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");

            const hours = String(d.getHours()).padStart(2, "0");
            const mins = String(d.getMinutes()).padStart(2, "0");
            const secs = String(d.getSeconds()).padStart(2, "0");

            return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
        }

        const nowIST = getISTDateString();

        // Auto checkout for booking details
        const checkoutBookingDetails = await bookingDetailsModel.updateMany(
            {
                booking_details_status: "0",             // active
                booking_details_checkout_date_time: { $lt: nowIST, $nin: ["", null] }
            },
            {
                $set: {
                    booking_details_status: "1",
                    booking_details_checkout_date_time: nowIST
                }
            }
        );

        // Auto checkout for booking header
        const checkoutBooking = await bookingModel.updateMany(
            {
                booking_status: "0",                     // active
                booking_checkout_date_time: { $lt: nowIST, $nin: ["", null] }
            },
            {
                $set: {
                    booking_status: "1",
                    booking_checkout_date_time: nowIST
                }
            }
        );

        if (checkoutBookingDetails.modifiedCount > 0 || checkoutBooking.modifiedCount > 0) {
            return res.status(200).json({ msg: "Auto checkout successfully" });
        }

        return res.status(500).json({ err: "Unable to auto checkout" });

    } catch (error) {
        console.error("Checkout error:", error);
        return res.status(500).json({ err: "Something went wrong" });
    }
};



module.exports = {
    addBooking,
    getBooking,
    deleteBooking,
    getHeadOfBooking,
    checkOut,
    getStat,
    getTotalStatsforAdmin,
    touristFootfallDate,
    touristFootfalDayWise,
    updateCheckoutDateTime,
    getTotalAmountHotelWise,
    getBookingSummaryByDateRange,
    getHotelWithEnrolledData,
    getTotalAmountHotelId,
    getPublicBookingDetails,
    autoChekout
}
