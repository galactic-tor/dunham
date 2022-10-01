// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')
const Push = require( 'pushover-notifications' )
const path = require('path')
const config = require ("./config")
const logger = require('./logging')

const log = logger.child(config)
const result = require('dotenv').config({
    path: path.resolve(process.cwd(), 'secrets/.env')
})

if (result.error) {
    log.error("could not parse dotenv", {error: results.error})
    process.exit(1)
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
			}
			return collector
		}, [])

		if (r.length < 1) {
            log.info('no sites found', {dates: config.dates})
			await browser.close()
			return 
		}

        const campsite = r[0]
		// Try checking out if there are sites
		try {
			await BookSite(campsite.page, campsite.availableElements)
            log.info('campsite snagged')
		} catch (error) {
            log.error('failed to book site', {
                error,
                site: campsite.site,
                elements: campsite.availableElements,
            })
            console.error(error, campsite.availableElements)
            return
		}
        try {
            await notify(config.dates.start) 
        } catch (error) {
            log.error('failed to send push notification', errorCtx(error))
        }
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

async function failureNotification(err, page) {
    var p = new Push( {
        user: process.env.PUSHOVER_USER,
        token: process.env.PUSHOVER_TOKEN,
    })

    var msg = {
        message: `Unexpected Scraper Error: ${err}`,
        title: "🚨 Camp scraper error! 🚨",
        sound: 'siren',
        url: page.url
    }

    return p.send(msg)

}

async function CheckSite(browser, site) {
    try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', requestBlocker(config.blockRequests))
        await page.setDefaultNavigationTimeout(60*10*1000);
        await page.goto(config.urls.base+config.siteMap[site]);
        await closeModal(page);
        await campsiteListView(page);
        await setDates(page, config.dates.start, config.dates.end);
        const availableElements = await findAvailable(page)
        if (availableElements.length < 1) {
            await page.close()
            return Promise.reject()
        }
	    return Promise.resolve({site, page, availableElements});
    } catch (error) {
        log.error('unexpected error checking for sites', errorCtx(error, {site}))
        return Promise.reject(`unexpected error $errorCtx(error)`)
    }
}

function errorCtx(error, ctx) {
    if (ctx == undefined) {
        ctx = {}
    }
    if (error instanceof Error) {
        ctx.stack= error.stack;
        ctx.error = error.message
    } else {
        ctx.error = String(error)
    }
    return ctx 
}

async function BookSite(page, siteElements) {
    try {
        console.log(siteElements[0])
        await siteElements[0].click()
        const accessbilityCheck = await page.$x('//button[contains(., "Proceed with Reservation")]', {timeout: 2000})
        if (!!accessbilityCheck[0]) {
            await accessbilityCheck[0].click()
        }
        await login(
            page, 
            process.env.USER_NAME, 
            process.env.PASSWORD
        );
        await fillYosCampsiteField(page);
        await checkout(
            page, 
            process.env.FIRSTNAME,
            process.env.LASTNAME,
            process.env.CCN, 
            process.env.CVC,
            process.env.EXP_MONTH,
            process.env.EXP_YEAR
        );
	    return Promise.resolve("site booked")
    } catch (error) {
        log.error("BookSite failed", errorCtx(error))
        return Promise.reject(error)
    }
	
}

async function closeModal(page) {
    try {
        const button = await page.$('aria/Close modal[role="button"]');
        if (button) {
            await button.click();
        }
    } catch (error) {
        log.error('closeModal failed', errorCtx(error))
        return Promise.reject(error)
    }
    
}

async function campsiteListView(page) {
    try {
        // If we select only for Campsite List buttons the tab at the top of the page will be selected
        const button = await page.$x("//button[contains(., 'Campsite List')][contains(concat(' ',normalize-space(@class),' '),' sarsa-button-tertiary ')]")
        if (!button || button.length < 1) {
            throw new Error("No Campsite List View Button Found")
        }
        await button[0].click()
   } catch (error) {
       log.error('campsiteListView failed', errorCtx(error))
       return Promise.reject(error)
   }
}

