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
        const button = await page.$('#tabs-panel-0 > div.sarsa-stack.md.campsite-list-tab.v2-tab > div.mb-2.grid-header-container > button.sarsa-button.sarsa-button-tertiary.sarsa-button-md')
        if (!button) {
            return new Error("No Campsite List View Button Found")
        }
        await button.click();
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
            return new Error("Could not find start or end date fields")
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
        await page.waitForNetworkIdle()
        const selector = '.list-map-book-now-button-tracker'
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
    } catch (error) {
        log.error('fillYosCampsiteField failed', errorCtx(error))
        return Promise.reject()
    }
}
async function checkout(page, name, ccn, cvc, expmon, expyr) {
    try {
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
