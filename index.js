// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')
const Push = require( 'pushover-notifications' )
const path = require("path")
const config = require ("./config")
const result = require('dotenv').config({
    path: path.resolve(process.cwd(), 'secrets/.env')
})

if (result.error) {
  throw result.error
}

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

function main() {
	puppeteer.launch(config.puppeteer).then(async browser => {
		const siteCheckers = config.sites.map((site) => CheckSite(browser, site))
	    const results = await Promise.allSettled(siteCheckers)
		const r = results.reduce((collector, result) => {
			if (result.status=="fulfilled") {
				collector.push(result.value)
			} else {
				console.error("no sites found ", result.reason)
			}
			return collector
		}, [])

		if (r.length < 1) {
			console.log("No sites found across all grounds")
			await browser.close()
			return 
		}

		// Try checking out if there are sites
		try {
			await BookSite(r[0].page, r[0].availableElements)
		} catch (error) {
            return Promise.reject(new Error(`failed to book site: ${error}`))
		}
        notify(config.dates.start) 
	})
}

async function notify(date) {
    var p = new Push( {
        user: process.env.PUSHOVER_USER,
        token: process.env.PUSHOVER_TOKEN,
    })
    
    var msg = {
        message: `Campsite acquired for ${date}`,
        title: "⛺ Campsite Snagged!",
        sound: 'climb'
    }
    
    return p.send(msg)
}

async function CheckSite(browser, site) {
	const page = await browser.newPage();
	await page.goto(config.urls.base+config.siteMap[site]);
	await closeModal(page);
	await campsiteListView(page);
	await setDates(page, config.dates.start, config.dates.end);
	const availableElements = await findAvailable(page)
	if (availableElements.length < 1) {
		page.close()
		return Promise.reject(new Error(`No sites found for ${site}`))
	}
	return Promise.resolve({site, page, availableElements});
}

async function BookSite(page, siteElements) {
	siteElements[0].click()
	await login(
		page, 
		process.env.USER_NAME, 
		process.env.PASSWORD
	);
	await fillYosCampsiteField(page);
	await checkout(
		page, 
		process.env.NAME,
		process.env.CCN, 
		process.env.CVC,
		process.env.EXP_MONTH,
		process.env.EXP_YEAR
	);
	return Promise.resolve("site booked")
}

async function closeModal(page) {
    const button = await page.$('aria/Close modal[role="button"]');
    if (button) {
        await button.click();
    }
}

async function campsiteListView(page) {
    const button = await page.$('#tabs-panel-0 > div.sarsa-stack.md.campsite-list-tab.v2-tab > div.mb-2.grid-header-container > button.sarsa-button.sarsa-button-tertiary.sarsa-button-md')
    if (!button) {
        return new Error("No Campsite List View Button Found")
    }
    await button.click();
}

async function setDates(page, start, end) {
    const startField = await page.$('#campground-start-date-calendar')
    const endField =  await page.$('#campground-end-date-calendar')
    if (!startField  || !endField) {
        return new Error("Could not find start or end date fields")
    }
    await startField.click()
    await startField.type(start)
    await page.waitForTimeout(1000)
    await endField.click()
    await endField.type(end)
}

async function findAvailable(page) {
	await page.waitForNetworkIdle()
    const selector = '.list-map-book-now-button-tracker'
    return page.$$(selector)
}

async function login(page, email, pw) {
    const loginBtn = await page.waitForSelector('.rec-acct-sign-in-btn', {timeout:10000})
    const emailField = await page.$('#email')
    const pwField = await page.$('#rec-acct-sign-in-password')
    await emailField.click()
    await emailField.type(email)
    await pwField.click()
    await pwField.type(pw)
    const navPromise = page.waitForNavigation()
    await loginBtn.click()
}

async function fillYosCampsiteField(page) {
    await page.waitForNetworkIdle({timeout:5000})
    const groupCount = await page.$('aria/Number of people');
    await groupCount.type("6")
    const tent = await page.$('label.rec-label-checkbox.equip-checkbox.mb-1');
    await tent.click()
    const vehicleCount = await page.$('aria/Number of Vehicles', {timeout: 4000});
    await vehicleCount.type("2")
    // #page-body > div > section > div > div.flex-col-md-8 > div.order-details-forms-wrapper > section.rec-order-detail-need-to-know.sarsa-need-to-know >
    const needToKnow = await page.$('div.rec-form-check-wrap > label');
    await needToKnow.click()
    const submit = await page.$('#action-bar-submit')
    const navPromise = page.waitForNavigation();
    await submit.click()
    await navPromise
}
async function checkout(page, name, ccn, cvc, expmon, expyr) {
    const navPromise1 = page.waitForNavigation();
    const checkoutBtn = await page.$('div.cart-order-summary-actions > button.rec-button-primary-large');
    await checkoutBtn.click();
    await navPromise1;
    const nameField = await page.$('input[name="name"]', {timeout: 5000})    
    await nameField.click()
    await nameField.type(name)
    const ccnField = await page.$('input[name="number"]')
    await ccnField.click()
    await ccnField.type(ccn)
    // #page-body > div > div > div:nth-child(1) > div:nth-child(2) > div.flex-col-md-8 > div > div.flex-col-sm-12.flex-col-lg-6.flex-col-xl-7 > div.flex-grid.rec-cart-form-field > div:nth-child(1) > select
    await page.click('select[name="month"]')
    await page.select('select[name="month"]', expmon)
    await page.click('select[name="year"]')
    await page.select('select[name="year"]', expyr) 
    const cvcField = await page.$('input[name="cvc"]', cvc)
    await cvcField.click()
    await cvcField.type(cvc)
    // hit the button
    const navPromise2 = page.waitForNavigation();
    await page.click('#page-body > div > div > div:nth-child(1) > div:nth-child(2) > div.flex-col-md-8 > div > div.flex-col-sm-12.flex-col-lg-6.flex-col-xl-7 > button')
    await page.waitForNetworkIdle({timeout:5000})
    await page.click('.sarsa-button.ml-1.sarsa-button-primary.sarsa-button-md')
    await navPromise2
}

main()