'use strict';
const bunyan = require('bunyan');
const fs = require('fs');
const marky = require('marky');
const puppeteer = require('puppeteer');
const url = require('url');

let log;

async function main() {
	await fs.readFile('input.txt', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
		await scrapeSites(data.split('\r\n'), 'main');
	});
};
//main();

async function scrapeSites(sites, logIdentifier) {
	const results = [];
	log = configureLogger(logIdentifier)

	const { browser, page } = await setupPage();

	const startTime = Math.round(new Date().getTime() / 1000);

	let i = 0;
	for (const site of sites) {
		marky.mark(`scraping site ${site}`);

		const result = await scrapeSite(page, site);
		await outputProgress(result);
		results.push(result);

		i++;

		const mark = marky.stop(`scraping site ${site}`);
		const currentTime = Math.round(new Date().getTime() / 1000);
		const elapsedTime = currentTime - startTime;
		const estimatedTimeRemaining = Math.round(elapsedTime / (i / sites.length));
		const estimatedCompletionDate = new Date(new Date().getTime() + (estimatedTimeRemaining * 1000));

		log.info(`${(mark.duration / 1000).toFixed(2)} seconds`);
		log.info(`${i}/${sites.length} - ${((i / sites.length) * 100).toFixed(2)}% complete`);
		log.info(`estimated time remaining: ${estimatedTimeRemaining} seconds; estimated completion date ${estimatedCompletionDate}`);
	}

	await page.close();
	await browser.close();

	return results;
}

async function outputProgress({ site, targetFound }) {
	await fs.appendFile('output.csv', `${site},${targetFound}\r\n`, 'utf8', (err) => {
		if (err) throw err;
	});
}

function configureLogger(name) {
	const log = bunyan.createLogger({name: name,
		streams: [
		{
			level: 'info',
			stream: process.stdout
		},
		{
			level: 'info',
			path: 'log.log'
		}
	]});

	log._emit = (rec, noemit) => {
		delete rec.hostname;
		delete rec.pid;
		delete rec.v;
		bunyan.prototype._emit.call(log, rec, noemit);
	};

	return log;
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
	const siteHasTargetLink = (await visitHelper(page, [{ href: url }], visitedUrls, url, true));

	log.info(`Has target link: ${siteHasTargetLink}`);
	log.info(`${Object.keys(visitedUrls).length} visited links`);
	log.info(`${Object.keys(skippedLinks).length} skipped links`);

	return {
		site: url,
		targetFound: siteHasTargetLink
	};
}

async function visitHelper(page, links, visitedUrls, landingPage, isLandingPage = false) {
	const rankedLinks = rankLinks(filterLinks(landingPage, links)).filter(l => l.rank > 0 || isLandingPage);

	for (const link of rankedLinks) {

		// base case
		if (visitedUrls[link.href])
			continue;

		// recursive case
		visitedUrls[link.href] = true;
		if (await visit(page, link.href, visitedUrls))
			return true;
	}
	return false;
}

async function visit(page, url, visitedUrls) {
	log.info(`visiting ${url}`);

	try {
		await page.goto(url);

		if (await page.evaluate(hasTargetLink))
			return true;

		const links = await page.evaluate(getLinks);

		return await visitHelper(page, links, visitedUrls);
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

function filterLinks(landingPage, links) {
	const landingPageUrl = new URL(landingPage);
	const filteredLinks = [];
	for (const link of links) {
		if (new URL(link).hostname != landingPageUrl.hostname) {
			filteredLinks.push(link);
			continue;
		}

		if (!link.pathname && !link.search) {
			filteredLinks.push(link);
			continue;
		}

		const pathAndQuery = `${link.pathname}${link.search}`;
		if (filterKeywords.every(k => !pathAndQuery.includes(k)))
			filteredLinks.push(link)
		else
			skippedLinks[link] = true;
	}

	return filteredLinks;
}

function rankLinks(links) {
	const linksWithRanking = links.map(l => ({
		href: l.href,
		pathname: l.pathname,
		search: l.search,
		rank: fastRankLink(l)
	}));

	linksWithRanking.sort(a => a.rank);
	linksWithRanking.reverse();

	return linksWithRanking;
}

function fastRankLink(link) {
	for (const keyword of givingKeywords) {
		if ((link.pathname && link.pathname.includes(keyword))
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
