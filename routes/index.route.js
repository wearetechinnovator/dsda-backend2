const router = require("express").Router();
const bookingRoute = require("./booking.route");
const checkoutRoute = require("./checkout.route");
const path = require("path");



router.use("/check-in", bookingRoute);
router.use("/check-out", checkoutRoute);

router.get("/upload/:filename", (req, res) => {
    try {
        const fileName = req.params.filename;
        const uploadDir = path.join(__dirname, "..", "uploads");
        const filePath = path.join(uploadDir, fileName);

        if (!filePath.startsWith(uploadDir)) {
            return res.status(400).send("Invalid file path");
        }

        //for CORS Download issue
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        res.sendFile(filePath, (err) => {
            if (err) {
                return res.status(404).send("File not found");
            }
        });
    } catch (er) {
        return res.status(400).send("Invalid file path");
    }

});



module.exports = router;
