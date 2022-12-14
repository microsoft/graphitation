// We supply a murmurhash2 implementation instead of md5 for digest
// work in a browser.
module.exports = require("@emotion/hash").default;
