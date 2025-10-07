const crypto = require("crypto");

const tripleSHA1 = (input, times) => {
  let hash = input;
  for (let i = 0; i < times; i++) {
    hash = crypto.createHash("sha1").update(hash).digest("hex");
  }
  return hash;
};

module.exports = tripleSHA1;
