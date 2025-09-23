const mongoose = require("mongoose");
const url = process.env.MONGO_URI;

const connection = () => {
    return new Promise((resolve, reject) => {
        mongoose.connect(url, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        })
        .then(() => resolve(true))
        .catch((err) => reject(err));
    });
};

module.exports = connection;
