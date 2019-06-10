'use strict';
const configureLogger = require('./configureLogger.js');
const fs = require('fs');
const marky = require('marky');
const puppeteer = require('puppeteer');

let log;

// TODO: run if this file was not imported
async function main() {
	await fs.readFile('input.txt', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
		await scrapeSites(data.split('\r\n'), 'main');
	});
};
//main();

async function scrapeSites(sites, logIdentifier, outputProgress = async () => {}) {
	const results = [];
	log = configureLogger(logIdentifier)

	const { browser, page } = await setupPage();

	const startTime = Math.round(new Date().getTime() / 1000);

	let siteNum = 0;
	for (const site of sites) {
		marky.mark(`scraping site ${site}`);

		const result = await scrapeSite(page, site);
		await outputProgress(result);
		results.push(result);
		siteNum++;

		const mark = marky.stop(`scraping site ${site}`);
		const currentTime = Math.round(new Date().getTime() / 1000);
		const elapsedTime = currentTime - startTime;
		const estimatedTimeRemaining = Math.round(elapsedTime / (siteNum / sites.length));
		const estimatedCompletionDate = new Date(new Date().getTime() + (estimatedTimeRemaining * 1000));

		log.info(`${(mark.duration / 1000).toFixed(2)} seconds`);
		log.info(`${siteNum}/${sites.length} - ${((siteNum / sites.length) * 100).toFixed(2)}% complete`);
		log.info(`estimated time remaining: ${estimatedTimeRemaining} seconds; estimated completion date ${estimatedCompletionDate}`);
	}

	await page.close();
	await browser.close();

	return results;
}

async function setupPage(){
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	// disable loading slow and irrelevant resource types
	await page.setRequestInterception(true);
	const ignoreResourceTypes = {
		'image': true,
		'font': true,
		'media': true
	};
	page.on('request', (req) => {
		if (ignoreResourceTypes[req.resourceType()])
			req.abort();
		else
			req.continue();
	});

	return { browser, page };
}

async function scrapeSite(page, url) {
	log.info(`scraping ${url}`);

	const visitedUrls = {};
	const siteHasTargetLink = (await visitHelper(page, url, [{ href: url }], visitedUrls, true));

	log.info(`Has target link: ${siteHasTargetLink}`);
	log.info(`${Object.keys(visitedUrls).length} visited links`);
	log.info(`${Object.keys(skippedLinks).length} skipped links`);

	return {
		site: url,
		targetFound: siteHasTargetLink
	};
}

const maxLevels = 10;

async function visitHelper(page, landingPage, links, visitedUrls, isLandingPage = false, level = 0) {
	const rankedLinks = rankLinks(filterLinks(links, landingPage)).filter(l => l.rank > 0 || isLandingPage);

	for (const link of rankedLinks) {
		// guard against links which cause infinite loops
		if (level++ == maxLevels)
			break;

		const url = new URL(link.href);
		const hostAndPath = `${url.hostname}${url.pathname}`;

		// base case
		if (visitedUrls[hostAndPath])
			continue;

		// recursive case
		visitedUrls[hostAndPath] = true;
		if (await visit(page, landingPage, link.href, visitedUrls, level))
			return true;
	}
	return false;
}

async function visit(page, landingPage, url, visitedUrls, level) {
	log.info(`visiting ${url}`);

	try {
		await page.goto(url);

		if (await page.evaluate(hasTargetLink))
			return true;

		const links = await page.evaluate(getLinks);

		return await visitHelper(page, landingPage, links, visitedUrls, false, level);
	} catch (e) {
		if (e.message.includes('net::')) {
			if (e.message.includes('net::ERR_NAME_NOT_RESOLVED'))
				log.info(`site does not exist: ${url}`);
			else if (e.message.includes('net::ERR_NAME_RESOLUTION_FAILED'))
				log.info(`could not resolve address for site: ${url}`);
			// these are thrown for links to download files
			else if (e.message.includes('net::ERR_ABORTED')) {
			}
		} else {
			log.error(e);
		}
		return false;
	}
}

function hasTargetLink() {
	return document.getElementsByTagName('html')[0].innerHTML.includes('mogiv.com');
}

function getLinks() {
	return [].slice.call(document.getElementsByTagName('a'))
		.filter(a => a.hostname == location.hostname)
		.map(a => ({ href: a.href, pathname: a.pathname, search: a.search }));
}

const filterKeywords = [ 'download', 'upload', 'media' ];
const skippedLinks = {};

function filterLinks(links, landingPage) {
	const landingPageUrl = normalizeHostname(new URL(landingPage).hostname);
	const filteredLinks = [];
	for (const link of links) {
		if (normalizeHostname(new URL(link.href).hostname) != landingPageUrl) {
			skippedLinks[link] = true;
			continue;
		}

		const trimmedText = link.text ? link.text.trim() : '';

		if (!link.pathname && !link.search && trimmedText.length == 0) {
			filteredLinks.push(link);
			continue;
		}

		const pathAndQuery = `${link.pathname}${link.search}`;
		if (filterKeywords.some(k => pathAndQuery.includes(k) || trimmedText.includes(k)))
			filteredLinks.push(link)
		else
			skippedLinks[link] = true;
	}

	return filteredLinks;
}

function normalizeHostname(hostname) {
	let numPeriods = 0;
	let indexOfFirstPeriod = 0;
	for (const c in hostname) {
		if (hostname[c] === '.') {
			if (++numPeriods == 1)
				indexOfFirstPeriod = c;
			else if (numPeriods == 2)
				break;
		}		
	}
	if (numPeriods > 1)
		return hostname.slice(indexOfFirstPeriod + 1);
	return hostname;
}

function rankLinks(links) {
	const linksWithRanking = links.map(l => ({
		href: l.href,
		pathname: l.pathname,
		search: l.search,
		text: l.text,
		rank: fastRankLink(l)
	}));

	linksWithRanking.sort(a => a.rank);
	linksWithRanking.reverse();

	return linksWithRanking;
}

function fastRankLink(link) {
	for (const keyword of givingKeywords) {
		if ((link.pathname && link.pathname.includes(keyword))
			|| (link.text && link.text.includes(keyword))
			|| (link.search && link.search.includes(keyword)))
			return rankByGivingKeyword[keyword];
	}

	return 0;
}

const rankByGivingKeyword = {
	'mogiv': 3,
	'giving': 2,
	'give': 2,
	'donate': 2,
	'tithe': 2,
	'pay': 1
};

const givingKeywords = Object.keys(rankByGivingKeyword);

module.exports = scrapeSites;
