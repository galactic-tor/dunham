let config = {};

config.urls  = {};
config.siteMap = {
	"Upper Pines": 232447,
	"Tuolumne Meadows": 232448,
	"North Pines": 232449,
	"Lower Pines": 232450
};

config.dates = {};


config.puppeteer = {
	headless: true,
	executablepath: "chromium",
	// *crys in arm64 and linux containers*
    args: JSON.parse(Buffer.from("WyItLW5vLXNhbmRib3giLCAiLS1kaXNhYmxlLXNldHVpZC1zYW5kYm94Il0K", "base64").toString())
}

console.log(config.puppeteer)

localPuppeteer = { headless: false }
config.puppeteer = localPuppeteer

config.urls.base = Buffer.from("aHR0cHM6Ly93d3cucmVjcmVhdGlvbi5nb3YvY2FtcGluZy9jYW1wZ3JvdW5kcy8K", "base64").toString()

config.sites = require("../configmaps/sites.json");
config.dates = require("../configmaps/dates.json")

console.log(config)

module.exports = config;