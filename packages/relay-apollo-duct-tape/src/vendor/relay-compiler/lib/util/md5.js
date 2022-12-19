// We supply a murmurhash2 implementation instead of md5 for digest
// work in a browser.
import murmurhash2 from "@emotion/hash";
module.exports = murmurhash2;