async function setDates(page, start, end) {
    try {
        const startField = await page.$('#campground-start-date-calendar')
        const endField =  await page.$('#campground-end-date-calendar')
        if (!startField  || !endField) {
            throw new Error("Could not find start or end date fields")
        }
        await startField.click()
        await startField.type(start)
        await page.waitForTimeout(1000)
        await endField.click()
        await endField.type(end)
    } catch (error) {
        log.error('setDates failed', errorCtx(error))
        return Promise.reject(error)
    }
}

async function findAvailable(page) {
    try {
        const selector = '.list-map-book-now-button-tracker'
        await page.waitForSelector(selector)
        return page.$$(selector)
    } catch (error) {
        log.error('findAvailable failed', errorCtx(error))
        return Promise.reject(error)
    }
}

async function login(page, email, pw) {
    try {
        const loginBtn = await page.waitForSelector('.rec-acct-sign-in-btn', {timeout:10000})
        const emailField = await page.$('#email')
        const pwField = await page.$('#rec-acct-sign-in-password')
        await emailField.click()
        await emailField.type(email)
        await pwField.click()
        await pwField.type(pw)
        const navPromise = page.waitForNavigation()
        await loginBtn.click()
        await navPromise
    } catch (error) {
        log.error('login failed', errorCtx(error))
        return Promise.reject(error)
    }
}

async function fillYosCampsiteField(page) {
    try {
        await page.waitForSelector(".rec-order-detail-section-body")
        const groupCount = await page.$('aria/Number of people');
        await groupCount.type("6")
        const tent = await page.$('label.rec-label-checkbox.equip-checkbox.mb-1');
        await tent.click()
        const vehicleCount = await page.$('aria/Number of Vehicles', {timeout: 4000});
        await vehicleCount.type("2")
        const needToKnow = await page.$('div.rec-form-check-wrap > label');
        await needToKnow.click()
        const submit = await page.$('#action-bar-submit')
        const navPromise = page.waitForNavigation();
        await submit.click()
        await navPromise
    } catch (error) {
        log.error('fillYosCampsiteField failed', errorCtx(error))
        return Promise.reject()
    }
}
async function checkout(page, firstname, lastname, ccn, cvc, expmon, expyr) {
    try {
        const checkoutBtnXPath = "//button[contains(., 'Proceed to Payment')]"
        await page.waitForXPath(checkoutBtnXPath);
        const checkoutBtns = await page.$x(checkoutBtnXPath)
        console.log(checkoutBtns)
        if (!checkoutBtns || checkoutBtns.length < 2) {
            throw new Error("Failed to find checkout button")
        }
        const navPromise1 = page.waitForNavigation()
        await checkoutBtns[1].click();
        await navPromise1;
        const fnameField = await page.$('input[name="firstname"]', {timeout: 5000})
        await fnameField.click()
        await fnameField.type(firstname)
        const lnameField = await page.$('input[name="lastname"]', {timeout: 5000})
        await lnameField.click()
        await lnameField.type(lastname)
        const ccnField = await page.$('input[name="number"]')
        await ccnField.click()
        await ccnField.type(ccn)
        await page.click('select[name="month"]')
        await page.select('select[name="month"]', expmon)
        await page.click('select[name="year"]')
        await page.select('select[name="year"]', expyr) 
        const cvcField = await page.$('input[name="cvc"]', cvc)
        await cvcField.click()
        await cvcField.type(cvc)
        const nextButton = await page.$x("//button[contains(., 'Next')]")
        await nextButton[0].click()
        const confirmButton = await page.$x("//button[contains(., 'Confirm')]")
        await confirmButton[0].click()
        const navPromise2 = page.waitForNavigation();
        await navPromise2
    } catch (error) {
        log.error('checkout failed', errorCtx(error))
        return Promise.reject(error)
    }
    
}


function requestBlocker(config) {
    return function(request) {
        let url = request.url()
        if (request.isInterceptResolutionHandled()){
            logger.debug('request already intercepted', {url});
            return;
        } 
        for (let i = 0; i < config.resourceTypes.length; i++) {
            let  type = config.resourceTypes[i];
            if (request.resourceType() === type) {
                logger.debug('type aborted request', {type, url});
                request.abort();
                return;
            }
        }
        for (let i = 0; i < config.contains.length; i++) {
            let substring = config.contains[i]
            if ( url.includes(substring) ) {
                logger.debug('substring aborted request', {substring, url});
                request.abort();
                return;
            }
        }
        request.continue();
    } 
}

main()
