let config = {};

config.urls  = {};
config.siteMap = {
	"Upper Pines": 232447,
	"Tuolumne Meadows": 232448,
	"North Pines": 232449,
	"Lower Pines": 232450
};

config.dates = {};

if (process.env.NODE_ENV !== 'production') {
	config.puppeteer = {}
} else {
	config.puppeteer = {
		headless: true,
		executablePath: "chromium",
		// *crys in arm64 and linux containers*
		args: JSON.parse(Buffer.from("WyItLW5vLXNhbmRib3giLCAiLS1kaXNhYmxlLXNldHVpZC1zYW5kYm94Il0K", "base64").toString())
	}
}

config.blockRequests = {
    resourceTypes: ['image'],
    contains: [
        "cdn.recreation.gov",
        "api.mapbox.com",
        "events.mapbox.com",
        "doublclick.net",
        "google-analytics.com",
		// "launchdarkly", Without launch darkley the checkout button doesn't work
        "/api/ratingview/",
        "/api/recommendation/",
	]
};

config.urls.base = Buffer.from("aHR0cHM6Ly93d3cucmVjcmVhdGlvbi5nb3YvY2FtcGluZy9jYW1wZ3JvdW5kcy8=", "base64").toString()

config.sites = require("../configmaps/sites.json");
config.dates = require("../configmaps/dates.json");

module.exports = config;