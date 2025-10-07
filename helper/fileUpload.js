const fs = require("fs");
const path = require("path");


const fileUpload = async (file, folder = "uploads") => {
    try {
        const rootFolder = path.join(__dirname, "..", folder);
        if (!fs.existsSync(rootFolder)) {
            fs.mkdirSync(rootFolder, { recursive: true });
        }

        // Extract mime type and base64 content
        const match = file.match(/^data:(.+);base64,(.*)$/);
        if (!match) {
            throw new Error("Invalid base64 string");
        }

        const mimeType = match[1];
        const base64Data = match[2];
        const ext = mimeType.split("/")[1] || "bin";

        // Generate unique file name
        const fileName = `file_${Date.now()}.${ext}`;
        const filePath = path.join(rootFolder, fileName);

        // Save file to disk
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

        return filePath;
    } catch (error) {
        console.error("File upload error:", error);
        throw error;
    }
};

module.exports = fileUpload;
