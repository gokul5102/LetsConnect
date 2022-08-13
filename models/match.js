var mongoose = require("mongoose");

var matchSchema = new mongoose.Schema({
    mentor: String,
    mentee: String,
});

module.exports = mongoose.model("Match", matchSchema);
