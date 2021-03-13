/*jshint esversion: 8*/
require = require('esm')(module);
const axios  = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const fetch = require('node-fetch');
const api = require('./api.js');
axiosCookieJarSupport(axios);
const E = exports;

const {fetch_json} = api.get_fetch(fetch);

class Scrapper extends api.BaseScrapper {
    constructor(){
        super();
        this.jar = new tough.CookieJar();
    }
    async get(url){
        const {data} = await axios.get(url, {
            jar: this.jar,
            withCredentials: true,
        });
        return data;
    }
    async post(url, body, headers){
        const fd = new FormData();
        for (const k in body)
            fd.append(k, body[k]);
        const {data} = await axios.post(url, fd, {
            jar: this.jar,
            withCredentials: true,
            headers: Object.assign(fd.getHeaders(), headers),
        });
        return data;
    }
    parse(data){
        const $ = cheerio.load(data);
        return {$, parsed: $};
    }
    select($, selector){
        return $(selector);
    }
}

const init = ()=>{
    const restdb = new api.RestDB(class extends api.BaseRestDBInstance {
        async fetch_json(url, opt){
            return fetch_json(url, opt);
        }
    });
    const config = new api.Conf(restdb);
    const scrapper = new Scrapper();
    const sync = new api.Sync(scrapper, restdb);
    return {restdb, config, scrapper, sync};
};

module.exports = {Scrapper, init};