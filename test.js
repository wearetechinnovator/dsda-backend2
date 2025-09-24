const crypto = require("crypto");
let a = crypto.createHash('sha1').update("helo world").digest("hex");


console.log(a);
